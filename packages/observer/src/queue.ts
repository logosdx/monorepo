import {
    assert,
    attempt,
    clone,
    isFunction,
    isPlainObject,
    wait,
    RateLimitTokenBucket,
    noop,
    generateId,
} from '@logosdx/utils';

import { type Events } from './types.ts';
import { EventPromise, type EventData } from './helpers.ts';
import { type ObserverEngine } from './engine.ts';
import { EventGenerator } from './generator.ts';

export enum QueueState {
    running = 'running',
    paused = 'paused',
    stopped = 'stopped',
    draining = 'draining',
}

export enum QueueRejectionReason {
    full = 'Queue is full',
    notRunning = 'Queue is not running',
}

export type QueueEventNames =
  | `added`
  | `start`
  | `started`
  | `stopped`
  | `processing`
  | `success`
  | `error`
  | `rate-limited`
  | `empty`
  | `idle`
  | `rejected`
  | `drain`
  | `drained`
  | `flush`
  | `flushed`
  | `paused`
  | `resumed`
  | `cleanup`
  | `purged`
  | `shutdown`

export type QueueEvents<S extends Record<string, any>, E extends Events<S> | RegExp = Events<S>> = {
    added: QueueItem<S, E>;
    start: void;
    started: void;
    stopped: void;
    processing: QueueItem<S, E> & { startedAt: number, rateLimited: boolean };
    success: QueueItem<S, E> & { startedAt: number, elapsed: number, rateLimited: boolean };
    error: QueueItem<S, E> & { error: Error, rateLimited: boolean };
    rejected: QueueItem<S, E> & { reason: QueueRejectionReason };
    'rate-limited': QueueItem<S, E> & { rateLimited: boolean };
    empty: void;
    idle: void;
    drain: { pending: number };
    drained: { pending?: number, drained?: number };
    flush: { pending: number };
    flushed: { flushed: number };
    paused: void;
    resumed: void;
    cleanup: void;
    purged: { count: number };
    shutdown: { force: boolean, pending?: number };
}

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
     * The debounce time in milliseconds
     *
     * @default 100
     */
    debounceMs?: number;

    /**
     * The jitter time in milliseconds to displace
     * the next process time. This stops all concurrent
     * processes from happening at the same time.
     *
     * @range [0, 1]
     * @default 1
     */
    jitter?: number;

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
    rateLimitItems?: number;

    /**
     * The rate limit window in milliseconds
     *
     * @default 1000
     */
    rateLimitWindow?: number;

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

class QueueStateManager {

    status: QueueState = QueueState.stopped;

    #allowedTransitions: Record<QueueState, QueueState[]> = {
        [QueueState.running]: [QueueState.paused, QueueState.draining, QueueState.stopped],
        [QueueState.draining]: [QueueState.stopped, QueueState.paused],
        [QueueState.paused]: [QueueState.running, QueueState.draining, QueueState.stopped],
        [QueueState.stopped]: [QueueState.running, QueueState.draining],
    };

    transition(to: keyof typeof QueueState) {

        assert(
            this.#allowedTransitions[this.status].includes(to as QueueState),
            `Invalid transition from ${this.status} to ${to}`
        );

        this.status = to as QueueState;
    }

    is(...states: (keyof typeof QueueState)[]) {
        return states.includes(this.status);
    }

    get state() {
        return this.status;
    }
}

class QueueStats {

    #processing: number = 0;
    #processed: number = 0;
    #avgProcessingTime: number = 0;
    #success: number = 0;
    #error: number = 0;
    #rejected: number = 0;

    constructor(
        private observer: ObserverEngine<any>,
        private queueName: string
    ) {

        this.observer.on(
            `queue:${this.queueName}:processing`,
            () => {
                this.#processing++;
                this.#processed++
            }
        );

        this.observer.on(
            `queue:${this.queueName}:success`,
            ({ elapsed }) => {

                this.#success++;
                this.#processing--;
                this.#calculateAvg(elapsed);
            }
        );

        this.observer.on(
            `queue:${this.queueName}:error`,
            () => {
                this.#error++;
                this.#processing--;
            }
        );

        this.observer.on(
            `queue:${this.queueName}:rejected`,
            () => this.#rejected++
        );
    }

    #calculateAvg(elapsed: number) {
        this.#avgProcessingTime = (
            ((this.#avgProcessingTime * (this.#success - 1)) +
            elapsed) /
            this.#success
        );
    }

    get stats() {
        return {
            processed: this.#processed,
            processing: this.#processing,
            avgProcessingTime: this.#avgProcessingTime,
            success: this.#success,
            error: this.#error,
            rejected: this.#rejected,
        }
    }
}

export type QueueItem<S, E extends Events<S> | RegExp = Events<S>> = {
    data: EventData<S, E>,
    _taskId: string
};

export class EventQueue<S extends Record<string, any>, E extends Events<S> | RegExp = Events<S>> {

    #queue: QueueItem<S, E>[] = [];

    #next: () => QueueItem<S, E> | undefined;
    #off: ObserverEngine.Cleanup = noop;

    #state = new QueueStateManager();
    #stats: QueueStats;

    #rateLimiter: RateLimitTokenBucket;
    #idle = true;
    #listening = false;
    #debugging: boolean | 'info' | 'verbose' = false;
    #generation = 0;
    #activeRunners = 0;


    constructor(
        private opts: QueueOpts & {
            observer: ObserverEngine<S>,
            event: E | RegExp,
            process: (data: EventData<S, E>) => Promise<void>
        }
    ) {

        const {
            observer,
            event,
            process,
            name,
            type = 'fifo',

            concurrency = 1,
            debounceMs = 100,
            jitter = 0,
            rateLimitWindow = 1000,

            autoStart = true,
            debug = false,
        } = this.opts;

        let {
            maxQueueSize = 999_999_999,
            rateLimitItems = 999_999_999,
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
        assert(debounceMs > 0, 'DebounceMs must be a number greater than 0');
        assert(jitter >= 0 && jitter <= 1, 'Jitter must be a number greater than or equal to 0 and less than or equal to 1');

        assert(maxQueueSize > 0, 'MaxQueueSize must be a number greater than 0');
        assert(rateLimitWindow > 0, 'RateLimitWindow must be a number greater than 0');
        assert(rateLimitItems > 0, 'RateLimitItems must be a number greater than 0');

        assert(type === 'fifo' || type === 'lifo', 'Type must be either "fifo" or "lifo"');
        assert(typeof autoStart === 'boolean', 'AutoStart must be a boolean');

        if (maxQueueSize === Infinity) {
            maxQueueSize = 999_999_999;
        }

        if (rateLimitItems === Infinity) {
            rateLimitItems = 999_999_999;
        }

        Object.assign(this.opts, {
            type,
            concurrency,
            maxQueueSize,
            debounceMs,
            jitter,
        });

        this.#debugging = debug;

        this.#stats = new QueueStats(observer, name);

        this.#rateLimiter = new RateLimitTokenBucket(
            rateLimitItems!,
            rateLimitWindow!
        );

        this.#next = () => this.#queue.shift();

        if (this.opts.type === 'lifo') {
            this.#next = () => this.#queue.pop();
        }

        if (autoStart) {
            this.start();
        }
    }


    #listen() {

        if (this.#listening) return;

        this.#listening = true;

        const off = this.opts.observer.on(
            this.opts.event as Events<S>,
            (data) => {

                const item: QueueItem<S, E> = { data, _taskId: generateId() };

                if (this.#queue.length >= this.opts.maxQueueSize!) {

                    this.#emit('rejected', { ...item, reason: QueueRejectionReason.full });

                    return;
                }


                this.#emit('added', item);

                this.#idle = false;

                this.#queue.push(item);
            }
        );

        this.#off = () => {
            off();
            this.#listening = false;
        }
    }

    #emit<K extends QueueEventNames>(
        event: K | string,
        payload?: unknown
    ) {

        if (this.#debugging) {

            const args: any[] = [`[${this.name}] ${event}`, (payload as any)?._taskId ?? ''];

            if (this.#debugging === 'verbose') {
                args[1] = payload;
            }

            console.log(...args);
        }

        this.opts.observer.emit(
            `queue:${this.name}:${event}`,
            payload as never
        );
    }

    /**
     * Setups concurrency and begins processing items
     */
    #launchRunners() {

        const generation = ++this.#generation;

        for (let i = 0; i < this.opts.concurrency!; i++) {
            this.#activeRunners++;
            this.#run(generation).finally(() => this.#activeRunners--);
        }
    }


    /**
     * Loops and processes items in the queue until the queue is stopped
     */
    async #run(generation: number): Promise<void> {

        const { debounceMs, jitter } = this.opts;

        while (
            this.#state.is('running') &&
            this.#generation === generation
        ) {

            if (!this.pending) {
                const waitTime = debounceMs! * (1 + Math.random() * jitter!);
                await wait(waitTime);

                if (!this.#idle && !this.pending) {
                    this.#idle = true;
                    this.#emit('idle');
                }

                continue;
            }

            const data = this.#next();
            if (!data) continue;

            await this.#processNext(data);
        }
    }

    /**
     * Processes the next item in the queue, if the queue is not
     * in a state that prevents it from processing the item.
     */
    async #processNext(item: QueueItem<S, E>): Promise<void> {

        if (!this.#state.is('running', 'draining')) {

            this.opts.type === 'lifo' ?
                this.#queue.push(item) :
                this.#queue.unshift(item);

            return;
        };

        let rateLimited = false;

        if (!this.#state.is('draining')) {

            await this.#rateLimiter.waitForToken(
                () => {
                    this.#emit('rate-limited', item);
                    rateLimited = true;
                }
            );
        }

        const startedAt = Date.now();

        this.#emit('processing', { ...item, startedAt, rateLimited });

        const [,err] = await attempt(
            () => this.opts.process(item.data as EventData<S, E>)
        );

        const elapsed = Date.now() - startedAt;

        if (err) {

            this.#emit('error', { ...item, error: err, rateLimited });
        }
        else {

            this.#emit('success', { ...item, startedAt, elapsed, rateLimited });
        }

        if (this.#queue.length === 0 && this.#state.is('running')) {

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
    }

    /**
     * Processes a batch of items from the queue, and then
     * calls the before and after functions. Returns the
     * number of items processed.
     */
    async #processBatch(limit = Infinity, beforeFn?: Function, afterFn?: Function) {

        const items = this.#queue.splice(0, limit);
        let count = items.length;

        if (count !== 0) {

            beforeFn?.(count);

            let next = () => items.shift()!;

            if (this.opts.type === 'lifo') {
                next = () => items.pop()!;
            }

            while (items.length) {

                await this.#processNext(next());
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

        const count = this.#queue.length;
        this.#queue.length = 0;

        this.#emit('purged', { count });

        return count;
    }

    /**
     * Emit an event to the observer, which then gets
     * picked up by the queue and processed.
     */
    add(data: EventData<S, E>) {

        if (!this.#state.is('running', 'paused')) {

            this.#emit('rejected', { data, reason: QueueRejectionReason.notRunning });

            return false;
        }

        if (this.#queue.length >= this.opts.maxQueueSize!) {

            this.#emit('rejected', { data, reason: QueueRejectionReason.full });

            return false;
        }

        this.opts.observer.emit(this.opts.event, data);

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
        listener: ((payload: QueueEvents<S, E>[K]) => void)
    ): ObserverEngine.Cleanup;

    on<K extends keyof QueueEvents<S, E>>(
        event: K
    ): EventGenerator<QueueEvents<S, E>, K>;

    on<K extends keyof QueueEvents<S, E>>(
        event: K,
        listener?: ((payload: QueueEvents<S, E>[K]) => void) | undefined
    ): ObserverEngine.Cleanup | EventGenerator<QueueEvents<S, E>, K> {

        return this.#observerForQueue().on(
            `queue:${this.name}:${event}` as unknown as K,
            listener as ObserverEngine.EventCallback<QueueEvents<S, E>[K]>
        );
    }

    once<K extends keyof QueueEvents<S, E>>(
        event: K
    ): EventPromise<QueueEvents<S, E>[K]>;

    once<K extends keyof QueueEvents<S, E>>(
        event: K,
        listener: ((payload: QueueEvents<S, E>[K]) => void)
    ): ObserverEngine.Cleanup

    once<K extends keyof QueueEvents<S, E>>(
        event: K,
        listener?: ((payload: QueueEvents<S, E>[K]) => void)
    ): EventPromise<QueueEvents<S, E>[K]> | ObserverEngine.Cleanup {

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

        return this.#queue.length;
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
            activeRunners: this.#activeRunners,
            isIdle: this.isIdle,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            isStopped: this.isStopped,
            isDraining: this.isDraining,
            isEmpty: this.pending === 0,
        }
    }

}
