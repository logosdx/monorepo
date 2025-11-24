/**
 * Scenario F: Batch & Retry
 *
 * Goal: Detect leaks from results accumulation and retry timer cleanup.
 *
 * What it does:
 * - Tests batch results array cleanup after completion
 * - Tests error accumulation in 'continue' failure mode
 * - Tests callback reference cleanup
 * - Tests retry timer cleanup on abort
 * - Tests makeRetryable wrapper cleanup
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - Results arrays are released after batch completes
 * - Error objects don't accumulate
 * - Retry timers are cleaned on abort
 */

import {
    batch,
    retry,
    makeRetryable,
    RetryError
} from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { createLargeObject, delay } from './_helpers.ts';

interface BatchRetryContext {

    /** Track batches completed */
    batchCount: number;

    /** Track retries attempted */
    retryCount: number;
}

export const batchRetryScenario: Scenario<BatchRetryContext> = {

    name: 'batch-retry',
    description: 'Results accumulation, error handling, and retry timer cleanup',

    setup() {

        return {
            batchCount: 0,
            retryCount: 0
        };
    },

    async run(_iteration: number, context: ScenarioContext<BatchRetryContext>) {

        let batchesCompleted = 0;
        let itemsProcessed = 0;
        let errorsCollected = 0;
        let retriesAttempted = 0;
        let retriesAborted = 0;

        // === Test 1: Batch results cleanup ===
        // Process many items, verify results array is released
        const items1 = Array.from({ length: 1000 }, (_, i) => i);

        const results1 = await batch(
            async (item: number) => {

                return { item, data: createLargeObject(1) }; // 1KB per result
            },
            {
                items: items1,
                concurrency: 50
            }
        );

        itemsProcessed += results1.length;

        // Release results reference
        results1.length = 0;
        batchesCompleted++;

        // === Test 2: Error accumulation in continue mode ===
        const items2 = Array.from({ length: 500 }, (_, i) => i);

        const results2 = await batch(
            async (item: number) => {

                if (item % 3 === 0) {

                    throw new Error(`Error for ${item}: ${'x'.repeat(100)}`);
                }

                return item * 2;
            },
            {
                items: items2,
                concurrency: 20,
                failureMode: 'continue',
                onError: () => errorsCollected++
            }
        );

        itemsProcessed += results2.length;

        // Count errors in results
        const errorResults = results2.filter(r => r.error !== null);
        errorsCollected = errorResults.length;

        // Release results reference
        results2.length = 0;
        batchesCompleted++;

        // === Test 3: Batch callback cleanup ===
        const largeContext = createLargeObject(50);
        const items3 = Array.from({ length: 200 }, (_, i) => i);

        const results3 = await batch(
            async (item: number) => item,
            {
                items: items3,
                concurrency: 10,
                onStart: () => {

                    // Capture large context
                    const _ = largeContext.key_0;
                },
                onChunkStart: () => {

                    const _ = largeContext.key_1;
                },
                onChunkEnd: () => {

                    const _ = largeContext.key_2;
                },
                onEnd: () => {

                    const _ = largeContext.key_3;
                }
            }
        );

        itemsProcessed += results3.length;
        results3.length = 0;
        batchesCompleted++;

        // === Test 4: Retry success ===
        let attempt1 = 0;
        const retryResult1 = await retry(
            async () => {

                attempt1++;
                retriesAttempted++;

                if (attempt1 < 3) {

                    throw new Error('Not yet');
                }

                return 'success';
            },
            {
                retries: 5,
                delay: 1
            }
        );

        // === Test 5: Retry with max retries exceeded ===
        let attempt2 = 0;

        try {

            await retry(
                async () => {

                    attempt2++;
                    retriesAttempted++;
                    throw new Error('Always fails');
                },
                {
                    retries: 3,
                    delay: 1
                }
            );
        }
        catch (err) {

            if (err instanceof RetryError) {

                // RetryError should be cleaned up after catch
            }
        }

        // === Test 6: Retry with abort ===
        const controller = new AbortController();

        try {

            // Start retry that we'll abort
            const retryPromise = retry(
                async () => {

                    retriesAttempted++;
                    await delay(100);
                    throw new Error('Slow failure');
                },
                {
                    retries: 10,
                    delay: 50,
                    signal: controller.signal
                }
            );

            // Abort after short delay
            setTimeout(() => controller.abort(), 20);

            await retryPromise;
        }
        catch {

            retriesAborted++;
        }

        // === Test 7: makeRetryable wrapper cleanup ===
        for (let i = 0; i < 50; i++) {

            let callCount = 0;
            const retryableFn = makeRetryable(
                async (x: number) => {

                    callCount++;
                    retriesAttempted++;

                    if (callCount < 2) {

                        throw new Error('First fail');
                    }

                    return x * 2;
                },
                {
                    retries: 3,
                    delay: 1
                }
            );

            await retryableFn(i);
        }

        // Retryable functions go out of scope

        // === Test 8: Retry with backoff and jitter ===
        let attempt3 = 0;
        await retry(
            async () => {

                attempt3++;
                retriesAttempted++;

                if (attempt3 < 2) {

                    throw new Error('Backoff test');
                }

                return 'done';
            },
            {
                retries: 5,
                delay: 1,
                backoff: 2,
                jitterFactor: 0.1
            }
        );

        // === Test 9: Batch abort simulation (abort not supported, testing error mode) ===
        const items4 = Array.from({ length: 100 }, (_, i) => i);
        let abortErrorCount = 0;

        try {

            await batch(
                async (item: number) => {

                    if (item === 50) {

                        throw new Error('Abort at 50');
                    }

                    return item;
                },
                {
                    items: items4,
                    concurrency: 1, // Sequential to hit error at 50
                    failureMode: 'abort'
                }
            );
        }
        catch {

            abortErrorCount++;
        }

        batchesCompleted++;

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.batchCount += batchesCompleted;
        context.data.retryCount += retriesAttempted;

        return {
            batchesCompleted,
            itemsProcessed,
            errorsCollected,
            retriesAttempted,
            retriesAborted,
            abortErrorCount
        };
    },

    teardown(_context: ScenarioContext<BatchRetryContext>) {

        // Nothing to explicitly clean up
    }
};
