/**
 * Scenario B: Debounce & Throttle
 *
 * Goal: Detect leaks from timer management and internal state cleanup.
 *
 * What it does:
 * - Creates/destroys many debounced/throttled functions
 * - Tests timer cleanup on rapid calls
 * - Tests that cancel() clears internal state (timers, lastArgs, lastResult)
 * - Verifies flush() executes and clears pending state
 *
 * Pass criteria:
 * - Heap returns to baseline after GC (when wrapper functions are released)
 * - Timer handles are properly cleared on cancel()
 * - Internal state (lastArgs, lastResult) is cleared on cancel()
 *
 * Important design notes:
 * - cancel() clears timers and internal state, but the wrapper function still exists
 * - To fully release memory, the wrapper function reference must go out of scope
 * - We use block scopes to ensure wrapper functions are eligible for GC
 * - WeakRef GC timing is non-deterministic, so we don't use it as pass/fail criteria
 */

import {
    debounce,
    throttle,
    type DebouncedFunction,
    type ThrottledFunction
} from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { createLargeObject, delay } from './_helpers.ts';

interface DebounceThrottleContext {

    /** Track iteration count */
    iterationCount: number;
}

export const debounceThrottle: Scenario<DebounceThrottleContext> = {

    name: 'debounce-throttle',
    description: 'Timer cleanup and internal state management in debounce/throttle',

    setup() {

        return {
            iterationCount: 0
        };
    },

    async run(_iteration: number, context: ScenarioContext<DebounceThrottleContext>) {

        let timersCanceled = 0;
        let functionsCreated = 0;
        let flushExecutions = 0;

        // === Test 1: Debounce create/cancel cycles ===
        // Wrapper functions go out of scope at block end, allowing GC
        {
            for (let i = 0; i < 100; i++) {

                const fn = debounce(
                    (x: number) => x * 2,
                    { delay: 10000 }
                );

                // Activate timer
                fn(i);

                // Cancel clears timer and lastArgs
                fn.cancel();
                timersCanceled++;
                functionsCreated++;
            }
            // All 100 wrapper functions now out of scope
        }

        // === Test 2: Throttle create/cancel cycles ===
        {
            for (let i = 0; i < 100; i++) {

                const fn = throttle(
                    () => ({ value: i }),
                    { delay: 10000 }
                );

                // Call to cache result
                fn();

                // Cancel clears lastResult
                fn.cancel();
                timersCanceled++;
                functionsCreated++;
            }
        }

        // === Test 3: Debounce with large args (verify lastArgs cleanup) ===
        {
            for (let i = 0; i < 50; i++) {

                const largeArg = createLargeObject(30);

                const fn = debounce(
                    (obj: Record<string, unknown>) => Object.keys(obj).length,
                    { delay: 10000 }
                );

                // Store large args in lastArgs
                fn(largeArg);

                // Cancel should clear lastArgs
                fn.cancel();
                timersCanceled++;
                functionsCreated++;
            }
            // Both fn and largeArg out of scope
        }

        // === Test 4: Debounce with maxWait and flush ===
        {
            for (let i = 0; i < 30; i++) {

                const fn = debounce(
                    () => i * 2,
                    { delay: 50, maxWait: 200 }
                );

                // Rapid calls
                for (let j = 0; j < 10; j++) {

                    fn();
                }

                // Flush executes immediately and clears state
                const result = fn.flush();

                if (result !== undefined) {

                    flushExecutions++;
                }

                functionsCreated++;
            }
        }

        // === Test 5: Throttle with onThrottle callback ===
        let throttleCallbackCount = 0;
        {
            for (let i = 0; i < 20; i++) {

                const fn = throttle(
                    () => i,
                    {
                        delay: 50,
                        onThrottle: () => throttleCallbackCount++
                    }
                );

                // First call executes, rest are throttled
                for (let j = 0; j < 10; j++) {

                    fn();
                }

                fn.cancel();
                timersCanceled++;
                functionsCreated++;
            }
        }

        // === Test 6: Rapid debounce replacement (timer leak test) ===
        // This tests that each call properly clears the previous timer
        {
            const fn = debounce(
                () => 'result',
                { delay: 100 }
            );

            // 1000 rapid calls - only one timer should exist at any time
            for (let i = 0; i < 1000; i++) {

                fn();
            }

            fn.cancel();
            timersCanceled++;
            functionsCreated++;
        }

        // === Test 7: Mixed debounce/throttle with immediate cleanup ===
        {
            for (let i = 0; i < 50; i++) {

                const debounceFn = debounce(() => i, { delay: 100, maxWait: 500 });
                const throttleFn = throttle(() => i, { delay: 100 });

                debounceFn();
                throttleFn();

                debounceFn.cancel();
                throttleFn.cancel();

                timersCanceled += 2;
                functionsCreated += 2;
            }
        }

        // Wait for any pending operations
        await delay(10);

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.iterationCount++;

        return {
            functionsCreated,
            timersCanceled,
            flushExecutions,
            throttleCallbacks: throttleCallbackCount
        };
    },

    teardown(_context: ScenarioContext<DebounceThrottleContext>) {

        // No persistent state to clean up - all functions are scoped within run()
    }
};
