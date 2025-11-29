/**
 * Scenario J: Compose Flow (Interaction Leaks)
 *
 * Goal: Detect leaks caused by the interaction of multiple flow-control wrappers.
 *
 * What it does:
 * - Tests composeFlow with various wrapper combinations
 * - Verifies that composed functions don't leak internal state between wrappers
 * - Tests churn through all wrapper states (cache hits, retries, timeouts, circuit trips)
 * - Tests that the combined internal states are properly cleaned up
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - No memory accumulation from wrapper interaction
 * - Circuit breaker state doesn't prevent memoize cleanup
 * - Retry state doesn't accumulate across calls
 */

import {
    composeFlow,
    memoize,
    retry,
    circuitBreaker,
    withTimeout,
    rateLimit,
    withInflightDedup
} from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { createLargeObject } from './_helpers.ts';

interface ComposeFlowContext {

    /** Track composed functions created */
    composedCount: number;

    /** Track total calls made */
    callCount: number;
}

export const composeFlowScenario: Scenario<ComposeFlowContext> = {

    name: 'compose-flow',
    description: 'Interaction leaks between multiple flow-control wrappers',

    setup() {

        return {
            composedCount: 0,
            callCount: 0
        };
    },

    async run(_iteration: number, context: ScenarioContext<ComposeFlowContext>) {

        let composedCreated = 0;
        let callsMade = 0;
        let retriesTriggered = 0;
        let timeoutsTriggered = 0;
        let circuitTrips = 0;

        // === Test 1: composeFlow with retry + circuitBreaker ===
        // This tests that retry state doesn't leak into circuit breaker
        {
            let callCount = 0;
            let shouldFail = true;

            const flakyFn = composeFlow(
                async (id: number) => {

                    callCount++;

                    if (shouldFail && callCount % 4 !== 0) {

                        throw new Error(`Flaky failure ${id}`);
                    }

                    return { id, data: createLargeObject(10) };
                },
                {
                    retry: { retries: 3, delay: 1 },
                    circuitBreaker: { maxFailures: 10, resetAfter: 10 }
                }
            );

            // Make many calls to exercise both retry and circuit breaker
            for (let i = 0; i < 50; i++) {

                try {

                    await flakyFn(i);
                    callsMade++;
                }
                catch {

                    retriesTriggered++;
                }
            }

            // Now make it succeed
            shouldFail = false;

            for (let i = 0; i < 20; i++) {

                try {

                    await flakyFn(i);
                    callsMade++;
                }
                catch {
                    // Circuit might still be open
                }
            }

            composedCreated++;
        }

        // === Test 2: composeFlow with timeout + retry ===
        // Tests that timeout timers are cleaned even when retry wraps them
        {
            let callCount = 0;

            const slowFn = composeFlow(
                async (id: number) => {

                    callCount++;

                    // First few calls are slow (will timeout), then fast
                    if (callCount <= 3) {

                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    return { id, result: createLargeObject(5) };
                },
                {
                    withTimeout: { timeout: 20 },
                    retry: { retries: 5, delay: 1 }
                }
            );

            for (let i = 0; i < 30; i++) {

                try {

                    await slowFn(i);
                    callsMade++;
                }
                catch {

                    timeoutsTriggered++;
                }
            }

            composedCreated++;
        }

        // === Test 3: composeFlow with rateLimit + inflight ===
        // Tests that rate limit tokens and inflight map don't leak together
        {
            const rateLimitedDedup = composeFlow(
                async (id: number) => {

                    await new Promise(resolve => setTimeout(resolve, 5));
                    return { id, payload: createLargeObject(5) };
                },
                {
                    rateLimit: { maxCalls: 20, windowMs: 100, throws: false },
                    inflight: {}
                }
            );

            // Fire many concurrent calls - inflight should dedupe, rate limit should throttle
            const promises: Promise<any>[] = [];

            for (let i = 0; i < 100; i++) {

                promises.push(rateLimitedDedup(i % 10)); // 10 unique keys
            }

            await Promise.all(promises);
            callsMade += promises.length;

            composedCreated++;
        }

        // === Test 4: Memoize with manual retry logic ===
        // Tests memoization cache behavior with functions that may fail
        {
            let innerCalls = 0;

            // Memoize a function that has retry-like behavior built in
            const memoizedFn = memoize(
                async (id: number) => {

                    innerCalls++;

                    // Simulate occasional failures
                    if (innerCalls % 10 === 0) {

                        throw new Error('Periodic failure');
                    }

                    return { id, data: createLargeObject(10) };
                },
                {
                    ttl: 1000,
                    maxSize: 50,
                    cleanupInterval: 0
                }
            );

            // Exercise the memoized function
            for (let i = 0; i < 100; i++) {

                try {

                    await memoizedFn(i % 20); // 20 unique keys, some cache hits
                    callsMade++;
                }
                catch {

                    retriesTriggered++;
                }
            }

            // Clear the memoize cache
            memoizedFn.cache.clear();

            composedCreated++;
        }

        // === Test 5: Circuit breaker wrapping memoized function ===
        // Tests that circuit trip doesn't prevent cache cleanup
        {
            let failCount = 0;

            const baseFn = async (id: number) => {

                failCount++;

                if (failCount <= 5) {

                    throw new Error('Initial failures');
                }

                return { id, cached: createLargeObject(15) };
            };

            const memoizedFn = memoize(baseFn, {
                ttl: 5000,
                maxSize: 100,
                cleanupInterval: 0
            });

            const protectedFn = circuitBreaker(memoizedFn, {
                maxFailures: 3,
                resetAfter: 10,
                onTripped: () => circuitTrips++
            });

            // Trip the circuit
            for (let i = 0; i < 10; i++) {

                try {

                    await protectedFn(i);
                    callsMade++;
                }
                catch {
                    // Expected
                }
            }

            // Wait for circuit reset
            await new Promise(resolve => setTimeout(resolve, 20));

            // Now calls should succeed and cache should work
            failCount = 10; // Skip failures

            for (let i = 0; i < 50; i++) {

                try {

                    await protectedFn(i % 10);
                    callsMade++;
                }
                catch {
                    // Circuit might still be recovering
                }
            }

            // Clear cache - verify circuit breaker doesn't prevent this
            memoizedFn.cache.clear();

            composedCreated++;
        }

        // === Test 6: Create/destroy many composed functions ===
        // Churn test for composed function lifecycle
        {
            for (let i = 0; i < 50; i++) {

                const tempFn = composeFlow(
                    async (x: number) => ({ x, data: createLargeObject(5) }),
                    {
                        retry: { retries: 1, delay: 1 },
                        circuitBreaker: { maxFailures: 2, resetAfter: 10 }
                    }
                );

                // Use it briefly
                await tempFn(i);
                callsMade++;

                composedCreated++;
            }

            // All tempFn instances go out of scope
        }

        // === Test 7: Separate inflight and memoize instances ===
        // Tests that deduped promises and memoization work independently
        {
            // Create separate inflight dedup
            const dedupedFn = withInflightDedup(
                async (id: number) => {

                    await new Promise(resolve => setTimeout(resolve, 5));
                    return { id, result: createLargeObject(10) };
                }
            );

            // Create separate memoized function
            const memoizedFn = memoize(
                async (id: number) => {

                    await new Promise(resolve => setTimeout(resolve, 5));
                    return { id, cached: createLargeObject(10) };
                },
                {
                    ttl: 2000,
                    maxSize: 50,
                    cleanupInterval: 0
                }
            );

            // Fire concurrent calls to deduped function
            const dedupConcurrent: Promise<any>[] = [];

            for (let i = 0; i < 50; i++) {

                dedupConcurrent.push(dedupedFn(i % 5)); // 5 unique keys
            }

            await Promise.all(dedupConcurrent);
            callsMade += dedupConcurrent.length;

            // Fire calls to memoized function
            const memoConcurrent: Promise<any>[] = [];

            for (let i = 0; i < 50; i++) {

                memoConcurrent.push(memoizedFn(i % 5)); // 5 unique keys
            }

            await Promise.all(memoConcurrent);
            callsMade += memoConcurrent.length;

            // Clear memoize cache
            memoizedFn.cache.clear();

            composedCreated += 2;
        }

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.composedCount += composedCreated;
        context.data.callCount += callsMade;

        return {
            composedCreated,
            callsMade,
            retriesTriggered,
            timeoutsTriggered,
            circuitTrips
        };
    },

    teardown(_context: ScenarioContext<ComposeFlowContext>) {

        // Nothing to explicitly clean up - composed functions are GC'd
    }
};
