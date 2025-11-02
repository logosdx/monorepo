import { attempt, attemptSync } from './attempt.ts';
import { wait } from './misc.ts';
import { type AnyAsyncFunc, type AnyFunc, assertNotWrapped, markWrapped, serializer } from './_helpers.ts';
import { assert, assertOptional, isFunction, isPlainObject } from '../validation.ts';
import { noop } from '../misc.ts';

/**
 * Configuration options for memoization functions.
 *
 * @template T - The function type being memoized
 */
export type MemoizeOptions<T extends AnyFunc> = {

    /**
     * Time to live in milliseconds. After this time, cached values will be considered expired.
     *
     * @default 1 * 60 * 1000 (1 minute)
     */
    ttl?: number,

    /**
     * Maximum number of items in the cache. When exceeded, least recently used items are evicted.
     *
     * @default 1000
     */
    maxSize?: number,

    /**
     * Function to call when an error occurs during key generation or function execution.
     *
     * @param error - The error that occurred
     * @param args - The arguments that were passed to the memoized function
     */
    onError?: (error: Error, args: Parameters<T>) => void

    /**
     * Generates the cache key from the function arguments.
     *
     * Default implementation handles object property ordering,
     * circular references, and non-serializable values better than JSON.stringify.
     *
     * @param args - The arguments passed to the memoized function
     * @returns A string key for caching
     * @default enhanced key generator
     */
    generateKey?: (args: Parameters<T>) => string

    /**
     * Whether to use WeakRef for large objects to prevent memory leaks.
     * When true, object values are stored as WeakRefs and may be garbage collected.
     *
     * @default false
     */
    useWeakRef?: boolean

    /**
     * Interval in milliseconds for background cleanup of expired entries.
     * Set to 0 to disable background cleanup.
     *
     * @default 60000 (1 minute)
     */
    cleanupInterval?: number

    /**
     * Time in milliseconds when cached data becomes stale and should trigger proactive refresh.
     * Must be less than ttl when both are specified.
     * Used for stale-while-revalidate pattern.
     *
     * @default undefined (no stale-while-revalidate)
     */
    staleIn?: number

    /**
     * Maximum time in milliseconds to wait for fresh data before returning stale data.
     * Only used when staleIn is specified.
     * Used for stale-while-revalidate pattern.
     *
     * @default undefined (no timeout, always wait for fresh data)
     */
    staleTimeout?: number
}

/**
 * Represents a cached item with metadata for LRU eviction and expiration.
 *
 * @template T - The type of the cached value
 */
type CacheItem<T> = {
    /** The cached value */
    value: T,
    /** Timestamp when this item was created */
    createdAt: number,
    /** Timestamp when this item expires */
    expiresAt: number,
    /** Number of times this item has been accessed */
    accessCount: number,
    /** Timestamp of last access for LRU calculations */
    lastAccessed: number,
    /** Sequence number for tie-breaking in LRU eviction */
    accessSequence: number
} | {
    /** Weak reference to the cached object value */
    value: WeakRef<object>,
    /** Timestamp when this item was created */
    createdAt: number,
    /** Timestamp when this item expires */
    expiresAt: number,
    /** Number of times this item has been accessed */
    accessCount: number,
    /** Timestamp of last access for LRU calculations */
    lastAccessed: number,
    /** Sequence number for tie-breaking in LRU eviction */
    accessSequence: number,
    /** Flag indicating this is a WeakRef item */
    isWeak: true
}

/**
 * Type alias for the memoization cache map.
 *
 * @template T - The function type being memoized
 */
type MemoCache<T extends AnyFunc> = Map<string, CacheItem<ReturnType<T>>>;

/**
 * Statistics about cache performance and usage.
 */
type CacheStats = {
    /** Number of cache hits */
    hits: number,
    /** Number of cache misses */
    misses: number,
    /** Hit rate as a ratio (hits / (hits + misses)) */
    hitRate: number,
    /** Current number of items in cache */
    size: number,
    /** Number of items evicted due to size limits */
    evictions: number
}

/**
 * Symbol used as a marker to indicate that a stale-while-revalidate timeout has occurred.
 * This allows distinguishing between a function that returns false and a timeout.
 */
const TIMEOUT_SYMBOL = Symbol('stale-timeout-marker');

/**
 * Enhanced memoized function with additional cache management methods.
 *
 * @template T - The original function type
 */
export type EnhancedMemoizedFunction<T extends AnyFunc> = T & {
    /** Cache management interface */
    cache: {
        /** Clears all cached items and stops background cleanup */
        clear: () => void;
        /** Removes a specific item from cache by key */
        delete: (key: string) => boolean;
        /** Checks if a key exists in cache */
        has: (key: string) => boolean;
        /** Current number of items in cache */
        get size(): number;
        /** Returns cache performance statistics */
        stats: () => CacheStats;
        /** Returns an iterator of all cache keys */
        keys: () => IterableIterator<string>;
        /** Returns all cache entries as key-value pairs */
        entries: () => Array<[string, ReturnType<T> | undefined]>;
    }
};

/**
 * Validates memoization options and throws descriptive errors for invalid values.
 *
 * @template T - The function type being memoized
 * @param opts - The options to validate
 * @throws {Error} When options are invalid
 */
const validateOpts = <T extends AnyFunc>(opts: MemoizeOptions<T>) => {

    assert(isPlainObject(opts), 'opts must be an object');
    assertOptional(opts.ttl, typeof opts.ttl === 'number' && opts.ttl >= 0, 'ttl must be a positive number');
    assertOptional(opts.maxSize, typeof opts.maxSize === 'number' && opts.maxSize >= 0, 'maxSize must be a positive number');
    assertOptional(opts.onError, isFunction(opts.onError), 'onError must be a function');
    assertOptional(opts.generateKey, isFunction(opts.generateKey), 'generateKey must be a function');
    assertOptional(opts.useWeakRef, typeof opts.useWeakRef === 'boolean', 'useWeakRef must be a boolean');
    assertOptional(opts.cleanupInterval, typeof opts.cleanupInterval === 'number', 'cleanupInterval must be a number');
    assertOptional(opts.staleIn, typeof opts.staleIn === 'number' && opts.staleIn >= 0, 'staleIn must be a positive number or zero');
    assertOptional(opts.staleTimeout, typeof opts.staleTimeout === 'number' && opts.staleTimeout >= 0, 'staleTimeout must be a positive number or zero');

    // Validate staleIn vs TTL relationship
    if (opts.staleIn !== undefined && opts.ttl !== undefined && opts.staleIn >= opts.ttl) {
        throw new Error('staleIn must be less than ttl when both are specified');
    }
}

/**
 * Manages cache statistics and cleanup operations for memoized functions.
 *
 * This class handles:
 * - Tracking cache hits, misses, and evictions
 * - Background cleanup of expired entries
 * - Access sequence numbering for LRU eviction
 *
 * @template T - The function type being memoized
 */
class CacheManager<T extends AnyFunc> {
    /** Internal statistics tracking */
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0
    };

    /** Timer for background cleanup operations */
    private cleanupTimer: NodeJS.Timeout | undefined = undefined;
    /** Monotonically increasing sequence number for access tracking */
    private accessSequence = 0;

    /**
     * Creates a new cache manager.
     *
     * @param cache - The cache map to manage
     * @param cleanupInterval - Interval in milliseconds for background cleanup
     */
    constructor(
        private cache: MemoCache<T>,
        private cleanupInterval: number
    ) {
        if (cleanupInterval > 0) {
            this.startCleanupTimer();
        }
    }

    /**
     * Records a cache hit.
     */
    recordHit(): void {
        this.stats.hits++;
    }

    /**
     * Records a cache miss.
     */
    recordMiss(): void {
        this.stats.misses++;
    }

    /**
     * Records a cache eviction.
     */
    recordEviction(): void {
        this.stats.evictions++;
    }

    /**
     * Gets the next access sequence number for LRU tie-breaking.
     *
     * @returns The next sequence number
     */
    getNextSequence(): number {
        return ++this.accessSequence;
    }

    /**
     * Returns comprehensive cache statistics.
     *
     * @returns Object containing hits, misses, hit rate, size, and evictions
     */
    getStats(): CacheStats {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            hitRate: total > 0 ? this.stats.hits / total : 0,
            size: this.cache.size
        };
    }

    /**
     * Starts the background cleanup timer.
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(
            () => this.cleanupExpired(),
            this.cleanupInterval
        );

        // Don't keep the process alive just for cleanup
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }

    /**
     * Removes expired entries from the cache.
     */
    private cleanupExpired(): void {

        const now = Date.now();

        for (const [key, item] of this.cache.entries()) {

            if (item.expiresAt <= now) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Destroys the cache manager and stops background cleanup.
     */
    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }
}

/**
 * Implements true LRU eviction by finding the least recently used item.
 *
 * Uses both timestamp and sequence number for accurate LRU determination,
 * with sequence numbers providing tie-breaking when timestamps are identical.
 *
 * @template T - The function type being memoized
 * @param cache - The cache to evict from
 */
const evictLRU = <T extends AnyFunc>(cache: MemoCache<T>): void => {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    let oldestSequence = Infinity;

    for (const [key, item] of cache.entries()) {
        // Use sequence number for tie-breaking when timestamps are identical
        const isOlder = item.lastAccessed < oldestTime ||
                       (item.lastAccessed === oldestTime && item.accessSequence < oldestSequence);

        if (isOlder) {
            oldestTime = item.lastAccessed;
            oldestSequence = item.accessSequence;
            oldestKey = key;
        }
    }

    if (oldestKey) {
        cache.delete(oldestKey);
    }
};

/**
 * Safely gets value from cache item, handling WeakRef dereferencing.
 *
 * @template T - The type of the cached value
 * @param item - The cache item to extract value from
 * @returns The cached value, or undefined if WeakRef was garbage collected
 */
const getCacheValue = <T>(item: CacheItem<T>): { value: T, wasGarbageCollected: boolean } => {
    if ('isWeak' in item && item.isWeak) {
        const weakValue = item.value.deref();
        if (weakValue) {
            return { value: weakValue as T, wasGarbageCollected: false };
        }
        return { value: undefined as T, wasGarbageCollected: true };
    }
    return { value: item.value as T, wasGarbageCollected: false };
};

/**
 * Determines if a cache item is stale based on the staleIn threshold.
 *
 * @template T - The type of the cached value
 * @param item - The cache item to check
 * @param now - Current timestamp
 * @param staleIn - Staleness threshold in milliseconds
 * @returns True if the item is stale but not expired
 */
const isStale = <T>(item: CacheItem<T>, now: number, staleIn: number): boolean => {
    const age = now - item.createdAt;
    return age >= staleIn && now < item.expiresAt;
};

/**
 * Creates a cache item with appropriate metadata and optional WeakRef wrapping.
 *
 * @template T - The type of the value to cache
 * @param value - The value to cache
 * @param createdAt - Timestamp when this item was created
 * @param expiresAt - Timestamp when this item expires
 * @param useWeakRef - Whether to use WeakRef for object values
 * @param accessSequence - Sequence number for LRU tracking
 * @returns A properly formatted cache item
 */
const createCacheItem = <T>(
    value: T,
    createdAt: number,
    expiresAt: number,
    useWeakRef: boolean,
    accessSequence: number
): CacheItem<T> => {

    // Only use WeakRef if value is an object and useWeakRef is true
    if (useWeakRef && typeof value === 'object' && value !== null) {
        return {
            value: new WeakRef(value as object),
            createdAt,
            expiresAt,
            accessCount: 1,
            lastAccessed: createdAt,
            accessSequence,
            isWeak: true
        } as CacheItem<T>;
    }

    return {
        value,
        createdAt,
        expiresAt,
        accessCount: 1,
        lastAccessed: createdAt,
        accessSequence
    };
};

/**
 * Runs the first part of the memoization function before
 * splitting between sync and async execution paths.
 *
 * This function handles:
 * - Key generation with error handling
 * - Cache lookup and validation
 * - Expiration checking
 * - Stale detection for stale-while-revalidate pattern
 * - Access statistics updates
 *
 * @template T - The function type being memoized
 * @param opts - Options containing function, arguments, and cache state
 * @returns Object containing cache lookup results and metadata
 */
const prepareMemo = <T extends AnyFunc>(
    opts: {
        fn: T,
        args: Parameters<T>,
        opts: MemoizeOptions<T>,
        cache: MemoCache<T>,
        cacheManager: CacheManager<T>
    }
): {
    key: string | null,
    now: number,
    isCached: boolean,
    didExpire: boolean,
    isStaleButValid: boolean,
    value: ReturnType<T> | undefined
} => {

    const {
        args,
        opts: {
            onError,
            generateKey = serializer,
            staleIn
        },
        cache,
        cacheManager
    } = opts;

    const now = Date.now();

    const [key, keyError] = attemptSync(() => generateKey(args));

    if (keyError) {
        onError?.(keyError, args);
        cacheManager.recordMiss();
        return {
            key,
            now,
            isCached: false,
            didExpire: false,
            isStaleButValid: false,
            value: undefined
        }
    }

    const hasCache = cache.has(key);

    if (hasCache) {
        const item = cache.get(key)!;

        if (item && item.expiresAt > now) {
            // Update access statistics for LRU
            item.lastAccessed = now;
            item.accessCount++;
            item.accessSequence = cacheManager.getNextSequence();

            const { value, wasGarbageCollected } = getCacheValue(item);
            if (!wasGarbageCollected) {
                // Check if item is stale but still valid
                const isStaleItem = staleIn !== undefined ? isStale(item, now, staleIn) : false;

                cacheManager.recordHit();
                return {
                    key,
                    now,
                    isCached: true,
                    didExpire: false,
                    isStaleButValid: isStaleItem,
                    value
                }
            }
        }

        // Item expired or WeakRef was garbage collected - delete it
        cache.delete(key);
        cacheManager.recordMiss();
        return {
            key,
            now,
            isCached: false,
            didExpire: true,
            isStaleButValid: false,
            value: undefined
        }
    }

    cacheManager.recordMiss();
    return {
        key,
        now,
        isCached: false,
        didExpire: false,
        isStaleButValid: false,
        value: undefined
    }
};

/**
 * Runs the second part of the memoization function after
 * splitting between sync and async execution paths.
 *
 * This function handles:
 * - Error processing and reporting
 * - Cache storage of successful results
 * - LRU eviction when cache is full
 *
 * @template T - The function type being memoized
 * @param opts - Options containing execution results and cache state
 * @returns The function result (may be undefined on error)
 */
const processMemo = <T extends AnyFunc>(
    opts: {
        value?: ReturnType<T> | null,
        error?: Error | null,
        key?: string | null,
        args: Parameters<T>,
        now: number,
        opts: MemoizeOptions<T>,
        cache: MemoCache<T>,
        cacheManager: CacheManager<T>
    }
) => {

    const {
        value,
        error,
        args,
        key,
        now,
        opts: {
            onError = noop,
            ttl = 60000,
            maxSize = 1000,
            useWeakRef = false
        },
        cache,
        cacheManager
    } = opts;

    if (error) {
        onError(error, args);
    }

    if (key && !error) {
        // Check if we need to evict before adding
        if (maxSize && cache.size >= maxSize) {
            evictLRU(cache);
            cacheManager.recordEviction();
        }

        const accessSequence = cacheManager.getNextSequence();
        cache.set(
            key,
            createCacheItem<ReturnType<T>>(
                value!,
                now,
                now + ttl,
                useWeakRef,
                accessSequence
            )
        );
    }

    return value;
}

/**
 * Memoizes a synchronous function with intelligent caching, LRU eviction, and comprehensive statistics.
 *
 * Features:
 * - Time-based expiration (TTL)
 * - Least Recently Used (LRU) eviction
 * - Background cleanup of expired entries
 * - WeakRef support for memory management
 * - Enhanced key generation for complex objects
 * - Comprehensive cache statistics
 * - Error handling and reporting
 *
 * @template T - The synchronous function type to memoize
 * @param fn - The function to memoize
 * @param opts - Memoization configuration options
 * @returns The memoized function with enhanced cache management methods
 *
 * @example
 * ```typescript
 * const fib = (n: number) => {
 *     if (n <= 1) return n;
 *     return fib(n - 1) + fib(n - 2);
 * }
 *
 * const memoizedFib = memoizeSync(fib, {
 *     ttl: 1000,
 *     maxSize: 1000,
 *     onError: (error, args) => {
 *         console.error('Memoization error:', error);
 *     }
 * });
 *
 * const result = memoizedFib(10); // takes 10ms
 * console.log(result); // 55
 *
 * const result2 = memoizedFib(10); // takes 0ms (cached)
 * console.log(result2); // 55
 *
 * // Check cache statistics
 * console.log(memoizedFib.cache.stats());
 * // { hits: 1, misses: 1, hitRate: 0.5, size: 1, evictions: 0 }
 *
 * // Clear cache if needed
 * memoizedFib.cache.clear();
 * ```
 *
 * @example
 * ```typescript
 * // With custom key generation
 * const expensiveCalculation = (data: { id: string, params: any[] }) => {
 *     // Expensive computation...
 *     return data.id + data.params.join(',');
 * };
 *
 * const memoizedCalc = memoizeSync(expensiveCalculation, {
 *     ttl: 5000,
 *     maxSize: 100,
 *     generateKey: (args) => `${args[0].id}-${args[0].params.length}`,
 *     onError: console.error
 * });
 * ```
 */
export const memoizeSync = <T extends AnyFunc>(
    fn: T,
    opts: MemoizeOptions<T> = {}
): EnhancedMemoizedFunction<T> => {

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'memoize');

    validateOpts(opts);

    const cache: MemoCache<T> = new Map();
    const cacheManager = new CacheManager(cache, opts.cleanupInterval ?? 60000);

    const memoized = function (...args: Parameters<T>) {
        const {
            key,
            now,
            isCached,
            didExpire,
            isStaleButValid,
            value: memoValue
        } = prepareMemo({ fn, args, opts, cache, cacheManager });

        // If cached and not expired, check for stale-while-revalidate behavior
        if (isCached && !didExpire) {

            if (isStaleButValid) {

                // For sync functions with staleTimeout: execute synchronously and return fresh data
                // For sync functions without staleTimeout: return stale data immediately
                if (
                    opts.staleTimeout !== undefined &&
                    key !== null
                ) {

                    // staleTimeout specified - execute function synchronously
                    const [freshValue, error] = attemptSync(() => fn(...args));

                    if (!error) {

                        // Update cache with fresh value
                        const accessSequence = cacheManager.getNextSequence();

                        cache.set(
                            key,
                            createCacheItem(
                                freshValue,
                                now,
                                now + (opts.ttl ?? 60000),
                                opts.useWeakRef ?? false,
                                accessSequence
                            )
                        );

                        return freshValue;
                    }

                    // Return stale value if fresh fetch failed
                    return memoValue;
                }

                // No staleTimeout specified - return stale data immediately
                return memoValue;
            }

            return memoValue;
        }

        // Don't execute function if key generation failed
        if (key === null) {
            return undefined as ReturnType<T>;
        }

        const [value, error] = attemptSync(() => fn(...args));

        return processMemo({
            value,
            error,
            args,
            key,
            now,
            opts,
            cache,
            cacheManager
        });
    } as EnhancedMemoizedFunction<T>;

    // Add cache methods
    Object.defineProperty(memoized, 'cache', {
        value: {
            clear: () => {
                cache.clear();
                cacheManager.destroy();
            },
            delete: (key: string) => cache.delete(key),
            has: (key: string) => cache.has(key),
            get size() {
                return cache.size;
            },
            stats: () => cacheManager.getStats(),
            keys: () => cache.keys(),
            entries: () => {
                const entries: Array<[string, ReturnType<T> | undefined]> = [];
                for (const [key, item] of cache.entries()) {
                    const { value } = getCacheValue(item);
                    entries.push([key, value]);
                }
                return entries;
            }
        },
        enumerable: false,
        configurable: false
    });

    markWrapped(memoized, 'memoize');

    return memoized;
}

/**
 * Memoizes an asynchronous function with intelligent caching, LRU eviction, and comprehensive statistics.
 *
 * Features:
 * - Time-based expiration (TTL)
 * - Least Recently Used (LRU) eviction
 * - Background cleanup of expired entries
 * - WeakRef support for memory management
 * - Enhanced key generation for complex objects
 * - Comprehensive cache statistics
 * - Error handling and reporting
 * - Full async/await support
 *
 * @template T - The asynchronous function type to memoize
 * @param fn - The async function to memoize
 * @param opts - Memoization configuration options
 * @returns The memoized async function with enhanced cache management methods
 *
 * @example
 * ```typescript
 * const getUser = async (id: string) => {
 *     const response = await fetch(`https://api.example.com/users/${id}`);
 *     return response.json();
 * }
 *
 * const memoizedGetUser = memoize(getUser, {
 *     ttl: 300000, // 5 minutes
 *     maxSize: 1000,
 *     onError: (error, args) => {
 *         console.error('API error:', error);
 *     }
 * });
 *
 * const user = await memoizedGetUser('123'); // takes 250ms
 * console.log(user);
 *
 * const user2 = await memoizedGetUser('123'); // takes 0ms (cached)
 * console.log(user2);
 *
 * // Check cache statistics
 * console.log(memoizedGetUser.cache.stats());
 * // { hits: 1, misses: 1, hitRate: 0.5, size: 1, evictions: 0 }
 * ```
 *
 * @example
 * ```typescript
 * // With WeakRef for large objects
 * const fetchLargeData = async (params: { query: string, filters: object }) => {
 *     // Returns large object that might be garbage collected
 *     return await api.fetchData(params);
 * };
 *
 * const memoizedFetch = memoize(fetchLargeData, {
 *     ttl: 60000,
 *     maxSize: 50,
 *     useWeakRef: true, // Allow GC of large objects
 *     onError: console.error
 * });
 * ```
 */
export const memoize = <T extends AnyAsyncFunc>(
    fn: T,
    opts: MemoizeOptions<T> = {}
): EnhancedMemoizedFunction<T> => {

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'memoize');

    validateOpts(opts);

    const cache: MemoCache<T> = new Map();
    const cacheManager = new CacheManager(cache, opts.cleanupInterval ?? 60000);

    const memoized = async function (...args: Parameters<T>) {
        const {
            key,
            isCached,
            didExpire,
            isStaleButValid,
            value: memoValue
        } = prepareMemo({ fn, args, opts, cache, cacheManager });

        // If cached and not expired, check for stale-while-revalidate behavior
        if (isCached && !didExpire) {
            if (isStaleButValid) {
                // For async functions with staleTimeout specified: race fresh fetch against timeout
                // For async functions without staleTimeout: return stale immediately
                if (opts.staleTimeout !== undefined) {
                    // staleTimeout specified - race fresh fetch against timeout
                    if (key !== null) {
                        // For zero timeout, return stale immediately but still trigger background refresh
                        if (opts.staleTimeout === 0) {
                            // Trigger background refresh without waiting
                            attempt(
                                () => fn(...args)
                            ).then(([freshValue, error]) => {

                                if (!error) {

                                    const accessSequence = cacheManager.getNextSequence();
                                    const freshNow = Date.now();

                                    cache.set(
                                        key,
                                        createCacheItem(
                                            freshValue,
                                            freshNow,
                                            freshNow + (opts.ttl ?? 60000),
                                            opts.useWeakRef ?? false,
                                            accessSequence
                                        )
                                    );
                                }
                            })
                            return memoValue;
                        }

                        // Race fresh fetch against timeout
                        const freshPromise = attempt(() => fn(...args));
                        const timeoutPromise = wait(opts.staleTimeout, TIMEOUT_SYMBOL);

                        const winner = await Promise.race([freshPromise, timeoutPromise]);

                        if (winner === TIMEOUT_SYMBOL) {

                            // Timeout won, return stale data immediately
                            return memoValue;
                        }

                        // Fresh data won the race
                        const [freshValue, error] = winner as Awaited<typeof freshPromise>;

                        if (!error) {

                            // Update cache with fresh value
                            const accessSequence = cacheManager.getNextSequence();
                            const freshNow = Date.now();

                            cache.set(
                                key,
                                createCacheItem(
                                    freshValue,
                                    freshNow,
                                    freshNow + (opts.ttl ?? 60000),
                                    opts.useWeakRef ?? false,
                                    accessSequence
                                )
                            );

                            return freshValue;
                        }

                        // Return stale value if fresh fetch failed
                        return memoValue;
                    }
                }

                // No staleTimeout specified - return stale data immediately
                return memoValue;
            }
            return memoValue;
        }

        // Don't execute function if key generation failed
        if (key === null) {
            return undefined as ReturnType<T>;
        }

        const [value, error] = await attempt(() => fn(...args));

        return processMemo({
            value,
            error,
            args,
            key,
            now: Date.now(), // Use current time after async execution
            opts,
            cache,
            cacheManager
        });
    } as EnhancedMemoizedFunction<T>;

    // Add cache methods
    Object.defineProperty(memoized, 'cache', {
        value: {
            clear: () => {
                cache.clear();
                cacheManager.destroy();
            },
            delete: (key: string) => cache.delete(key),
            has: (key: string) => cache.has(key),
            get size() {
                return cache.size;
            },
            stats: () => cacheManager.getStats(),
            keys: () => cache.keys(),
            entries: () => {
                const entries: Array<[string, ReturnType<T> | undefined]> = [];
                for (const [key, item] of cache.entries()) {
                    const { value } = getCacheValue(item);
                    entries.push([key, value]);
                }
                return entries;
            }
        },
        enumerable: false,
        configurable: false
    });

    markWrapped(memoized, 'memoize');

    return memoized;
};

