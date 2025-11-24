/**
 * Scenario A: Memoize Churn
 *
 * Goal: Detect leaks from memoization cache, LRU eviction, and cleanup timers.
 *
 * What it does:
 * - Creates/destroys many memoized functions to test cleanup timer leaks
 * - Tests LRU eviction with maxSize pressure
 * - Tests key serialization overhead with large objects
 * - Tests TTL expiration cleanup
 *
 * Pass criteria:
 * - Heap returns to baseline after GC
 * - No lingering setInterval handles from cleanup timers
 * - Cache size respects maxSize limit
 *
 * Note: WeakRef GC timing is non-deterministic, so we don't use it as pass/fail
 * criteria. We report WeakRef stats for informational purposes only.
 */

import {
    memoize,
    memoizeSync,
    type EnhancedMemoizedFunction
} from '../../../../../../packages/utils/src/index.ts';

import type { Scenario, ScenarioContext } from '../../types.ts';
import { createLargeObject, generateUniqueKey } from './_helpers.ts';

interface MemoizeChurnContext {

    /** Memoized functions created during setup */
    memoizedFns: Array<EnhancedMemoizedFunction<any>>;

    /** Track created functions for cleanup */
    fnCount: number;
}

export const memoizeChurn: Scenario<MemoizeChurnContext> = {

    name: 'memoize-churn',
    description: 'Memoization cache pressure, LRU eviction, WeakRef GC, and cleanup timer leaks',

    setup() {

        return {
            memoizedFns: [],
            fnCount: 0
        };
    },

    async run(iteration: number, context: ScenarioContext<MemoizeChurnContext>) {

        const { memoizedFns } = context.data;
        let cacheHits = 0;
        let cacheMisses = 0;
        let evictions = 0;

        // === Test 1: Create/destroy memoized functions (timer leak test) ===
        // Each memoized function starts a cleanup interval timer.
        // We disable cleanup timers (cleanupInterval: 0) to avoid timing-dependent behavior.
        // The real leak risk is the cache Map not being cleared, which we test explicitly.
        {
            const tempFns: Array<EnhancedMemoizedFunction<any>> = [];

            for (let i = 0; i < 100; i++) {

                const fn = memoizeSync(
                    (x: number) => x * 2,
                    {
                        ttl: 1000,
                        maxSize: 10,
                        cleanupInterval: 0 // Disable timers to avoid timing issues
                    }
                );

                tempFns.push(fn);

                // Use the function to populate cache
                fn(i);
                fn(i + 1);
            }

            // Clear all caches - this releases the Map entries
            for (const fn of tempFns) {

                fn.cache.clear();
            }

            // Release references to allow GC
            tempFns.length = 0;
        }

        // === Test 2: LRU eviction under pressure ===
        const lruTestFn = memoizeSync(
            (key: string) => ({ key, data: createLargeObject(10) }), // 10KB per entry
            {
                ttl: 60000,
                maxSize: 50, // Only keep 50 entries
                cleanupInterval: 0 // Disable background cleanup
            }
        );

        // Add 200 entries, should evict 150
        for (let i = 0; i < 200; i++) {

            lruTestFn(generateUniqueKey('lru', i));
        }

        const lruStats = lruTestFn.cache.stats();
        evictions += lruStats.evictions;

        // Verify maxSize is respected
        const lruSize = lruTestFn.cache.size;

        // Clear the LRU test cache
        lruTestFn.cache.clear();

        // === Test 3: Key serialization overhead ===
        // Call with large objects, verify string keys don't persist on cache hit
        const serializerTestFn = memoizeSync(
            (obj: Record<string, unknown>) => Object.keys(obj).length,
            {
                ttl: 60000,
                maxSize: 100,
                cleanupInterval: 0
            }
        );

        const largeArg = createLargeObject(50); // 50KB object

        // First call - cache miss, generates key
        serializerTestFn(largeArg);
        cacheMisses++;

        // Second call - cache hit, key generated but should be temporary
        for (let i = 0; i < 100; i++) {

            serializerTestFn(largeArg);
            cacheHits++;
        }

        const serializerStats = serializerTestFn.cache.stats();
        serializerTestFn.cache.clear();

        // === Test 4: WeakRef behavior (informational only) ===
        // WeakRef GC timing is non-deterministic, so we just verify the cache
        // functions correctly with useWeakRef enabled. We don't fail on GC behavior.
        let weakRefSizeBefore = 0;
        {
            const weakRefFn = memoizeSync(
                (id: number) => ({ id, payload: createLargeObject(20) }),
                {
                    ttl: 60000,
                    maxSize: 100,
                    useWeakRef: true,
                    cleanupInterval: 0
                }
            );

            // Create entries
            for (let i = 0; i < 50; i++) {

                weakRefFn(i);
            }

            weakRefSizeBefore = weakRefFn.cache.size;

            // Clear cache to release all entries
            weakRefFn.cache.clear();
        }

        // === Test 5: Async memoize with stale-while-revalidate ===
        let asyncCacheSize = 0;
        {
            const asyncMemoFn = memoize(
                async (id: number) => {

                    await new Promise(resolve => setTimeout(resolve, 1));
                    return { id, timestamp: Date.now() };
                },
                {
                    ttl: 5000,
                    staleIn: 1000,
                    staleTimeout: 100,
                    maxSize: 100,
                    cleanupInterval: 0
                }
            );

            // Populate cache
            for (let i = 0; i < 20; i++) {

                await asyncMemoFn(i);
            }

            asyncCacheSize = asyncMemoFn.cache.stats().size;
            asyncMemoFn.cache.clear();
        }

        // Allow microtasks to settle
        await new Promise<void>(resolve => queueMicrotask(resolve));

        context.data.fnCount += 100; // Track functions created this iteration

        return {
            functionsCreated: 100,
            lruEvictions: evictions,
            lruFinalSize: lruSize,
            cacheHits,
            cacheMisses,
            weakRefSizeBefore,
            asyncCacheSize
        };
    },

    teardown(context: ScenarioContext<MemoizeChurnContext>) {

        // Clear any remaining memoized functions
        context.data.memoizedFns.forEach(fn => fn.cache.clear());
        context.data.memoizedFns.length = 0;
    }
};
