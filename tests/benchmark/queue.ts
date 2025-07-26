import { describe, it, after, afterEach } from 'node:test'

import { expect } from 'chai';

import { attempt, throttle } from '../../packages/utils/src/index.ts';
import { ObserverEngine, EventQueue } from '../../packages/observer/src/index.ts';

describe('Queue: stress and memory leak tests', async () => {

    const observer = new ObserverEngine();
    const _queues = new Set<EventQueue<any, any>>();

    const makeQueue = (evName: string, cb: (...args: any[]) => void, opts: any) => {
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
                pollIntervalMs: 1,
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