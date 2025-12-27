import {
    describe,
    it,
    afterEach,
    afterAll,
    beforeAll,
    expect,
    vi
} from 'vitest'


import { wait, attempt, noop, attemptSync, isAssertError } from '../../../packages/utils/src/index.ts';
import { ObserverEngine, EventQueue, QueueOpts, InternalQueueEvent } from '../../../packages/observer/src/index.ts';

import { sandbox, runTimers } from '../_helpers.ts';

describe('@logosdx/observer: Queues', async function () {

    const timeout = 1000;
    const observer = new ObserverEngine();
    const _queues = new Set<EventQueue<any, any>>();

    const makeQueue = (evName: string | RegExp, cb: (...args: any[]) => void, opts: QueueOpts) => {

        const queue = observer.queue(evName, cb, opts);

        _queues.add(queue);

        return queue
    }

    beforeAll(() => {

        vi.useFakeTimers({
            toFake: [
                'setTimeout',
                'setInterval',
                'Date',
            ]
        });
    });

    afterAll(() => {

        vi.useRealTimers();

        for (const queue of _queues) {

            queue.shutdown(true);
        }

        _queues.clear();
    })

    afterEach(async () => {

        const [, err] = await attempt(
            async () => {

                for (const queue of _queues) {
                    queue.shutdown(true);

                    _queues.delete(queue);
                }

                observer.clear();
            }
        )

        if (err) {
            console.error(err);

            throw err;
        }
    });

    describe('basic behavior', { timeout }, async () => {

        it('should throw on invalid options', { timeout }, async () => {

            const confs = [
                null, [], new Map(), new Set(),
                'string', 1e2, true,
                {},
                { name: 1234 },
                { name: '' },
                { name: 'ok', maxQueueSize: 0 },
                { name: 'ok', pollIntervalMs: 0 },
                { name: 'ok', jitterFactor: -1 },
                { name: 'ok', jitterFactor: 2 },
                { name: 'ok', rateLimitCapacity: 0 },
                { name: 'ok', rateLimitIntervalMs: 0 },
                { name: 'ok', type: 0 },
                { name: 'ok', type: 'invalid' },
                { name: 'ok', autoStart: 0 },
                { name: 'ok', autoStart: 'yes' },
                { name: 'ok', autoStart: 'yes' },
            ];

            for (const conf of confs) {

                const [, err] = attemptSync(() => {

                    observer.queue('test', noop, conf as QueueOpts);
                });

                expect(isAssertError(err)).to.be.true;
            }

            const args = [
                [null, noop],
                [true, noop],
                ['', noop],
                [1234, noop],
                ['good', null],
                ['good', {}],
                ['good', ''],
                ['good', true],
                ['good', 1234],
            ]

            for (const [event, process] of args) {

                const [, err] = attemptSync(() => {

                    observer.queue(
                        event as any,
                        process as any,
                        { name: 'ok' });
                });

                expect(isAssertError(err)).to.be.true;
            }

        });

        it('should create a queue', { timeout }, async () => {

            const fake = sandbox.spy();

            const queue = makeQueue(
                'test',
                (data) => fake(data),
                {
                    name: 'testQueue',
                    concurrency: 1,
                }
            );

            const onceTest1 = queue.once('success');

            // with queue.emit
            queue.add('a');

            vi.runAllTimers();
            await onceTest1;
            const onceTest2 = queue.once('success');

            // with observer.emit
            observer.emit('test', 'b');

            vi.runAllTimers();
            await onceTest2;

            expect(fake.callCount).to.eq(2);
            expect(fake.args[0]?.[0]).to.eq('a');
            expect(fake.args[1]?.[0]).to.eq('b');
        });

        it('should process no more than concurrency items in parallel', { timeout }, async () => {

            const fake = sandbox.spy(() => wait(10));

            const queue = makeQueue(
                'concurrencyTest',
                fake,
                {
                    name: 'concurrencyTest',
                    concurrency: 3,
                    pollIntervalMs: 1,
                }
            );

            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((i) => queue.add(i));

            // Allow initial debounce and first batch processing
            await runTimers(10);

            expect(queue.snapshot.activeRunners).to.eq(3);
            expect(queue.snapshot.pending).to.eq(7);
            expect(fake.callCount).to.eq(3);

            await runTimers(10);

            expect(queue.snapshot.activeRunners).to.eq(3);
            expect(queue.snapshot.pending).to.eq(4);
            expect(fake.callCount).to.eq(6);

            await runTimers(10);

            expect(queue.snapshot.activeRunners).to.eq(3);
            expect(queue.snapshot.pending).to.eq(1);
            expect(fake.callCount).to.eq(9);

            await runTimers(10);

            expect(queue.snapshot.activeRunners).to.eq(3);
            expect(queue.snapshot.pending).to.eq(0);
            expect(fake.callCount).to.eq(10);

        });

        it('should create a lifo queue', { timeout }, async () => {
            const result: string[] = [];

            const queue = makeQueue(
                'test',
                (data) => result.push('lifo:' + data),
                {
                    name: 'lifoQueue',
                    type: 'lifo',
                }
            );

            const onceIdle = queue.once('idle');

            queue.add('1');
            queue.add('2');

            await runTimers(10, 10);
            await onceIdle;

            expect(result).to.eql(['lifo:2', 'lifo:1']);
        });

        it('should create a fifo queue', { timeout }, async () => {
            const result: string[] = [];

            const queue = makeQueue(
                'test',
                (d) => result.push('fifo:' + d),
                {
                    name: 'fifoQueue',
                    type: 'fifo',
                    concurrency: 1,
                }
            );

            const onceIdle = queue.once('idle');

            queue.add('1');
            queue.add('2');

            await runTimers(10, 10);
            await onceIdle;

            expect(result).to.eql(['fifo:1', 'fifo:2']);
        });

        it('should calculate stats and get a snapshot', { timeout }, async () => {

            const proccess = (i: number) => {

                if (i % 4 === 0) {
                    throw new Error('test');
                }

                return wait(10);
            }
            const queue = makeQueue(
                'statsTest',
                proccess,
                {
                    name: 'statsTest',
                    concurrency: 3,
                    pollIntervalMs: 1,
                    maxQueueSize: 10,
                }
            );

            const onceIdle = queue.once('idle');

            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].forEach((i) => queue.add(i));

            await runTimers(10, 10);
            await onceIdle;

            const snapshot = queue.snapshot;
            const stats = queue.stats;

            expect(snapshot.activeRunners).to.eq(3);
            expect(snapshot.pending).to.eq(0);
            expect(snapshot.stats).to.deep.eq(stats);
            expect(stats.processed).to.eq(10);
            expect(stats.success).to.eq(8);
            expect(stats.error).to.eq(2);
            expect(stats.rejected).to.eq(3);
            expect(stats.avgProcessingTime).to.eq(10);

            expect(snapshot.isRunning).to.be.true;
            expect(snapshot.isIdle).to.be.true;
            expect(snapshot.isEmpty).to.be.true;
            expect(snapshot.isPaused).to.be.false;
            expect(snapshot.isStopped).to.be.false;
            expect(snapshot.isDraining).to.be.false;
        });

        it('should add items with priority', { timeout }, async () => {

            const fake = sandbox.spy(
                (i: string) => wait(10, i)
            );

            const queue = makeQueue(
                'priorityTest',
                fake,
                {
                    name: 'priorityTest',
                    type: 'fifo',
                    concurrency: 1,
                    pollIntervalMs: 1,
                    processIntervalMs: 1,
                }
            );

            const onceIdle = queue.once('idle');

            queue.add('a', 3);
            queue.add('b', 2);
            queue.add('c', 1);
            queue.add('d', 1);

            await runTimers(10, 10);

            await onceIdle;

            expect(fake.callCount).to.eq(4);
            expect(fake.args[0]?.[0]).to.eq('c');
            expect(fake.args[1]?.[0]).to.eq('d');
            expect(fake.args[2]?.[0]).to.eq('b');
            expect(fake.args[3]?.[0]).to.eq('a');
        });
    });

    describe('backpressure & limits', { timeout }, async () => {

        it('should reject items when full', async () => {

            const queue = makeQueue(
                'rejectTest',
                async () => wait(10),
                {
                    name: 'rejectQueue',
                    maxQueueSize: 1,
                }
            );

            const rejected = queue.once('rejected');

            queue.add('1');
            queue.add('2'); // should be rejected, does not throw

            await runTimers(10, 3);

            const { data } = (await rejected).data; // emits rejected event

            expect(data).to.eq('2');
        });

        it('should obey rate limits', { timeout }, async () => {

            const calls: string[] = [];
            let rateLimited = false;

            const waitTime = 10;
            const pollIntervalMs = 1;
            const rateLimitIntervalMs = 100; // means 1 every 10ms (100ms / 10 calls)

            const queue = makeQueue(
                'rate-limit',
                (data) => (
                    wait(waitTime).then(
                        () => calls.push(data)
                    )
                ),
                {
                    name: 'rateQueue',
                    rateLimitCapacity: 1,
                    rateLimitIntervalMs,
                    pollIntervalMs,
                }
            );

            observer.once(
                'queue:rateQueue:rate-limited',
                () => rateLimited = true
            );

            queue.add('A');
            queue.add('B'); // rate limit hit

            const onceRateLimited = queue.once('rate-limited');
            const onceIdle = queue.once('idle');

            await runTimers(waitTime, 2);

            expect(calls).to.include('A');
            expect(calls).to.not.include('B');

            await runTimers(rateLimitIntervalMs, 2);

            await onceRateLimited;
            await onceIdle;

            expect(calls).to.include('A');
            expect(calls).to.include('B');
            expect(rateLimited).to.be.true;

        });

        it('should delay processing when idle', async () => {

            const pollIntervalMs = 20;
            const waitTime = 10;
            const jitterFactor = 0.1;

            const fake = sandbox.spy(() => wait(waitTime));

            const queue = makeQueue(
                'idleTest',
                fake,
                {
                    name: 'idleQueue',
                    pollIntervalMs,
                    jitterFactor,
                }
            );

            let onceIdle = queue.once('idle');

            queue.add(1);

            expect(fake.callCount).to.eq(0);

            // 20ms * 0.1 poll, 10ms wait
            // 11 * 3 = 33ms
            await runTimers(11, 3);
            await onceIdle;

            expect(fake.callCount).to.eq(1);
            onceIdle = queue.once('idle');

            queue.add(5);
            expect(fake.callCount).to.eq(1);

            // 20ms * 0.1 poll
            // Previous call might have finished early,
            // so we must compensate by waiting -1 ms
            await runTimers(19);
            expect(fake.callCount).to.eq(1);

            await runTimers(10, 2);
            expect(fake.callCount).to.eq(2);

            await onceIdle;
            onceIdle = queue.once('idle');

            queue.add('3');

            await runTimers(11, 3); // 11ms * 3 = 33ms
            await onceIdle;

            expect(queue.snapshot.stats.processed).to.eq(3);

        });

        it('should pause between items for processIntervalMs', async () => {

            const processIntervalMs = 20;
            const waitTime = 10;
            const pollIntervalMs = 10;

            const fake = sandbox.spy(() => wait(waitTime));

            const queue = makeQueue(
                'intervalTest',
                fake,
                {
                    name: 'intervalTest',
                    processIntervalMs,
                    pollIntervalMs,
                    autoStart: false,
                }
            );

            await queue.start();
            const onceIdle = queue.once('idle');

            queue.add('1');
            queue.add('2');

            expect(fake.callCount).to.eq(0);
            expect(queue.snapshot.isWaiting).to.be.true;

            await runTimers(pollIntervalMs - 1);
            expect(fake.callCount).to.eq(0);

            await runTimers(1);
            expect(queue.snapshot.isWaiting).to.be.false;

            expect(fake.callCount).to.eq(1);
            expect(queue.snapshot.stats.processing).to.eq(1);
            expect(queue.snapshot.pending).to.eq(1);

            await runTimers(waitTime);
            expect(fake.callCount).to.eq(1);
            expect(queue.snapshot.stats.processing).to.eq(0);
            expect(queue.snapshot.pending).to.eq(1);

            await runTimers(processIntervalMs - 1);
            expect(fake.callCount).to.eq(1);
            expect(queue.snapshot.stats.processed).to.eq(1);
            expect(queue.snapshot.pending).to.eq(1);

            await runTimers(1);
            expect(fake.callCount).to.eq(2);
            expect(queue.snapshot.stats.processing).to.eq(1);
            expect(queue.snapshot.pending).to.eq(0);

            await runTimers([waitTime, processIntervalMs]);
            await onceIdle;

            queue.add('3');
            queue.add('4');

            expect(fake.callCount).to.eq(2);

            await runTimers(pollIntervalMs - 1);
            expect(fake.callCount).to.eq(2);

            await runTimers(1);
            expect(fake.callCount).to.eq(3);
            expect(queue.snapshot.stats.processing).to.eq(1);
            expect(queue.snapshot.stats.processed).to.eq(2);
            expect(queue.snapshot.pending).to.eq(1);

            await runTimers(waitTime);
            expect(fake.callCount).to.eq(3);
            expect(queue.snapshot.stats.processing).to.eq(0);
            expect(queue.snapshot.stats.processed).to.eq(3);
            expect(queue.snapshot.pending).to.eq(1);

            await runTimers(processIntervalMs - 1);
            expect(fake.callCount).to.eq(3);
            expect(queue.snapshot.stats.processing).to.eq(0);
            expect(queue.snapshot.stats.processed).to.eq(3);
            expect(queue.snapshot.pending).to.eq(1);

            await runTimers(1);
            expect(fake.callCount).to.eq(4);
            expect(queue.snapshot.stats.processing).to.eq(1);
            expect(queue.snapshot.stats.processed).to.eq(3);
            expect(queue.snapshot.pending).to.eq(0);

            await runTimers([waitTime, processIntervalMs]);
            expect(queue.snapshot.stats.processing).to.eq(0);
            expect(queue.snapshot.stats.processed).to.eq(4);
            expect(queue.snapshot.pending).to.eq(0);
        });

        it('should timeout when process takes too long', { timeout }, async () => {

            const queue = makeQueue(
                'timeoutTest',
                async () => wait(100),
                {
                    name: 'timeoutTest',
                    taskTimeoutMs: 30,
                    pollIntervalMs: 1,
                }
            );

            const onceError = queue.once('error');

            queue.add('a');
            queue.add('b');

            // Advance time to trigger timeout
            await runTimers(15, 3);

            const { error } = (await onceError).data;

            expect(error).to.be.an('error');
            expect(error.message).to.eq('Task timed out');
        });
    });


    describe('lifecycle behavior', { timeout: 5000 }, async () => {

        it('should not process while paused', { timeout }, async () => {

            const fake = sandbox.stub();

            const queue = makeQueue(
                'pauseTest',
                fake,
                {
                    name: 'pauseTest',
                    concurrency: 1,
                }
            );

            queue.pause();

            expect(queue.state).to.eq('paused');

            const idle = queue.once('idle');

            // Add items to the queue, but they should not be processed;
            // they also should not be rejected.
            queue.add('a');
            queue.add('b');
            queue.add('c');

            // It will never hit idle because it's not processing.
            // Instead, it will timeout.
            const timeoutPromise = Promise.race([
                idle,
                wait(100, 'timeout')
            ]);

            await runTimers(34, 3);

            const timeout = await timeoutPromise;

            expect(timeout).to.eq('timeout');

            // Now it will process the items.
            queue.resume();

            expect(queue.state).to.eq('running');

            // Now it will hit idle.
            await idle;

            expect(fake.callCount).to.eq(3);
        });

        it('should not process when stopped', { timeout }, async () => {

            const fake = sandbox.stub();

            const queue = makeQueue(
                'stopTest',
                fake,
                {
                    name: 'stopTest',
                    autoStart: false,
                    pollIntervalMs: 1,
                }
            );

            expect(queue.state).to.eq('stopped');

            queue.add('a');

            expect(queue.pending).to.eq(0);
            expect(fake.callCount).to.eq(0);

            queue.start();

            expect(queue.state).to.eq('running');

            const onceIdle = queue.once('idle');

            queue.add('b');
            queue.add('c');

            expect(queue.pending).to.eq(2);

            await runTimers(10, 3);

            await onceIdle;

            expect(queue.pending).to.eq(0);
            expect(fake.callCount).to.eq(2);

            queue.stop();

            expect(queue.state).to.eq('stopped');

            queue.add('d');

            expect(queue.pending).to.eq(0);
            expect(fake.callCount).to.eq(2);
        });

        it('should emit lifecycle events', { timeout: 1000 }, async () => {

            const pollIntervalMs = 1;
            const rateLimitIntervalMs = 10;
            const waitTime = 5;

            const process = (i: number) => {
                if (i % 4 === 0) {
                    throw new Error('test');
                }
                return wait(waitTime);
            }

            const queue = makeQueue(
                'lifecycleTest',
                process,
                {
                    name: 'lifecycleTest',
                    autoStart: false,
                    concurrency: 1,
                    pollIntervalMs,
                    maxQueueSize: 4,
                    rateLimitCapacity: 1,
                    rateLimitIntervalMs,
                }
            );

            const onceAdded = queue.once('added');
            const onceIdle = queue.once('idle');
            const onceEmpty = queue.once('empty');
            const onceProcessing = queue.once('processing');
            const onceSuccess = queue.once('success');
            const onceError = queue.once('error');
            const onceRejected = queue.once('rejected');
            const onceRateLimited = queue.once('rate-limited');

            const onceStart = queue.once('start');
            const onceStarted = queue.once('started');
            const oncePaused = queue.once('paused');
            const onceResumed = queue.once('resumed');
            const onceStopped = queue.once('stopped');
            const onceFlush = queue.once('flush');
            const onceFlushed = queue.once('flushed');
            const onceDrain = queue.once('drain');
            const onceDrained = queue.once('drained');
            const onceShutdown = queue.once('shutdown');

            queue.start();
            const startPayload = await onceStart;
            const startedPayload = await onceStarted;

            queue.pause();
            const pausedPayload = await oncePaused;

            queue.resume();
            const resumedPayload = await onceResumed;

            queue.add('a');
            const addedPayload = await onceAdded;

            await runTimers(pollIntervalMs);
            const processingPayload = await onceProcessing;

            await runTimers(waitTime);
            const successPayload = await onceSuccess;

            [1, 2, 3, 4, 5].forEach((i) => queue.add(i));

            await runTimers([waitTime, rateLimitIntervalMs], 5);

            const errorPayload = await onceError;
            const rejectedPayload = await onceRejected;
            const rateLimitedPayload = await onceRateLimited;
            const emptyPayload = await onceEmpty;
            const idlePayload = await onceIdle;

            [1, 2, 3].forEach((i) => queue.add(i));

            const flushPromise = queue.flush();

            await runTimers([waitTime, rateLimitIntervalMs], 3);

            const flushPayload = await onceFlush;
            const flushedPayload = await onceFlushed;

            const flushedTotal = await flushPromise;

            queue.add('b');

            const drainPromise = queue.shutdown();

            const drainPayload = await onceDrain;

            expect(queue.state).to.eq('draining');

            await runTimers([waitTime], 3);

            const drainedPayload = await onceDrained;
            const stoppedPayload = await onceStopped;
            const shutdownPayload = await onceShutdown;

            const drainedTotal = await drainPromise;

            expect(queue.state).to.eq('stopped');

            const onceStarted2 = queue.once('started');

            queue.start();
            await onceStarted2;

            [1, 2, 3, 4, 5].forEach((i) => queue.add(i));

            const onceShutdown2 = queue.once('shutdown');
            const oncePurged = queue.once('purged');
            const shutdownPromise = queue.shutdown(true);

            const shutdownPayload2 = await onceShutdown2;
            const shutdownTotal2 = await shutdownPromise;
            const purgedPayload = await oncePurged;

            const emptyPayloads = [
                startPayload,
                startedPayload,
                pausedPayload,
                resumedPayload,
                emptyPayload,
                idlePayload,
                stoppedPayload,
            ];

            // Queue events are wrapped in InternalQueueEvent; void events have .data === undefined
            for (const payload of emptyPayloads) {
                const wrapped = payload as unknown as InternalQueueEvent;
                expect(wrapped).to.be.instanceOf(InternalQueueEvent);
                expect(wrapped.data).to.eq(undefined);
            }

            const idPayloads = [
                addedPayload,
                processingPayload,
                successPayload,
                errorPayload,
                rateLimitedPayload,
            ];

            for (const payload of idPayloads) {
                expect(payload.data._taskId).to.be.a('string');
            }

            const dataPayloads = [
                addedPayload,
                processingPayload,
                successPayload,
                errorPayload,
                rejectedPayload,
                rateLimitedPayload,
            ];

            for (const payload of dataPayloads) {
                expect(payload.data.data).to.exist;
            }

            const rateLimitedPayloads = [

                processingPayload,
                successPayload,
                errorPayload,
            ]

            for (const payload of rateLimitedPayloads) {
                expect(payload.data.rateLimited).to.be.a('boolean');
            }

            expect(errorPayload.data.error).to.be.an('error');
            expect(rejectedPayload.data.reason).to.be.a('string');

            expect(processingPayload.data.startedAt).to.be.a('number');
            expect(successPayload.data.startedAt).to.be.a('number');
            expect(successPayload.data.elapsed).to.be.a('number');

            expect(flushPayload.data.pending).to.eq(flushedTotal);
            expect(flushedPayload.data.flushed).to.eq(flushedTotal);

            expect(drainedPayload.data.drained).to.be.a('number');
            expect(drainedPayload.data.drained).to.eq(drainedTotal);

            expect(drainPayload.data.pending).to.be.a('number');
            expect(drainPayload.data.pending).to.eq(drainedTotal);

            expect(shutdownPayload.data.force).to.be.a('boolean');
            expect(shutdownPayload.data.force).to.be.false;
            expect(shutdownPayload2.data.force).to.be.true;
            expect(shutdownPayload2.data.pending).to.be.a('number');
            expect(shutdownPayload2.data.pending).to.eq(shutdownTotal2);

            expect(purgedPayload.data.count).to.be.a('number');
            expect(purgedPayload.data.count).to.eq(shutdownTotal2);

        });

        it('should not start multiple runners on repeated start() or resume()', { timeout }, async () => {

            const fake = sandbox.spy(() => wait(10));

            const queue = makeQueue(
                'ghostRunnerTest',
                fake,
                {
                    name: 'ghostRunnerTest',
                    autoStart: false,
                    concurrency: 1,
                    pollIntervalMs: 1,
                }
            );

            const onceStarted = queue.once('started');

            queue.start();
            await onceStarted;

            [1, 2, 3, 4, 5, 6].forEach((i) => queue.add(i));
            queue.start();

            await runTimers(10, 3);

            expect(fake.callCount).to.eq(3);
            expect(queue.snapshot.activeRunners).to.eq(1);


            const oncePaused1 = queue.once('paused');
            const onceSuccess = queue.once('success');

            queue.pause();

            await runTimers(10);

            await oncePaused1;
            await onceSuccess;

            await runTimers(10, 3);
            expect(queue.snapshot.activeRunners).to.eq(0);

            queue.resume();

            // it'll pick up the next item
            await runTimers(10);
            expect(queue.snapshot.activeRunners).to.eq(1);

            const oncePaused2 = queue.once('paused');

            queue.pause();
            await oncePaused2;

            expect(fake.callCount).to.eq(4);
            expect(queue.snapshot.activeRunners).to.eq(1);

            queue.resume();

            // 1 ghost runner that's finishing processing
            // + 1 new runner
            expect(queue.snapshot.activeRunners).to.eq(2);

            // Let the first one die off
            await runTimers(10);
            expect(queue.snapshot.activeRunners).to.eq(1);

            const onceIdle = queue.once('idle');

            await runTimers(10, 2);

            await onceIdle;

            expect(fake.callCount).to.eq(6);
        });

        it('should allow stop → start safely', { timeout }, async () => {

            const fake = sandbox.stub();

            const queue = makeQueue(
                'startTest',
                fake,
                {
                    name: 'startTest',
                    autoStart: false,
                    concurrency: 1,
                    pollIntervalMs: 1,
                }
            );

            const onceStarted = queue.once('started');
            const onceSuccess1 = queue.once('success');

            queue.start();
            await onceStarted;

            queue.add('a');

            expect(queue.state).to.eq('running');
            expect(queue.pending).to.eq(1); // 1 item was added

            await runTimers(1);

            await onceSuccess1;

            expect(fake.callCount).to.eq(1); // 1 item was processed

            const onceStopped = queue.once('stopped');

            queue.stop();
            await onceStopped;

            expect(queue.state).to.eq('stopped');

            queue.add('b');

            expect(queue.state).to.eq('stopped');
            expect(queue.pending).to.eq(0); // no items were added
            expect(fake.callCount).to.eq(1); // no items were processed

            const onceSuccess2 = queue.once('success');

            queue.start();
            queue.add('b');
            expect(queue.pending).to.eq(1); // 1 item was added

            await runTimers(1);
            await onceSuccess2;

            expect(queue.state).to.eq('running');
            expect(fake.callCount).to.eq(2); // 1 item was processed

            const onceStopped2 = queue.once('stopped');

            queue.stop();
            await onceStopped2;

            expect(queue.state).to.eq('stopped');
            expect(queue.pending).to.eq(0);
            expect(fake.callCount).to.eq(2);
        });

        it('should shutdown gracefully and in order', { timeout }, async () => {

            const args = ['lifo', 'fifo'].map(async (type) => {

                const fake = sandbox.spy(() => wait(10));
                const queue = makeQueue(
                    'shutdownTest',
                    fake,
                    {
                        name: 'shutdownTest',
                        type: type as 'lifo' | 'fifo',
                        concurrency: 1,
                        pollIntervalMs: 1,
                    }
                );

                [1, 2, 3, 4, 5, 6].forEach((i) => queue.add(i));

                expect(fake.callCount).to.eq(0);

                const onceShutdown = queue.once('shutdown');

                const drainedPromise = queue.shutdown();

                await runTimers(10, 6);

                await onceShutdown;
                const drained = await drainedPromise;

                expect(drained).to.eq(6); // Everything was processed
                expect(fake.callCount).to.eq(6);

                return fake.args as unknown as [number[]];
            });

            const [lifo, fifo] = await Promise.all(args);

            [6, 5, 4, 3, 2, 1].forEach((a, i) => {
                expect(lifo![i]?.[0 as never], `lifo item ${i}`).to.eq(a);
            });

            [1, 2, 3, 4, 5, 6].forEach((a, i) => {
                expect(fifo![i]?.[0 as never], `fifo item ${i}`).to.eq(a);
            });
        });

        it('should force shutdown with shutdown(true)', { timeout }, async () => {

            const fake = sandbox.spy(() => wait(100));

            const queue = makeQueue(
                'shutdownTest',
                fake,
                {
                    name: 'shutdownTest',
                    concurrency: 1,
                    pollIntervalMs: 1,
                }
            );

            [1, 2, 3, 4, 5, 6].forEach((i) => queue.add(i));

            expect(fake.callCount).to.eq(0);


            const onceShutdown = queue.once('shutdown');

            const shutdownPromise = queue.shutdown(true);

            await runTimers(11, 6);
            const pending = await shutdownPromise;

            await onceShutdown;

            expect(pending).to.eq(6); // Everything was ignored
            expect(fake.callCount).to.eq(0);
        });

        it('should flush the queue and keep processing in the meantime', { timeout }, async () => {

            const fake = sandbox.spy(() => wait(10));

            const queue = makeQueue(
                'flushTest',
                fake,
                {
                    name: 'flushTest',
                    concurrency: 1,
                    pollIntervalMs: 1,
                    maxQueueSize: 10,
                    rateLimitCapacity: 1,
                    rateLimitIntervalMs: 10,
                }
            );

            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((i) => queue.add(i));

            expect(fake.callCount).to.eq(0);

            const onceFlush = queue.once('flush');
            const onceFlushed = queue.once('flushed');

            const flushPromise = queue.flush(5);

            expect(queue.snapshot.pending).to.eq(5);

            [11, 12, 13, 14, 15].forEach((i) => queue.add(i));

            expect(queue.snapshot.pending).to.eq(10);

            await runTimers(1);
            await runTimers(10, 9);

            const flushPayload = await onceFlush;
            const flushedPayload = await onceFlushed;
            const flushedTotal = await flushPromise;

            expect(flushPayload.data.pending).to.eq(5);
            expect(flushedPayload.data.flushed).to.eq(5);
            expect(flushedTotal).to.eq(5);

        });
    });

    describe('regex event queues', { timeout }, async () => {

        it('should create a queue with a regex event', { timeout }, async () => {

            const fake = sandbox.spy();

            const queue = makeQueue(
                /^user:/,
                (data) => fake(data),
                {
                    name: 'regexQueue',
                    concurrency: 1,
                }
            );

            const onceSuccess = queue.once('success');

            observer.emit('user:login', { userId: 123 });

            vi.runAllTimers();
            await onceSuccess;

            // Regex queues receive { event, data, listener } from observer
            expect(fake.callCount).to.eq(1);
            expect(fake.args[0]?.[0].event).to.eq('user:login');
            expect(fake.args[0]?.[0].data).to.deep.eq({ userId: 123 });
            expect(fake.args[0]?.[0].listener).to.be.a('function');
        });

        it('should not cause infinite recursion with /./  regex', { timeout }, async () => {

            // This test verifies that queue internal events (queue:name:added, etc.)
            // do not trigger the queue's own regex listener, which would cause
            // infinite recursion and stack overflow.

            const fake = sandbox.spy();

            const queue = makeQueue(
                /./,
                (data) => fake(data),
                {
                    name: 'dotRegexQueue',
                    concurrency: 1,
                    pollIntervalMs: 1,
                }
            );

            const onceSuccess = queue.once('success');

            // Emit an event that matches the regex
            observer.emit('test-event', 'hello');

            await runTimers(10, 3);
            await onceSuccess;

            // Should process exactly one event, not infinite
            expect(fake.callCount).to.eq(1);
            expect(fake.args[0]?.[0].event).to.eq('test-event');
            expect(fake.args[0]?.[0].data).to.eq('hello');
        });

        it('should not cause infinite recursion with /.+/ regex', { timeout }, async () => {

            const fake = sandbox.spy();

            const queue = makeQueue(
                /.+/,
                (data) => fake(data),
                {
                    name: 'plusRegexQueue',
                    concurrency: 1,
                    pollIntervalMs: 1,
                }
            );

            const onceIdle = queue.once('idle');

            observer.emit('my-event', 'world');
            observer.emit('another-event', 'foo');

            await runTimers(10, 5);
            await onceIdle;

            // Should process exactly two events, not infinite
            expect(fake.callCount).to.eq(2);
        });

        it('should not match queue internal events with broad regex', { timeout }, async () => {

            // This test verifies that events like queue:name:added are filtered out

            const fake = sandbox.spy();
            const internalEvents: string[] = [];

            // Track all events the observer sees
            observer.on(/./, ({ event }) => {
                internalEvents.push(event);
            });

            const queue = makeQueue(
                /.*/,
                (data) => fake(data),
                {
                    name: 'broadQueue',
                    concurrency: 1,
                    pollIntervalMs: 1,
                }
            );

            const onceSuccess = queue.once('success');

            observer.emit('external-event', 'data');

            await runTimers(10, 3);
            await onceSuccess;

            // Verify internal queue events were emitted
            const hasInternalEvents = internalEvents.some(
                e => e.startsWith('queue:broadQueue:')
            );

            expect(hasInternalEvents).to.be.true;

            // But the queue should only process external events
            expect(fake.callCount).to.eq(1);
            expect(fake.args[0]?.[0].event).to.eq('external-event');
            expect(fake.args[0]?.[0].data).to.eq('data');
        });
    });

});



