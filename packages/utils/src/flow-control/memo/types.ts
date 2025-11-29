import type { AsyncFunc, Func } from '../../types.ts';

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

    /** Timestamp when becomes stale for SWR (optional) */
    staleAt?: number | undefined;

    /** Number of cache hits for this item (for LRU) */
    accessCount?: number | undefined;

    /** Last access timestamp (for LRU) */
    lastAccessed?: number | undefined;

    /** Monotonic sequence number (for LRU tie-breaking) */
    accessSequence?: number | undefined;
}

/**
 * Cache adapter interface for pluggable storage backends.
 *
 * All methods are async to support Redis, IndexedDB, and other async backends.
 * Adapters handle their own LRU eviction and cleanup logic.
 *
 * @template T - The type of cached values
 */
export interface CacheAdapter<T> {

    /** Retrieve cache item by key. Returns undefined if missing. */
    get(key: string): Promise<CacheItem<T> | null>;

    /**
     * Store cache item with given key.
     * @param key - Cache key
     * @param item - Cache item with value and metadata
     * @param expiresAt - Optional expiration timestamp for backends like Redis
     */
    set(key: string, item: CacheItem<T>, expiresAt?: number): Promise<void>;

    /** Remove specific key. Returns true if existed. */
    delete(key: string): Promise<boolean>;

    /** Remove all cached items. */
    clear(): Promise<void>;

    /** Check if key exists (may still be expired - adapter handles expiration). */
    has(key: string): Promise<boolean>;

    /** Current number of cached items (may include expired items). */
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
    generateKey?: (...args: Parameters<T>) => string;

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
    adapter?: CacheAdapter<ReturnType<T>>;

    /**
     * Pre-serialization check. Return false to bypass cache and execute the function directly.
     * (Still deduped if deduplication is enabled separately)
     *
     * This is called BEFORE key generation/serialization. Use this for conditional
     * caching based on request context or parameters.
     *
     * @example
     * ```typescript
     * const fetcher = memoize(fetchData, {
     *     shouldCache: (url, opts) => !opts?.bustCache
     * });
     * ```
     */
    shouldCache?: (...args: Parameters<T>) => boolean;
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
