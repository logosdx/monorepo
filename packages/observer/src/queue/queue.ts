import {
    assert,
    attempt,
    clone,
    isFunction,
    isPlainObject,
    wait,
    noop,
    generateId,
    TimeoutError,
    isTimeoutError,
    RateLimitTokenBucket,
    PriorityQueue,
} from '@logosdx/utils';

import {
    type Events,
    EventPromise,
    type EventData,
    ObserverEngine,
    EventGenerator
} from '../index.ts';

import { QueueStateManager } from './state.ts';
import { QueueStats } from './statistics.ts';
import {
    InternalQueueEvent,
    type QueueEventData,
    type QueueEventNames,
    type QueueEvents,
    QueueRejectionReason,
} from './helpers.ts';

/**
 * The options for the queue
 */
export interface QueueOpts {

    /**
     * The name of the queue
     */
    name: string,

    /**
     * The type of queue to use
     *
     * @default 'fifo'
     */
    type?: 'fifo' | 'lifo';

    /**
     * The concurrency of the queue
     *
     * @default 1
     */
    concurrency?: number;

    /**
     * The poll interval in milliseconds before the queue will
     * check for new items after idle.
     *
     * @default 100
     */
    pollIntervalMs?: number;

    /**
     * The jitter percentage to displace
     * the next process time. This stops all concurrent
     * processes from happening at the same time.
     *
     * @range [0, 1]
     * @default 1
     */
    jitterFactor?: number;

    /**
     * The interval in milliseconds before picking up the next item
     *
     * @note If the interval is 0, the queue will not wait between items
     *
     * @default 0
     */
    processIntervalMs?: number;

    /**
     * The timeout in milliseconds before the task is considered timed out
     *
     * @note If the timeout is 0, the task will not be considered timed out
     *
     * @default 0
     */
    taskTimeoutMs?: number;

    /**
     * The maximum size of the queue
     *
     * @default 999_999_999
     */
    maxQueueSize?: number;

    /**
     * The rate limit of the queue in items per window
     *
     * @default 999_999_999
     */
    rateLimitCapacity?: number;

    /**
     * The rate limit window in milliseconds
     *
     * @default 1000
     */
    rateLimitIntervalMs?: number;

    /**
     * Automatically start the queue
     *
     * @default true
     */
    autoStart?: boolean;

    /**
     * Whether to enable debug mode. Can be set to 'info' or 'verbose' to
     * get more detailed output.
     *
     * @default false
     */
    debug?: boolean | 'info' | 'verbose';
}

export class EventQueue<S extends Record<string, any>, E extends Events<S> | RegExp = Events<S>> {

    #queue: PriorityQueue<QueueEventData<S, E>>;
    #priorites: Map<EventData<S, E>, number> = new Map();
    #off: ObserverEngine.Cleanup = noop;

    #state = new QueueStateManager();
    #stats: QueueStats;

    #rateLimiter: RateLimitTokenBucket;
    #idle = true;
    #waiting = false;
    #listening = false;
    #debugging: boolean | 'info' | 'verbose' = false;
    #generation = 0;
    #activeRunners = 0;
    #runningNodes: Set<`${number}-${number}`> = new Set();


    constructor(
        private opts: QueueOpts & {
            event: E | RegExp,
            process: (data: EventData<S, E>) => Promise<void>
            observer?: ObserverEngine<S>,
        }
    ) {

        const {
            observer = new ObserverEngine<S>(),
            event,
            process,
            name,
            type = 'fifo',

            concurrency = 1,
            pollIntervalMs = 100,
            jitterFactor = 0,
            rateLimitIntervalMs = 1000,
            processIntervalMs = 0,
            taskTimeoutMs = 0,

            autoStart = true,
            debug = false,
        } = this.opts;

        let {
            maxQueueSize = 999_999_999,
            rateLimitCapacity = 999_999_999,
        } = this.opts;

        assert(isPlainObject(this.opts), 'Options is required to be an object');
        assert(isFunction(observer?.on), 'ObserverEngine is required');
        assert(
            (
                typeof event === 'string' &&
                event.length > 0
            ) ||
            (
                event instanceof RegExp
            ),
            'Event is required to be a string or RegExp'
        );
        assert(isFunction(process), 'Process is required to be a function');
        assert(name && typeof name === 'string' && name.length > 0, 'Name is required');

        assert(concurrency > 0, 'Concurrency must be greater than 0');
        assert(pollIntervalMs > 0, 'pollIntervalMs must be a number greater than 0');
        assert(jitterFactor >= 0 && jitterFactor <= 1, 'Jitter must be a number greater than or equal to 0 and less than or equal to 1');

        assert(maxQueueSize > 0, 'MaxQueueSize must be a number greater than 0');
        assert(rateLimitIntervalMs > 0, 'rateLimitIntervalMs must be a number greater than 0');
        assert(rateLimitCapacity > 0, 'rateLimitCapacity must be a number greater than 0');

        assert(processIntervalMs >= 0, 'processIntervalMs must be a number greater than or equal to 0');
        assert(taskTimeoutMs >= 0, 'taskTimeoutMs must be a number greater than or equal to 0');

        assert(type === 'fifo' || type === 'lifo', 'Type must be either "fifo" or "lifo"');
        assert(typeof autoStart === 'boolean', 'AutoStart must be a boolean');

        if (maxQueueSize === Infinity) {
            maxQueueSize = 999_999_999;
        }

        if (rateLimitCapacity === Infinity) {
            rateLimitCapacity = 999_999_999;
        }

        Object.assign(this.opts, {
            observer,
            type,
            concurrency,
            maxQueueSize,
            pollIntervalMs,
            jitterFactor,
            processIntervalMs,
            taskTimeoutMs,
        });

        this.#debugging = debug;

        this.#stats = new QueueStats(observer, name);

        this.#rateLimiter = new RateLimitTokenBucket({
            capacity: rateLimitCapacity!,
            refillIntervalMs: rateLimitIntervalMs!
        });

        this.#queue = new PriorityQueue<QueueEventData<S, E>>({
            lifo: type === 'lifo'
        });

        if (autoStart) {
            this.start();
        }
    }

    #listen() {

        if (this.#listening) return;

        this.#listening = true;

        const off = this.opts.observer!.on(
            this.opts.event as Events<S>,
            (payload) => {

                // Skip internal queue events (wrapped in InternalQueueEvent)
                // Check both positions: direct payload (string events) or payload.data (regex events)
                const maybeInternal = (payload as any)?.data ?? payload;

                if (maybeInternal instanceof InternalQueueEvent) {

                    return;
                }

                // Use payload as-is - for regex events this is { event, data, listener }
                const data = payload as EventData<S, E>;

                const item: QueueEventData<S, E> = {
                    data,
                    _taskId: generateId(),
                    priority: this.#priorites.get(data) ?? 0
                };

                this.#priorites.delete(data);

                if (this.#queue.size() >= this.opts.maxQueueSize!) {

                    this.#emit('rejected', { ...item, reason: QueueRejectionReason.full });

                    return;
                }


                this.#emit('added', item);

                this.#idle = false;

                this.#queue.push(item, item.priority);
            }
        );

        this.#off = () => {
            off();
            this.#listening = false;
        }
    }

    #emit<K extends QueueEventNames>(
        event: K | string,
        payload?: QueueEventData<S, E>
    ) {

        if (this.#debugging) {

            const args: any[] = [`[${this.name}] ${event}`, payload?._taskId ?? '', payload?.data ?? '' ];

            if (this.#debugging === 'verbose') {
                args[1] = payload;
            }

            console.log(...args);
        }

        // Wrap payload so regex listeners can detect and skip internal queue events
        this.opts.observer!.emit(
            `queue:${this.name}:${event}`,
            new InternalQueueEvent(payload) as never
        );
    }

    /**
     * Setups concurrency and begins processing items
     */
    #launchRunners() {

        const generation = ++this.#generation;

        for (let i = 0; i < this.opts.concurrency!; i++) {
            this.#workerLoop(generation, i);
        }
    }


    /**
     * Loops and processes items in the queue until the queue is stopped
     */
    async #workerLoop(generation: number, instance: number): Promise<void> {

        const { pollIntervalMs, jitterFactor } = this.opts;
        this.#activeRunners++;

        while (
            this.#state.is('running') &&
            this.#generation === generation
        ) {

            if (!this.pending) {
                if (
                    !this.#idle &&
                    !this.pending &&
                    this.#runningNodes.size === 0
                ) {
                    this.#idle = true;
                    this.#emit('idle');
                }

                this.#waiting = true;

                await wait(
                    pollIntervalMs! *
                    (1 + Math.random() * jitterFactor!)
                );

                this.#waiting = false;

                continue;
            }

            const data = this.#queue.pop();

            if (!data) continue;

            this.#runningNodes.add(`${generation}-${instance}`);

            await this.#processNext(data);

            if (this.opts.processIntervalMs! > 0) {

                await wait(this.opts.processIntervalMs!);
            }

            this.#runningNodes.delete(`${generation}-${instance}`);
        }

        this.#activeRunners--;
    }

    /**
     * Processes the next item in the queue, if the queue is not
     * in a state that prevents it from processing the item.
     */
    async #processNext(item: QueueEventData<S, E>): Promise<void> {

        if (!this.#state.is('running', 'draining')) {

            this.#queue.push(item);

            return;
        };

        let rateLimited = false;

        if (!this.#state.is('draining')) {

            // console.log('waiting for token', new Date().toISOString());
            await this.#rateLimiter.waitAndConsume(
                1, {
                    onRateLimit: () => {
                        this.#emit('rate-limited', item);
                        rateLimited = true;
                    }
                }
            );
            // console.log('token acquired', new Date().toISOString());
        }

        const startedAt = Date.now();

        this.#emit('processing', { ...item, startedAt, rateLimited });

        const [,err] = await attempt(
            async () => {

                if (this.opts.taskTimeoutMs! === 0) {
                    return this.opts.process(item.data as EventData<S, E>)
                }

                const result = await Promise.race([
                    this.opts.process(item.data as EventData<S, E>),
                    wait(this.opts.taskTimeoutMs!, new TimeoutError('Task timed out'))
                ]);

                if (isTimeoutError(result)) {
                    this.#emit('timeout', { ...item, error: result });
                    throw result;
                }

                return result;

            }
        );

        const elapsed = Date.now() - startedAt;

        if (err) {

            this.#emit('error', { ...item, error: err, rateLimited });
        }
        else {

            this.#emit('success', { ...item, startedAt, elapsed, rateLimited });
        }

        if (this.#queue.size() === 0 && this.#state.is('running')) {

            this.#emit('empty');
        }
    }

    /**
     * Start the queue if it is not already started
     */
    start() {

        if (this.#state.is('running')) return;

        this.#listen();
        this.#state.transition('running');
        this.#emit('start');
        this.#launchRunners();
        this.#emit('started');

        return Promise.resolve();
    }

    /**
     * Stop the queue
     */
    stop() {

        if (this.#state.is('stopped')) return;

        this.#off();
        this.#state.transition('stopped');
        this.#emit('stopped');
    }

    /**
     * Pause the queue
     */
    pause() {

        if (this.#state.is('paused')) return;

        this.#state.transition('paused');
        this.#emit('paused');

        return Promise.resolve();
    }

    /**
     * Resume the queue
     */
    resume() {

        if (this.#state.is('running')) return;

        this.#listen();
        this.#state.transition('running');
        this.#launchRunners();
        this.#emit('resumed');

        return Promise.resolve();
    }

    /**
     * Processes a batch of items from the queue, and then
     * calls the before and after functions. Returns the
     * number of items processed.
     */
    async #processBatch(limit = Infinity, beforeFn?: Function, afterFn?: Function) {

        let count = limit === Infinity ? this.#queue.size() : limit;

        const items = this.#queue.popMany(count);

        if (count < items.length) {
            count = items.length;
        }

        beforeFn?.(count);

        if (count !== 0) {

            for (const item of items) {

                await this.#processNext(item);
            }
        }

        afterFn?.(count);

        return count;
    }

    /**
     * Empty and process all items in the queue and
     * then stop the queue. Returns the number of items
     * processed.
     */
    shutdown(force = false) {

        if (this.#state.is('draining', 'stopped')) return Promise.resolve(0);

        if (force) {

            const count = this.purge();
            this.stop();
            this.#emit('shutdown', { force, pending: count });

            return Promise.resolve(count);
        }

        return this.#processBatch(
            Infinity,
            (pending: number) => {
                this.pause();
                this.#state.transition('draining');
                this.#off();
                this.#emit('drain', { pending });
            },
            (drained: number) => {
                // If force is true, we communicate the number of pending items that
                // were dropped. Otherwise, we communicate the number of items that
                // were drained.
                this.#emit('drained', force ? { pending: drained } : { drained });

                this.stop();

                // Same as above, but we only communicate the number of pending items
                // that were dropped.
                this.#emit('shutdown', force ? { force, pending: drained } : { force });
            }
        );
    }

    /**
     * Executes `limit` items in the queue
     * and then emits a `flush` event. Returns the number
     * of items processed.
     */
    async flush(limit = Infinity) {

        return this.#processBatch(
            limit,
            (pending: number) => this.#emit('flush', { pending }),
            (flushed: number) => this.#emit('flushed', { flushed })
        );
    }

    /**
     * Clears the queue and emits a `purge` event. Returns
     * the number of items purged.
     */
    purge() {

        const count = this.#queue.size();
        this.#queue.clear();

        this.#emit('purged', { count });

        return count;
    }

    /**
     * Emit an event to the observer, which then gets
     * picked up by the queue and processed.
     *
     * @param data The data to add to the queue
     * @param priority The priority of the data
     *
     * @note If priority is provided, it will be used to determine the order of the data in the queue.
     *       The higher the priority, the sooner the data will be processed.
     *
     * @note If priority is not provided, the data will be added to the queue with a priority of 0.
     */
    add(data: EventData<S, E>, priority?: number) {

        if (!this.#state.is('running', 'paused')) {

            this.#emit('rejected', { data, reason: QueueRejectionReason.notRunning });

            return false;
        }

        if (this.#queue.size() >= this.opts.maxQueueSize!) {

            this.#emit('rejected', { data, reason: QueueRejectionReason.full });

            return false;
        }

        if (priority) {
            this.#priorites.set(data, priority);
        }

        this.opts.observer!.emit(this.opts.event, data);

        return true;
    }

    debug(on: boolean | 'info' | 'verbose' = false) {

        this.#debugging = on;
    }

    #observerForQueue() {

        return this.opts.observer as unknown as ObserverEngine<QueueEvents<S, E>>;
    }

    on<K extends keyof QueueEvents<S, E>>(
        event: K,
        listener: ((payload: InternalQueueEvent<QueueEvents<S, E>[K]>) => void)
    ): ObserverEngine.Cleanup;

    on<K extends keyof QueueEvents<S, E>>(
        event: K
    ): EventGenerator<QueueEvents<S, E>, K>;

    on<K extends keyof QueueEvents<S, E>>(
        event: K,
        listener?: ((payload: InternalQueueEvent<QueueEvents<S, E>[K]>) => void) | undefined
    ): ObserverEngine.Cleanup | EventGenerator<QueueEvents<S, E>, K> {

        return this.#observerForQueue().on(
            `queue:${this.name}:${event}` as unknown as K,
            listener as ObserverEngine.EventCallback<QueueEvents<S, E>[K]>
        );
    }

    once<K extends keyof QueueEvents<S, E>>(
        event: K
    ): EventPromise<InternalQueueEvent<QueueEvents<S, E>[K]>>;

    once<K extends keyof QueueEvents<S, E>>(
        event: K,
        listener: ((payload: InternalQueueEvent<QueueEvents<S, E>[K]>) => void)
    ): ObserverEngine.Cleanup

    once<K extends keyof QueueEvents<S, E>>(
        event: K,
        listener?: ((payload: InternalQueueEvent<QueueEvents<S, E>[K]>) => void)
    ): EventPromise<InternalQueueEvent<QueueEvents<S, E>[K]>> | ObserverEngine.Cleanup {

        return this.#observerForQueue().once(
            `queue:${this.name}:${event}` as unknown as K,
            listener as ObserverEngine.EventCallback<QueueEvents<S, E>[K]>
        );
    }

    off<K extends keyof QueueEvents<S, E>>(
        event: K, listener?: Function
    ) {
        return this.#observerForQueue().off(
            `queue:${this.name}:${event}` as unknown as K,
            listener
        );
    }

    /**
     * The name of the queue
     */
    get name() {
        return this.opts.name;
    }

    /**
     * Whether the queue is waiting for the
     * the
     */
    get isWaiting() {
        return this.#waiting;
    }

    /**
     * Whether the queue is idle
     */
    get isIdle() {

        return this.#idle && this.#state.is('running');
    }

    /**
     * Whether the queue is running
     */
    get isRunning() {
        return this.#state.is('running');
    }

    /**
     * Whether the queue is paused
     */
    get isPaused() {
        return this.#state.is('paused');
    }

    /**
     * Whether the queue is stopped
     */
    get isStopped() {
        return this.#state.is('stopped');
    }


    /**
     * Whether the queue is draining
     */
    get isDraining() {
        return this.#state.is('draining');
    }

    /**
     * The current state of the queue
     */
    get state() {
        return this.#state.state;
    }

    /**
     * The number of items in the queue
     */
    get pending() {

        return this.#queue.size();
    }

    /**
     * The stats of the queue
     */
    get stats() {

        return clone(this.#stats.stats);
    }

    get snapshot() {

        return {
            name: this.name,
            state: this.state,
            pending: this.pending,
            stats: this.stats,
            rateLimiter: this.#rateLimiter.snapshot,
            activeRunners: this.#activeRunners,
            runningNodes: this.#runningNodes,
            isIdle: this.isIdle,
            isWaiting: this.isWaiting,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            isStopped: this.isStopped,
            isDraining: this.isDraining,
            isEmpty: this.pending === 0,
        }
    }

}
