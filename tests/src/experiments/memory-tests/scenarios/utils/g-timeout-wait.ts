/**
 * Scenario G: Timeout & Wait
 *
 * Goal: Detect leaks from timer management and loser promise retention.
 *
 * What it does:
 * - Tests wait() timer cleanup with .clear()
 * - Tests withTimeout timer cleanup on success/timeout
 * - Tests Deferred promise retention
 * - Tests loser promise behavior (slow operation continues after timeout)
 * - Tests nested timeout accumulation
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - Timers are cleaned on .clear() and completion
 * - Deferred promises are GC'd when resolved
 */

import {
    wait,
    Deferred,
    withTimeout,
    runWithTimeout,
    TimeoutError,
    nextTick,
    nextLoop
} from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { createLargeObject } from './_helpers.ts';

interface TimeoutWaitContext {

    /** Track waits created */
    waitCount: number;

    /** Track deferreds created */
    deferredCount: number;
}

export const timeoutWaitScenario: Scenario<TimeoutWaitContext> = {

    name: 'timeout-wait',
    description: 'Timer cleanup, Deferred retention, and loser promise behavior',

    setup() {

        return {
            waitCount: 0,
            deferredCount: 0
        };
    },

    async run(_iteration: number, context: ScenarioContext<TimeoutWaitContext>) {

        let waitsCreated = 0;
        let waitsCleared = 0;
        let deferredsCreated = 0;
        let deferredsResolved = 0;
        let timeoutsCreated = 0;
        let timeoutsFired = 0;

        // === Test 1: wait() with .clear() - stress test timer cleanup ===
        // Create many waits with large values and clear them
        for (let i = 0; i < 500; i++) {

            const largePayload = createLargeObject(5); // 5KB per wait
            const w = wait(10000, largePayload); // Long timeout with large value
            waitsCreated++;

            // Clear immediately - timer and value should be released
            w.clear();
            waitsCleared++;
        }

        // === Test 2: wait() that completes naturally with large values ===
        const completedWaits: Promise<any>[] = [];

        for (let i = 0; i < 100; i++) {

            const payload = createLargeObject(5); // 5KB
            completedWaits.push(wait(1, payload));
            waitsCreated++;
        }

        await Promise.all(completedWaits);
        completedWaits.length = 0; // Release references

        // === Test 3: Deferred with large payloads ===
        const deferreds: Deferred<Record<string, unknown>>[] = [];

        for (let i = 0; i < 200; i++) {

            const d = new Deferred<Record<string, unknown>>();
            deferreds.push(d);
            deferredsCreated++;
        }

        // Resolve all with large payloads
        deferreds.forEach((d) => {

            d.resolve(createLargeObject(10)); // 10KB per deferred
            deferredsResolved++;
        });

        // Await all and release
        const results = await Promise.all(deferreds.map(d => d.promise));
        results.length = 0;
        deferreds.length = 0;

        // === Test 4: Deferred rejection with large error objects ===
        const rejectDeferreds: Deferred<any>[] = [];

        for (let i = 0; i < 100; i++) {

            const d = new Deferred<any>();
            rejectDeferreds.push(d);
            deferredsCreated++;
        }

        // Reject all with large error messages
        rejectDeferreds.forEach((d, i) => {

            const largeMessage = `Error ${i}: ${'x'.repeat(5000)}`;
            d.reject(new Error(largeMessage));
        });

        await Promise.all(
            rejectDeferreds.map(d => d.promise.catch(() => {}))
        );

        rejectDeferreds.length = 0;

        // === Test 5: withTimeout success - verify timer cleanup ===
        for (let i = 0; i < 100; i++) {

            const result = await runWithTimeout(
                async () => {

                    // Quick operation with large return value
                    return createLargeObject(10);
                },
                { timeout: 1000 }
            );

            // Don't hold reference to result
            timeoutsCreated++;
        }

        // === Test 6: withTimeout timeout - loser promise behavior ===
        // The slow operation continues running after timeout
        // This tests that resources are eventually released
        let slowCompletions = 0;
        const slowResults: Record<string, unknown>[] = [];

        for (let i = 0; i < 20; i++) {

            try {

                await runWithTimeout(
                    async () => {

                        // Create large object that will be orphaned on timeout
                        const largeResult = createLargeObject(20);
                        await new Promise(resolve => setTimeout(resolve, 50));
                        slowCompletions++;
                        slowResults.push(largeResult);
                        return largeResult;
                    },
                    { timeout: 5 } // Very short timeout
                );
            }
            catch (err) {

                if (err instanceof TimeoutError) {

                    timeoutsFired++;
                }
            }

            timeoutsCreated++;
        }

        // Wait for slow operations to complete in background
        await new Promise(resolve => setTimeout(resolve, 100));

        // Clear any accumulated results
        slowResults.length = 0;

        // === Test 7: Nested withTimeout with large objects ===
        for (let i = 0; i < 30; i++) {

            const outerFn = withTimeout(
                async () => {

                    const innerResult = await runWithTimeout(
                        async () => createLargeObject(5),
                        { timeout: 100 }
                    );

                    return { outer: createLargeObject(5), inner: innerResult };
                },
                { timeout: 200 }
            );

            const _result = await outerFn();
            timeoutsCreated += 2;
        }

        // === Test 8: AbortController cleanup ===
        for (let i = 0; i < 50; i++) {

            const controller = new AbortController();

            try {

                await runWithTimeout(
                    async () => {

                        return createLargeObject(5);
                    },
                    {
                        timeout: 100,
                        abortController: controller
                    }
                );
            }
            catch {

                // Handle any errors
            }

            timeoutsCreated++;
        }

        // === Test 9: High volume nextTick/nextLoop ===
        // These use MessageChannel internally - test for leaks
        for (let i = 0; i < 500; i++) {

            await nextTick();
        }

        for (let i = 0; i < 500; i++) {

            await nextLoop();
        }

        // === Test 10: Unresolved Deferred GC test ===
        // Create deferreds that are never resolved with large captured context
        for (let i = 0; i < 100; i++) {

            const largeContext = createLargeObject(10);
            const _d = new Deferred<typeof largeContext>();
            // Intentionally not resolving, not keeping reference
            // Both Deferred and largeContext should be GC-able
            deferredsCreated++;
        }

        // === Test 11: Rapid wait create/clear cycles ===
        for (let i = 0; i < 1000; i++) {

            const w = wait(60000, { index: i, data: createLargeObject(1) });
            w.clear();
            waitsCreated++;
            waitsCleared++;
        }

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.waitCount += waitsCreated;
        context.data.deferredCount += deferredsCreated;

        return {
            waitsCreated,
            waitsCleared,
            deferredsCreated,
            deferredsResolved,
            timeoutsCreated,
            timeoutsFired,
            slowCompletions
        };
    },

    teardown(_context: ScenarioContext<TimeoutWaitContext>) {

        // Nothing to explicitly clean up
    }
};
