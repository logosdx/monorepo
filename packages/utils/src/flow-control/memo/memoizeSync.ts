import type { Func } from '../../types.ts';
import { assert, assertOptional, isFunction, isOptional } from '../../validation/index.ts';
import { attemptSync } from '../../async/attempt.ts';
import { serializer } from '../../misc/index.ts';

import type { MemoizeOptions, EnhancedMemoizedFunction, CacheStats, CacheItem } from './types.ts';
import {
    createCacheItem,
    isExpired,
    unwrapValue,
    updateAccessMetadata,
    evictLRU
} from './helpers.ts';

const memoizedFunctions = new WeakSet<Function>();

export interface MemoizeSyncOptions<T extends Func<any>> extends Omit<MemoizeOptions<T>, 'adapter' | 'staleIn' | 'staleTimeout'> {}

/**
 * Memoizes a synchronous function with intelligent caching and LRU eviction.
 *
 * **What it does:**
 * - Caches sync function results with configurable TTL
 * - LRU eviction when cache reaches maxSize
 * - Background cleanup of expired entries
 * - WeakRef support for memory-sensitive scenarios
 * - Zero promise overhead (fully synchronous)
 *
 * **What it doesn't do:**
 * - No inflight deduplication (sync functions execute instantly)
 * - No async cache adapters (uses direct Map for performance)
 * - No stale-while-revalidate (not applicable for sync, use memoize for async)
 *
 * **When to use:**
 * - Expensive pure computations (parsing, transformations, calculations)
 * - Functions called frequently with the same arguments
 * - Need caching without async overhead
 *
 * **Performance notes:**
 * - Optimized cache hit path with minimal allocations
 * - Direct Map usage (no adapter abstraction overhead)
 * - Default key generation: O(n) in argument structure size
 *
 * @template T - Sync function type
 * @param fn - Sync function to memoize
 * @param opts - Memoization options (adapter, staleIn, staleTimeout not supported)
 * @returns Enhanced memoized function with cache management methods
 *
 * @example
 * // Basic usage
 * const fibonacci = (n: number): number => {
 *     if (n <= 1) return n;
 *     return fibonacci(n - 1) + fibonacci(n - 2);
 * };
 * const memoFib = memoizeSync(fibonacci);
 *
 * memoFib(40); // Computed once and cached
 * memoFib(40); // Instant return from cache
 *
 * @example
 * // With custom key and TTL
 * const parseJSON = (str: string) => JSON.parse(str);
 * const memoizedParse = memoizeSync(parseJSON, {
 *     generateKey: (str) => str.substring(0, 100), // Cache by first 100 chars
 *     ttl: 300000, // 5 minutes
 *     maxSize: 50
 * });
 *
 * @example
 * // Conditional caching - bypass cache for specific calls
 * const expensiveCalc = (value: number, opts?: { bustCache?: boolean }) => {
 *     return value * 2 + Math.random();
 * };
 * const smartCalc = memoizeSync(expensiveCalc, {
 *     shouldCache: (value, opts) => !opts?.bustCache,
 *     ttl: 60000
 * });
 *
 * // This call uses cache
 * smartCalc(42);
 *
 * // This call bypasses cache and executes directly
 * smartCalc(42, { bustCache: true });
 */
export const memoizeSync = <T extends Func<any>>(
    fn: T,
    opts: MemoizeSyncOptions<T> = {}
): EnhancedMemoizedFunction<T> => {

    assert(isFunction(fn), 'fn must be a function');
    assert(!memoizedFunctions.has(fn), 'Function is already wrapped by memoize');

    const {
        ttl = 60000,
        maxSize = 1000,
        generateKey,
        onError,
        cleanupInterval = 60000,
        useWeakRef = false,
        shouldCache
    } = opts;

    const {
        staleIn,
        staleTimeout,
        adapter,
    } = opts as any // Cast to any to bypass TS checks for unsupported options

    assert(ttl > 0, 'ttl must be greater than 0');
    assert(maxSize > 0, 'maxSize must be greater than 0');
    assert(isOptional(cleanupInterval, (val) => typeof val === 'number' && val >= 0), 'cleanupInterval must be >= 0');

    assertOptional(generateKey, isFunction(generateKey), 'generateKey must be a function');
    assertOptional(onError, isFunction(onError), 'onError must be a function');

    assert(adapter === undefined, 'memoizeSync does not support custom cache adapters (use memoize for async adapters like Redis)');
    assert(staleTimeout === undefined, 'memoizeSync does not support staleTimeout (sync functions execute instantly)');
    assert(staleIn === undefined, 'memoizeSync does not support staleIn (sync functions execute instantly, use ttl instead)');

    const cache = new Map<string, CacheItem<ReturnType<T>>>();

    let accessSequence = 0;
    let hits = 0;
    let misses = 0;
    let evictions = 0;
    let cleanupTimer: NodeJS.Timeout | number | undefined;

    const getNextSequence = (): number => {

        if (accessSequence >= Number.MAX_SAFE_INTEGER - 1) {

            accessSequence = 0;
        }

        return ++accessSequence;
    };

    const recordHit = () => hits++;
    const recordMiss = () => misses++;

    const cleanupExpired = (): void => {

        const now = Date.now();

        for (const [key, item] of cache.entries()) {

            if (now >= item.expiresAt) {

                cache.delete(key);
            }
        }
    };

    if (cleanupInterval > 0) {

        cleanupTimer = setInterval(() => cleanupExpired(), cleanupInterval);

        if (typeof (cleanupTimer as NodeJS.Timeout).unref === 'function') {

            (cleanupTimer as NodeJS.Timeout).unref();
        }
    }

    const memoized = function (...args: Parameters<T>): ReturnType<T> {

        if (shouldCache) {

            const [shouldCacheResult, shouldCacheError] = attemptSync(() => shouldCache(...args));

            if (!shouldCacheError && !shouldCacheResult) {

                return fn(...args) as ReturnType<T>;
            }
        }

        const [key, keyError] = attemptSync(() =>
            generateKey ? generateKey(...args) : serializer(args as unknown[])
        );

        if (keyError) {

            onError?.(keyError, args);
            recordMiss();

            return fn(...args) as ReturnType<T>;
        }

        const cached = cache.get(key);

        if (cached && !isExpired(cached)) {

            updateAccessMetadata(cached, getNextSequence());

            const [unwrapped, wasGC] = unwrapValue(cached.value);

            if (wasGC) {

                cache.delete(key);
                recordMiss();

                const [value, error] = attemptSync(() => fn(...args));

                if (error) {

                    onError?.(error, args);
                    throw error;
                }

                const now = Date.now();
                const item = createCacheItem(
                    value,
                    now,
                    now + ttl,
                    useWeakRef,
                    getNextSequence()
                ) as CacheItem<ReturnType<T>>;

                if (cache.size >= maxSize) {

                    evictLRU(cache);
                    evictions++;
                }

                cache.set(key, item);

                return value as ReturnType<T>;
            }

            recordHit();
            return unwrapped as ReturnType<T>;
        }

        recordMiss();

        const [value, error] = attemptSync(() => fn(...args));

        if (error) {

            onError?.(error, args);
            throw error;
        }

        const now = Date.now();
        const item = createCacheItem(
            value,
            now,
            now + ttl,
            useWeakRef,
            getNextSequence()
        ) as CacheItem<ReturnType<T>>;

        if (cache.size >= maxSize) {

            evictLRU(cache);
            evictions++;
        }

        cache.set(key, item);

        return value as ReturnType<T>;
    };

    (memoized as EnhancedMemoizedFunction<T>).cache = {
        clear: () => {

            cache.clear();
            hits = 0;
            misses = 0;
            evictions = 0;
            accessSequence = 0;

            if (cleanupTimer !== undefined) {

                clearInterval(cleanupTimer);
                cleanupTimer = undefined;
            }
        },

        delete: (key: string) => {

            return cache.delete(key);
        },

        has: (key: string) => {

            const item = cache.get(key);

            if (!item) {

                return false;
            }

            if (isExpired(item)) {

                cache.delete(key);
                return false;
            }

            return true;
        },

        get size() {

            return cache.size;
        },

        stats: (): CacheStats => {

            return {
                hits,
                misses,
                evictions,
                hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
                size: cache.size
            };
        },

        keys: () => {

            return cache.keys();
        },

        entries: () => {

            const results: Array<[string, ReturnType<T> | undefined]> = [];

            for (const [key, item] of cache.entries()) {

                if (!isExpired(item)) {

                    const [unwrapped] = unwrapValue(item.value);
                    results.push([key, unwrapped]);
                }
            }

            return results;
        }
    };

    memoizedFunctions.add(memoized);

    return memoized as EnhancedMemoizedFunction<T>;
};
