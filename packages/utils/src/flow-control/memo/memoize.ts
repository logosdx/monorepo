import type { AsyncFunc } from '../../types.ts';
import { assert, assertOptional, isFunction, isOptional } from '../../validation/index.ts';
import { attempt, attemptSync } from '../../async/attempt.ts';
import { withInflightDedup } from '../../async/inflight.ts';
import { wait } from '../misc.ts';
import { serializer } from '../_helpers.ts';

import type { MemoizeOptions, EnhancedMemoizedFunction, CacheStats, CacheItem } from './types.ts';
import { MapCacheAdapter } from './adapter.ts';
import {
    createCacheItem,
    isExpired,
    isStale,
    unwrapValue,
    updateAccessMetadata,
    TIMEOUT_SYMBOL
} from './helpers.ts';

const memoizedFunctions = new WeakSet<Function>();

/**
 * Memoizes an async function with intelligent caching, LRU eviction, and stale-while-revalidate.
 *
 * **What it does:**
 * - Caches async function results with configurable TTL
 * - Deduplicates concurrent calls with the same arguments (thundering herd protection)
 * - LRU eviction when cache reaches maxSize
 * - Optional stale-while-revalidate pattern for fast responses with fresh data
 * - Pluggable cache adapters (Map by default, Redis/Memcached via custom adapters)
 * - Background cleanup of expired entries
 * - WeakRef support for memory-sensitive scenarios
 *
 * **When to use:**
 * - Expensive async operations (database queries, API calls, computations)
 * - Functions called frequently with the same arguments
 * - Need to prevent duplicate concurrent executions
 * - Want fast responses with eventually-fresh data (stale-while-revalidate)
 *
 * **Performance notes:**
 * - Cache hit path is optimized for minimal allocations
 * - Default key generation: O(n) in argument structure size
 * - For hot paths, provide custom generateKey extracting only discriminating fields
 *
 * @template T - Async function type
 * @param fn - Async function to memoize
 * @param opts - Memoization options
 * @returns Enhanced memoized function with cache management methods
 *
 * @example
 * // Basic usage
 * const fetchUser = async (id: string) => database.users.findById(id);
 * const getUser = memoize(fetchUser);
 *
 * // Three concurrent calls → one database query
 * const [user1, user2, user3] = await Promise.all([
 *     getUser("42"),
 *     getUser("42"),
 *     getUser("42")
 * ]);
 *
 * @example
 * // With stale-while-revalidate
 * const fetchPrices = async (symbol: string) => api.getPrice(symbol);
 * const getPrice = memoize(fetchPrices, {
 *     ttl: 60000,        // Expire after 1 minute
 *     staleIn: 30000,    // Consider stale after 30 seconds
 *     staleTimeout: 1000 // Wait max 1 second for fresh data
 * });
 *
 * // Returns stale data immediately if fresh fetch takes > 1 second
 * const price = await getPrice("AAPL");
 *
 * @example
 * // With custom key and cache management
 * const search = async (query: string, opts: SearchOptions) => api.search(query, opts);
 * const memoizedSearch = memoize(search, {
 *     generateKey: ([query]) => query, // Only cache by query, ignore opts
 *     maxSize: 100,
 *     ttl: 300000 // 5 minutes
 * });
 *
 * // Cache management
 * memoizedSearch.cache.stats(); // { hits: 10, misses: 3, hitRate: 0.77, ... }
 * memoizedSearch.cache.clear(); // Clear all cached results
 * memoizedSearch.cache.delete(someKey); // Remove specific entry
 *
 * @example
 * // Conditional caching - bypass cache for specific requests
 * const fetchData = async (url: string, opts?: { bustCache?: boolean }) => api.get(url);
 * const smartFetch = memoize(fetchData, {
 *     shouldCache: (url, opts) => !opts?.bustCache,
 *     ttl: 60000
 * });
 *
 * // This call uses cache
 * await smartFetch('/api/data');
 *
 * // This call bypasses cache and executes directly (still deduped)
 * await smartFetch('/api/data', { bustCache: true });
 */
export const memoize = <T extends AsyncFunc<any>>(
    fn: T,
    opts: MemoizeOptions<T> = {}
): EnhancedMemoizedFunction<T> => {

    assert(isFunction(fn), 'fn must be a function');
    assert(!memoizedFunctions.has(fn), 'Function is already wrapped by memoize');

    const {
        ttl = 60000,
        maxSize = 1000,
        generateKey,
        onError,
        cleanupInterval = 60000,
        staleIn,
        staleTimeout,
        useWeakRef = false,
        adapter,
        shouldCache
    } = opts;

    assert(ttl > 0, 'ttl must be greater than 0');
    assert(maxSize > 0, 'maxSize must be greater than 0');
    assert(isOptional(cleanupInterval, (val) => typeof val === 'number' && val >= 0), 'cleanupInterval must be >= 0');
    assert(isOptional(staleIn, (val) => typeof val === 'number' && val >= 0 && val < ttl), 'staleIn must be >= 0 and < ttl');
    assert(isOptional(staleTimeout, (val) => typeof val === 'number' && val >= 0), 'staleTimeout must be >= 0');

    assertOptional(generateKey, isFunction(generateKey), 'generateKey must be a function');
    assertOptional(onError, isFunction(onError), 'onError must be a function');

    const cache = adapter || new MapCacheAdapter<CacheItem<ReturnType<T>>>({
        maxSize,
        cleanupInterval,
        useWeakRef
    });

    let accessSequence = 0;
    let hits = 0;
    let misses = 0;

    const getNextSequence = (): number => {

        if (accessSequence >= Number.MAX_SAFE_INTEGER - 1) {

            accessSequence = 0;
        }

        return ++accessSequence;
    };

    const recordHit = () => hits++;
    const recordMiss = () => misses++;

    const dedupedProducer = withInflightDedup(fn, {
        keyFn: generateKey || ((...args) => serializer(args)),
        hooks: {
            onJoin: () => recordHit()
        }
    }) as T;

    const handleStaleWhileRevalidate = async (
        key: string,
        args: Parameters<T>,
        staleValue: ReturnType<T>
    ): Promise<ReturnType<T>> => {

        if (staleTimeout === undefined) {

            return staleValue;
        }

        if (staleTimeout === 0) {

            attempt(() => dedupedProducer(...args))
                .then(([freshValue, error]) => {

                    if (error) return;

                    const now = Date.now();
                    const item = createCacheItem(
                        freshValue,
                        now,
                        now + ttl,
                        useWeakRef,
                        getNextSequence()
                    ) as CacheItem<ReturnType<T>>;

                    cache.set(key, item, item.expiresAt);
                });

            return staleValue;
        }

        const freshPromise = attempt(() => dedupedProducer(...args));
        const timeoutPromise = wait(staleTimeout, TIMEOUT_SYMBOL);

        const winner = await Promise.race([freshPromise, timeoutPromise]);

        if (winner === TIMEOUT_SYMBOL) {

            return staleValue;
        }

        const [freshValue, error] = winner as any;

        if (!error) {

            const now = Date.now();
            const item = createCacheItem(
                freshValue,
                now,
                now + ttl,
                useWeakRef,
                getNextSequence()
            ) as CacheItem<ReturnType<T>>;

            cache.set(key, item, item.expiresAt);

            return freshValue as ReturnType<T>;
        }

        return staleValue;
    };

    const memoized = async function (...args: Parameters<T>): Promise<ReturnType<T>> {

        if (shouldCache) {

            const [shouldCacheResult, shouldCacheError] = attemptSync(() => shouldCache(...args));

            if (!shouldCacheError && !shouldCacheResult) {

                return dedupedProducer(...args) as ReturnType<T>;
            }
        }

        const [key, keyError] = attemptSync(() =>
            generateKey ? generateKey(args) : serializer(args as unknown[])
        );

        if (keyError) {

            onError?.(keyError, args);
            recordMiss();
            return fn(...args) as ReturnType<T>;
        }

        const cached = await Promise.resolve(cache.get(key));

        if (cached && !isExpired(cached)) {

            updateAccessMetadata(cached, getNextSequence());

            const [unwrapped, wasGC] = unwrapValue(cached.value);

            if (wasGC) {

                cache.delete(key);
                recordMiss();

                const [value, error] = await attempt(() => dedupedProducer(...args));

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

                cache.set(key, item, item.expiresAt);

                return value as ReturnType<T>;
            }

            if (staleIn !== undefined && isStale(cached, staleIn)) {

                recordHit();
                return handleStaleWhileRevalidate(key, args, unwrapped as ReturnType<T>);
            }

            recordHit();
            return unwrapped as ReturnType<T>;
        }

        recordMiss();

        const [value, error] = await attempt(() => dedupedProducer(...args));

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

        cache.set(key, item, item.expiresAt);

        return value as ReturnType<T>;
    };

    (memoized as EnhancedMemoizedFunction<T>).cache = {
        clear: () => {

            cache.clear();
            hits = 0;
            misses = 0;
            accessSequence = 0;
        },

        delete: (key: string) => {

            const result = cache.delete(key);
            return result instanceof Promise ? false : result;
        },

        has: (key: string) => {

            const result = cache.has(key);
            return result instanceof Promise ? false : result;
        },

        get size() {

            return cache.size;
        },

        stats: (): CacheStats => {

            return {
                hits,
                misses,
                evictions: cache instanceof MapCacheAdapter ? cache.getStats().evictions : 0,
                hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
                size: cache.size
            };
        },

        keys: () => {

            return cache.keys() as IterableIterator<string>;
        },

        entries: () => {

            const results: Array<[string, ReturnType<T> | undefined]> = [];

            for (const [key, item] of cache.entries() as Iterable<[string, CacheItem<ReturnType<T>>]>) {

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
