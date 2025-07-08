import { describe, it, afterEach, after } from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import { wait, attempt, noop, attemptSync, isAssertError, throttle } from '../../../packages/utils/src/index.ts';
import { ObserverEngine, EventQueue, QueueOpts } from '../../../packages/observer/src/index.ts';

import { sandbox } from '../_helpers.ts';

const varianceMs = 5;
/**
 * Adjusts timing expectations to account for test execution variance.
 *
 * CPU scheduling and system load can cause timing-sensitive tests to fail
 * due to small delays. This helper adds/subtracts a variance buffer to
 * timing assertions to make tests more reliable.
 */
const withVariance = (ms: number, mod: 1 | -1 = 1) => ms + (varianceMs * mod);
const withVarArgs = (min: number, max: number = min): [number, number] => [withVariance(min, -1), withVariance(max + varianceMs)];

describe('@logosdx/observer', async function () {

    const timeout = 5000;
    const observer = new ObserverEngine();
    const _queues = new Set<EventQueue<any, any>>();

    const makeQueue = (evName: string, cb: (...args: any[]) => void, opts: QueueOpts) => {
        const queue = observer.queue(evName, cb, opts);

        _queues.add(queue);

        return queue
    }

    after(() => {

        for (const queue of _queues) {

            console.log('shutting down', queue.name);

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

    describe('Queue: basic behavior', { timeout }, async () => {

        it('should throw on invalid options', { timeout }, async () => {

            const confs = [
                null, [], new Map(), new Set(),
                'string', 1e2, true,
                {},
                { name: 1234 },
                { name: '' },
                { name: 'ok', maxQueueSize: 0 },
                { name: 'ok', debounceMs: 0 },
                { name: 'ok', jitter: -1 },
                { name: 'ok', jitter: 2 },
                { name: 'ok', rateLimitItems: 0 },
                { name: 'ok', rateLimitWindow: 0 },
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

            await onceTest1;
            const onceTest2 = queue.once('success');

            // with observer.emit
            observer.emit('test', 'b');
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
                    debounceMs: 1,
                }
            );

            [1,2,3,4,5,6,7,8,9,10].forEach((i) => queue.add(i));

            await wait(10);

            expect(queue.snapshot.activeRunners).to.eq(3);
            expect(queue.snapshot.pending).to.eq(7);
            expect(fake.callCount).to.eq(3);

            await wait(10);

            expect(queue.snapshot.activeRunners).to.eq(3);
            expect(queue.snapshot.pending).to.eq(4);
            expect(fake.callCount).to.eq(6);

            await wait(10);

            expect(queue.snapshot.activeRunners).to.eq(3);
            expect(queue.snapshot.pending).to.eq(1);
            expect(fake.callCount).to.eq(9);

            await wait(10);

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
                    debounceMs: 1,
                    maxQueueSize: 10,
                }
            );

            [1,2,3,4,5,6,7,8,9,10,11,12,13].forEach((i) => queue.add(i));

            await queue.once('idle');
            await wait(20);

            const snapshot = queue.snapshot;
            const stats = queue.stats;

            expect(snapshot.activeRunners).to.eq(3);
            expect(snapshot.pending).to.eq(0);
            expect(snapshot.stats).to.deep.eq(stats);
            expect(stats.processed).to.eq(10);
            expect(stats.success).to.eq(8);
            expect(stats.error).to.eq(2);
            expect(stats.rejected).to.eq(3);
            expect(stats.avgProcessingTime).to.be.within(10, 15);

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
                    processIntervalMs: 1,
                }
            );

            const onceIdle = queue.once('idle');

            queue.add('a', 3);
            queue.add('b', 2);
            queue.add('c', 1);
            queue.add('d', 1);

            await onceIdle;

            expect(fake.callCount).to.eq(4);
            expect(fake.args[0]?.[0]).to.eq('c');
            expect(fake.args[1]?.[0]).to.eq('d');
            expect(fake.args[2]?.[0]).to.eq('b');
            expect(fake.args[3]?.[0]).to.eq('a');
        });
    });

    describe('Queue: backpressure & limits', { timeout }, async () => {

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

            const { data } = await rejected; // emits rejected event

            expect(data).to.eq('2');
        });

        it('should obey rate limits', { timeout }, async () => {

            const calls: string[] = [];
            let rateLimited = false;

            const debounceMs = 1;
            const rateLimitWindow = 50;

            const queue = makeQueue(
                'rate-limit',
                (data) => calls.push(data),
                {
                    name: 'rateQueue',
                    rateLimitItems: 1,
                    rateLimitWindow,
                    debounceMs,
                }
            );

            observer.once(
                'queue:rateQueue:rate-limited',
                () => rateLimited = true
            );

            queue.add('A');
            queue.add('B'); // rate limit hit

            await queue.once('rate-limited');

            expect(calls).to.include('A');
            expect(calls).to.not.include('B');

            await queue.once('idle');

            expect(calls).to.include('A');
            expect(calls).to.include('B');
            expect(rateLimited).to.be.true;
        });

        it('should delay processing when rate-limited', async () => {

            const debounceMs = 1;
            const rateLimitWindow = 50;
            const waitTime = 10;

            // Time until the first rate limit hit
            const rateLimitHitsMs = waitTime + debounceMs;

            const rateLimitReleasedMs = rateLimitHitsMs + rateLimitWindow;

            const queue = makeQueue(
                'rate-limit',
                async () => wait(waitTime),
                {
                    name: 'rateQueue',
                    debounceMs,
                    rateLimitItems: 1,
                    rateLimitWindow,
                }
            );

            const onceRateLimited = queue.once('rate-limited');
            const onceEmpty = queue.once('empty');

            queue.add('1');
            queue.add('2');

            let lastTime = Date.now();

            const { data } = await onceRateLimited;

            expect(data).to.eq('2');

            const elapsed = Date.now() - lastTime;
            lastTime = Date.now();

            await onceEmpty;
            const elapsed2 = Date.now() - lastTime;

            expect(elapsed).to.be.within(...withVarArgs(rateLimitHitsMs));
            expect(elapsed2).to.be.within(...withVarArgs(rateLimitReleasedMs));
        });

        it('should delay processing when idle', async () => {

            const debounceMs = 20;
            const waitTime = 10;
            const jitter = 0.1;

            const minTime = (debounceMs * (1 + jitter)) + waitTime;

            // Two, because we're waiting for the queue to be empty
            // so it will loop twice while waiting for the next item
            // to be added.
            const maxTime = (minTime * 2) + waitTime;

            const queue = makeQueue(
                'idleTest',
                async () => wait(waitTime),
                {
                    name: 'idleQueue',
                    debounceMs,
                    jitter,
                }
            );

            const startTime = Date.now();
            queue.add('1');
            await queue.once('idle');

            const time1 = Date.now();
            queue.add('2');
            await queue.once('idle');

            const time2 = Date.now();
            queue.add('3');
            await queue.once('idle');

            const time3 = Date.now();

            expect(time1 - startTime).to.be.within(...withVarArgs(minTime, maxTime));
            expect(time2 - time1).to.be.within(...withVarArgs(minTime, maxTime));
            expect(time3 - time2).to.be.within(...withVarArgs(minTime, maxTime));
        });

        it('should pause between items for processIntervalMs', async () => {

            const processIntervalMs = 10;
            const waitTime = 10;
            const debounceMs = 1;

            const minTime = ((processIntervalMs + waitTime) * 2) + debounceMs;

            const queue = makeQueue(
                'intervalTest',
                async () => wait(waitTime),
                {
                    name: 'intervalTest',
                    processIntervalMs,
                    debounceMs,
                }
            );

            const times: number[] = [];

            queue.on('idle', () => {
                times.push(Date.now());
            });

            let now = Date.now();

            queue.add('1');
            queue.add('2');
            await queue.once('idle');
            queue.add('3');
            queue.add('4');
            await queue.once('idle');

            const [time1, time2] = times;

            expect(time1! - now).to.be.within(...withVarArgs(minTime));
            expect(time2! - time1!).to.be.within(...withVarArgs(minTime));
        });

        it('should timeout when process takes too long', async () => {

            const queue = makeQueue(
                'timeoutTest',
                async () => wait(100),
                {
                    name: 'timeoutTest',
                    timeoutMs: 30,
                }
            );

            const onceError = queue.once('error');

            queue.add('1');
            queue.add('2');

            const { error } = await onceError;

            expect(error).to.be.an('error');
            expect(error.message).to.eq('Task timed out');
        });
    });


    describe('Queue: lifecycle behavior', { timeout: 5000 }, async () => {

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
            const timeout = await Promise.race([
                idle,
                wait(100, 'timeout')
            ]);

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

            const queue = makeQueue('stopTest', fake, { name: 'stopTest', autoStart: false });

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

            const process = (i: number) => {
                if (i % 4 === 0) {
                    throw new Error('test');
                }
                return wait(5);
            }

            const queue = makeQueue(
                'lifecycleTest',
                process,
                {
                    name: 'lifecycleTest',
                    autoStart: false,
                    concurrency: 1,
                    debounceMs: 1,
                    maxQueueSize: 4,
                    rateLimitItems: 1,
                    rateLimitWindow: 10,
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
            const processingPayload = await onceProcessing;
            const successPayload = await onceSuccess;

            [1,2,3,4,5].forEach((i) => queue.add(i));

            const errorPayload = await onceError;
            const rejectedPayload = await onceRejected;
            const rateLimitedPayload = await onceRateLimited;
            const emptyPayload = await onceEmpty;
            const idlePayload = await onceIdle;

            [1,2,3].forEach((i) => queue.add(i));

            const flushPromise = queue.flush();
            const flushPayload = await onceFlush;
            const flushedPayload = await onceFlushed;

            const flushedTotal = await flushPromise;

            queue.add('b');

            const drainPromise = queue.shutdown();
            const drainPayload = await onceDrain;

            expect(queue.state).to.eq('draining');

            const drainedPayload = await onceDrained;
            const stoppedPayload = await onceStopped;
            const shutdownPayload = await onceShutdown;

            const drainedTotal = await drainPromise;

            expect(queue.state).to.eq('stopped');

            const onceStarted2 = queue.once('started');

            queue.start();
            await onceStarted2;

            [1,2,3,4,5].forEach((i) => queue.add(i));

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

            for (const payload of emptyPayloads) {
                expect(payload).to.eq(undefined);
            }

            const idPayloads = [
                addedPayload,
                processingPayload,
                successPayload,
                errorPayload,
                rateLimitedPayload,
            ];

            for (const payload of idPayloads) {
                expect(payload._taskId).to.be.a('string');
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
                expect(payload.data).to.exist;
            }

            const rateLimitedPayloads = [

                processingPayload,
                successPayload,
                errorPayload,
            ]

            for (const payload of rateLimitedPayloads) {
                expect(payload.rateLimited).to.be.a('boolean');
            }

            expect(errorPayload.error).to.be.an('error');
            expect(rejectedPayload.reason).to.be.a('string');

            expect(processingPayload.startedAt).to.be.a('number');
            expect(successPayload.startedAt).to.be.a('number');
            expect(successPayload.elapsed).to.be.a('number');

            expect(flushPayload.pending).to.eq(flushedTotal);
            expect(flushedPayload.flushed).to.eq(flushedTotal);

            expect(drainedPayload.drained).to.be.a('number');
            expect(drainedPayload.drained).to.eq(drainedTotal);

            expect(drainPayload.pending).to.be.a('number');
            expect(drainPayload.pending).to.eq(drainedTotal);

            expect(shutdownPayload.force).to.be.a('boolean');
            expect(shutdownPayload.force).to.be.false;
            expect(shutdownPayload2.force).to.be.true;
            expect(shutdownPayload2.pending).to.be.a('number');
            expect(shutdownPayload2.pending).to.eq(shutdownTotal2);

            expect(purgedPayload.count).to.be.a('number');
            expect(purgedPayload.count).to.eq(shutdownTotal2);

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
                    debounceMs: 1,
                }
            );

            const onceStarted = queue.once('started');

            queue.start();
            await onceStarted;

            [1,2,3,4,5,6].forEach((i) => queue.add(i));
            queue.start();

            // 3 hits = hits ~0, 10, 20, finishes at ~30
            await wait(30); // should be 3 hits

            expect(fake.callCount).to.eq(3);
            expect(queue.snapshot.activeRunners).to.eq(1);

            const oncePaused1 = queue.once('paused');
            const onceSuccess = queue.once('success');

            queue.pause();
            await oncePaused1;
            await onceSuccess;

            // Let while loop finish
            await wait(10);
            expect(queue.snapshot.activeRunners).to.eq(0);

            queue.resume();

            // it'll pick up the next item
            await wait(10);
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
            await wait(10);
            expect(queue.snapshot.activeRunners).to.eq(1);

            const onceIdle = queue.once('idle');

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
                    debounceMs: 1,
                }
            );

            const onceStarted = queue.once('started');
            const onceSuccess1 = queue.once('success');

            queue.start();
            await onceStarted;

            queue.add('a');

            expect(queue.state).to.eq('running');
            expect(queue.pending).to.eq(1); // 1 item was added

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

            const args = ['lifo', 'fifo'].map(async(type) => {

                const fake = sandbox.spy(() => wait(10));
                const queue = makeQueue(
                    'shutdownTest',
                    fake,
                    {
                        name: 'shutdownTest',
                        type: type as 'lifo' | 'fifo',
                        concurrency: 1,
                        debounceMs: 1,
                    }
                );

                [1,2,3,4,5,6].forEach((i) => queue.add(i));

                expect(fake.callCount).to.eq(0);

                const onceShutdown = queue.once('shutdown');

                const drained = await queue.shutdown();

                await onceShutdown;

                expect(drained).to.eq(6); // Everything was processed
                expect(fake.callCount).to.eq(6);

                return fake.args as unknown as [number[]];
            });

            const [lifo, fifo] = await Promise.all(args);

            [6,5,4,3,2,1].forEach((a, i) => {
                expect(lifo![i]?.[0 as never], `lifo item ${i}`).to.eq(a);
            });

            [1,2,3,4,5,6].forEach((a, i) => {
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
                    debounceMs: 1,
                }
            );

            [1,2,3,4,5,6].forEach((i) => queue.add(i));

            expect(fake.callCount).to.eq(0);

            const onceShutdown = queue.once('shutdown');

            const pending = await queue.shutdown(true);

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
                    debounceMs: 1,
                    maxQueueSize: 10,
                    rateLimitItems: 1,
                    rateLimitWindow: 10,
                }
            );

            [1,2,3,4,5,6,7,8,9,10].forEach((i) => queue.add(i));

            expect(fake.callCount).to.eq(0);

            const onceFlush = queue.once('flush');
            const onceFlushed = queue.once('flushed');

            const flushPromise = queue.flush(5);

            expect(queue.snapshot.pending).to.eq(5);

            [11,12,13,14,15].forEach((i) => queue.add(i));

            expect(queue.snapshot.pending).to.eq(10);

            const flushPayload = await onceFlush;
            const flushedPayload = await onceFlushed;
            const flushedTotal = await flushPromise;

            expect(flushPayload.pending).to.eq(5);
            expect(flushedPayload.flushed).to.eq(5);
            expect(flushedTotal).to.eq(5);

        });
    });

    describe('Queue: stress and memory leak tests', async () => {

        it('should process 250,000 items x 5 rounds without memory leak', async () => {

            observer.clear();

            const items = 250_000;
            const rounds = 5
            const concurrency = 1;

            const log = (...args: any[]) => {
                if (process.env.CI) return;

                console.log('>>>>', ...args);
            }

            const getSnapshot = throttle(() => {
                log(
                    'pending:', queue.pending,
                    'running nodes:', queue.snapshot.runningNodes.size,
                    'ops/sec:', calculateRate(),
                );
            }, { delay: 500 });

            const queue = makeQueue(
                'fuzzTest',
                async () => getSnapshot(),
                {
                    name: 'fuzzTest',
                    concurrency,
                    debounceMs: 1,
                    autoStart: false,
                }
            );

            const startTime = Date.now();
            let processedCount = 0;

            // Track processing rate
            const calculateRate = () => {
                const elapsed = (Date.now() - startTime) / 1000; // seconds
                const rate = processedCount / elapsed;
                return Math.round(rate);
            };

            // Listen for successful processing to track count
            observer.on('queue:fuzzTest:success', () => {
                processedCount++;
            });

            // Force a garbage collection before we start
            await global.gc?.({ execution: 'async' });

            queue.start();

            const heapBefore = process.memoryUsage().heapUsed;
            log('run queue', 'start');

            const fullQueueHead: number[] = [];
            const emptyQueueHead: number[] = [];

            const runSample = async (round: number) => {

                log('run queue', 'sample', round + 1);

                for (let i = 0; i < items; i++) {
                    queue.add(i);
                }

                fullQueueHead.push(process.memoryUsage().heapUsed);

                expect(queue.pending).to.eq(items);

                await queue.once('idle');

                // Force a garbage collection after we've processed the items
                await global.gc?.({ execution: 'async' });

                emptyQueueHead.push(process.memoryUsage().heapUsed);
            }

            for (let i = 0; i < rounds; i++) {
                await runSample(i);
            }

            log('run queue', 'done', (Date.now() - startTime) / 1000, 'seconds');
            log(`Processed: ${processedCount}/${items} (${calculateRate()} items/sec)`);

            expect(queue.pending).to.eq(0);
            expect(queue.snapshot.runningNodes.size).to.eq(0);
            expect(queue.snapshot.activeRunners).to.eq(concurrency);
            expect(processedCount).to.eq(items * rounds);

            await queue.shutdown(); // Clear the queue

            await global.gc?.({ execution: 'async' });

            const heapAfter = process.memoryUsage().heapUsed;

            const delta = heapAfter - heapBefore;
            const toMb = (bytes: number) => Math.round(bytes / 1024 / 1024 * 100) / 100;

            // Visually inspect the heap usage
            log({
                delta: toMb(delta),
                heapBefore: toMb(heapBefore),
                heapAfter: toMb(heapAfter),
                heapRuns: fullQueueHead.map(toMb),
                heapEmpty: emptyQueueHead.map(toMb),
            })

            for (const heapSnapshot of fullQueueHead) {
                expect(toMb(heapSnapshot)).to.be.greaterThan(toMb(heapBefore));
                expect(toMb(heapSnapshot)).to.be.greaterThan(toMb(heapAfter));
            }

            /**
             * 5mb is the max memory delta we're willing to tolerate.
             *
             * We want to consider memory pressure placed by tests
             * overhead as well. In isolation, this test results in a
             * negative delta, but the whole test suite ramps up memory
             * usage, so we need to allow for that.
             *
             * The heap runs in the arrays above mark ~50mb memory usage
             * over the course of 5 rounds. If we're actually leaking,
             * we should see significant growth in memory usage.
             */
            expect(toMb(delta)).to.be.lessThan(5);
        });
    });
});



