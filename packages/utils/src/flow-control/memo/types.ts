import type { AsyncFunc, Func, MaybePromise } from '../../types.ts';

/**
 * Cache statistics for monitoring performance.
 */
export interface CacheStats {

    /** Number of successful cache lookups */
    hits: number;

    /** Number of cache misses (had to execute function) */
    misses: number;

    /** Number of items evicted due to size limits */
    evictions: number;

    /** Hit rate percentage (hits / (hits + misses)) */
    hitRate: number;

    /** Current number of cached items */
    size: number;
}

/**
 * Cache item structure with metadata for TTL, LRU, and staleness tracking.
 *
 * @template T - The type of the cached value
 */
export interface CacheItem<T> {

    /** The cached value (or WeakRef if useWeakRef enabled) */
    value: T | WeakRef<object>;

    /** Timestamp when created (for staleness calculation) */
    createdAt: number;

    /** Timestamp when expires (for TTL) */
    expiresAt: number;

    /** Number of cache hits for this item */
    accessCount: number;

    /** Last access timestamp (for LRU) */
    lastAccessed: number;

    /** Monotonic sequence number (for LRU tie-breaking) */
    accessSequence: number;
}

/**
 * Cache adapter interface supporting both sync and async operations.
 * Enables pluggable backends like Redis, Memcached, or custom implementations.
 *
 * @template K - Key type
 * @template V - Value type
 */
export interface CacheAdapter<K, V> {

    /** Retrieve value by key. Returns undefined if missing or expired. */
    get(key: K): MaybePromise<V | undefined>;

    /** Store value with expiration timestamp. */
    set(key: K, value: V, expiresAt: number): MaybePromise<void>;

    /** Remove specific key. Returns true if existed. */
    delete(key: K): MaybePromise<boolean>;

    /** Remove all keys. */
    clear(): MaybePromise<void>;

    /** Check if key exists (non-expired). */
    has(key: K): MaybePromise<boolean>;

    /** Iterate over all keys. */
    keys(): AsyncIterable<K> | Iterable<K>;

    /** Iterate over all entries. */
    entries(): AsyncIterable<[K, V]> | Iterable<[K, V]>;

    /** Current number of cached items. */
    readonly size: number;
}

/**
 * Options for memoization.
 *
 * @template T - Function type
 */
export interface MemoizeOptions<T extends Func | AsyncFunc> {

    /** Time to live in milliseconds. Default: 60000 (1 minute) */
    ttl?: number;

    /** Maximum cache size. When exceeded, LRU items evicted. Default: 1000 */
    maxSize?: number;

    /** Custom key generator from function arguments. Default: enhanced serializer */
    generateKey?: (args: Parameters<T>) => string;

    /** Error handler for key generation or execution failures */
    onError?: (error: Error, args: Parameters<T>) => void;

    /** Background cleanup interval in ms. 0 to disable. Default: 60000 */
    cleanupInterval?: number;

    /** Time in ms when data becomes stale (stale-while-revalidate). Default: undefined */
    staleIn?: number;

    /** Max wait for fresh data when stale. 0 = return stale immediately. Default: undefined */
    staleTimeout?: number;

    /** Use WeakRef for object values (allows GC). Default: false */
    useWeakRef?: boolean;

    /** Custom cache adapter (Redis, etc.). Default: MapCacheAdapter */
    adapter?: CacheAdapter<string, CacheItem<ReturnType<T>>>;
}

/**
 * Enhanced memoized function with cache management methods.
 *
 * @template T - Function type
 */
export interface EnhancedMemoizedFunction<T extends Func | AsyncFunc> {

    /** The original function signature */
    (...args: Parameters<T>): ReturnType<T>;

    /** Cache management interface */
    cache: {

        /** Clear all cached items and stop background cleanup */
        clear: () => void;

        /** Remove specific item from cache by key */
        delete: (key: string) => boolean;

        /** Check if key exists in cache */
        has: (key: string) => boolean;

        /** Current number of cached items */
        readonly size: number;

        /** Get cache performance statistics */
        stats: () => CacheStats;

        /** Iterator of all cache keys */
        keys: () => IterableIterator<string>;

        /** All cache entries as key-value pairs */
        entries: () => Array<[string, ReturnType<T> | undefined]>;
    };
}

/**
 * Options for MapCacheAdapter.
 */
export interface MapCacheAdapterOptions {

    /** Maximum cache size. When exceeded, LRU items evicted. Default: 1000 */
    maxSize?: number;

    /** Background cleanup interval in ms. 0 to disable. Default: 60000 */
    cleanupInterval?: number;

    /** Use WeakRef for object values (allows GC). Default: false */
    useWeakRef?: boolean;
}
