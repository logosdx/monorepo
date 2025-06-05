import { attempt, attemptSync } from './attempt.ts';
import { AnyAsyncFunc, AnyFunc } from './_helpers.ts';

export type MemoizeOptions<T extends AnyFunc> = {

    /**
     * Time to live in milliseconds.
     *
     * @default 1 * 60 * 1000
     */
    ttl: number,

    /**
     * Maximum number of items in the cache.
     *
     * @default 1000
     */
    maxSize: number,

    /**
     * Function to call when an error occurs.
     */
    onError: (error: Error, args: Parameters<T>) => void

    /**
     * Generates the cache key from the arguments.
     *
     * Default implementation handles object property ordering,
     * circular references, and non-serializable values better than JSON.stringify
     *
     * @default enhanced key generator
     */
    generateKey?: (args: Parameters<T>) => string,

    /**
     * Whether to use WeakRef for large objects to prevent memory leaks.
     *
     * @default false
     */
    useWeakRef?: boolean,

    /**
     * Interval in milliseconds for background cleanup of expired entries.
     * Set to 0 to disable background cleanup.
     *
     * @default 60000 (1 minute)
     */
    cleanupInterval?: number
}

type CacheItem<T> = {
    value: T,
    expiresAt: number,
    accessCount: number,
    lastAccessed: number,
    accessSequence: number
} | {
    value: WeakRef<object>,
    expiresAt: number,
    accessCount: number,
    lastAccessed: number,
    accessSequence: number,
    isWeak: true
}

type MemoCache<T extends AnyFunc> = Map<string, CacheItem<ReturnType<T>>>;

type CacheStats = {
    hits: number,
    misses: number,
    hitRate: number,
    size: number,
    evictions: number
}

type EnhancedMemoizedFunction<T extends AnyFunc> = T & {
    cache: {
        clear: () => void;
        delete: (key: string) => boolean;
        has: (key: string) => boolean;
        get size(): number;
        stats: () => CacheStats;
        keys: () => IterableIterator<string>;
        entries: () => Array<[string, ReturnType<T> | undefined]>;
    }
};

const validateOpts = <T extends AnyFunc>(opts: MemoizeOptions<T>) => {

    if (typeof opts.ttl !== 'number' || opts.ttl <= 0) {
        throw new Error('ttl must be a positive number');
    }

    if (typeof opts.maxSize !== 'number' || opts.maxSize <= 0) {
        throw new Error('maxSize must be a positive number');
    }

    if (typeof opts.onError !== 'function') {
        throw new Error('onError must be a function');
    }

    if (opts.generateKey && typeof opts.generateKey !== 'function') {
        throw new Error('generateKey must be a function');
    }

    if (opts.useWeakRef && typeof opts.useWeakRef !== 'boolean') {
        throw new Error('useWeakRef must be a boolean');
    }

    if (opts.cleanupInterval && typeof opts.cleanupInterval !== 'number') {
        throw new Error('cleanupInterval must be a number');
    }
}

/**
 * Enhanced key generation that handles object property ordering,
 * circular references, and non-serializable values.
 */
const defaultKeyGenerator = <T extends AnyFunc>(args: Parameters<T>): string => {
    const seen = new WeakSet();

    const stringify = (value: any): string => {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return `"${value}"`;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'function') return `func:${value.name || 'anonymous'}:${value.length}`;
        if (value instanceof Date) return `date:${value.getTime()}`;
        if (value instanceof RegExp) return `regex:${value.toString()}`;

        if (typeof value === 'object') {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);

            if (Array.isArray(value)) {
                const result = `[${value.map(stringify).join(',')}]`;
                seen.delete(value);
                return result;
            }

            // Sort keys for consistent serialization
            const keys = Object.keys(value).sort();
            const pairs = keys.map(key => `"${key}":${stringify(value[key])}`);
            const result = `{${pairs.join(',')}}`;
            seen.delete(value);
            return result;
        }

        return String(value);
    };

    return args.map(stringify).join('|');
};

/**
 * Manages cache statistics and cleanup operations
 */
class CacheManager<T extends AnyFunc> {
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0
    };

    private cleanupTimer: NodeJS.Timeout | undefined = undefined;
    private accessSequence = 0;

    constructor(
        private cache: MemoCache<T>,
        private cleanupInterval: number
    ) {
        if (cleanupInterval > 0) {
            this.startCleanupTimer();
        }
    }

    recordHit(): void {
        this.stats.hits++;
    }

    recordMiss(): void {
        this.stats.misses++;
    }

    recordEviction(): void {
        this.stats.evictions++;
    }

    getNextSequence(): number {
        return ++this.accessSequence;
    }

    getStats(): CacheStats {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            hitRate: total > 0 ? this.stats.hits / total : 0,
            size: this.cache.size
        };
    }

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

    private cleanupExpired(): void {

        const now = Date.now();

        for (const [key, item] of this.cache.entries()) {

            if (item.expiresAt <= now) {
                this.cache.delete(key);
            }
        }
    }

    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }
}

/**
 * Implements true LRU eviction by finding the least recently used item
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
 * Safely gets value from cache item, handling WeakRef
 */
const getCacheValue = <T>(item: CacheItem<T>): T | undefined => {
    if ('isWeak' in item && item.isWeak) {
        const weakValue = item.value.deref();
        return weakValue ? (weakValue as T) : undefined;
    }
    return item.value as T;
};

/**
 * Creates a cache item, optionally using WeakRef for objects
 */
const createCacheItem = <T>(
    value: T,
    expiresAt: number,
    useWeakRef: boolean,
    accessSequence: number
): CacheItem<T> => {
    const now = Date.now();

    // Only use WeakRef if value is an object and useWeakRef is true
    if (useWeakRef && typeof value === 'object' && value !== null) {
        return {
            value: new WeakRef(value as object),
            expiresAt,
            accessCount: 1,
            lastAccessed: now,
            accessSequence,
            isWeak: true
        } as CacheItem<T>;
    }

    return {
        value,
        expiresAt,
        accessCount: 1,
        lastAccessed: now,
        accessSequence
    };
};

/**
 * Runs the first part of the memoization function before
 * splitting between sync and async.
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
    value: ReturnType<T> | undefined
} => {

    const {
        args,
        opts: {
            onError,
            generateKey = defaultKeyGenerator,
        },
        cache,
        cacheManager
    } = opts;

    const now = Date.now();

    const [key, keyError] = attemptSync(() => generateKey(args));

    if (keyError) {
        onError(keyError, args);
        cacheManager.recordMiss();
        return {
            key,
            now,
            isCached: false,
            didExpire: false,
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

            const value = getCacheValue(item);
            if (value !== undefined) {
                cacheManager.recordHit();
                return {
                    key,
                    now,
                    isCached: true,
                    didExpire: false,
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
            value: undefined
        }
    }

    cacheManager.recordMiss();
    return {
        key,
        now,
        isCached: false,
        didExpire: false,
        value: undefined
    }
};

/**
 * Runs the second part of the memoization function after
 * splitting between sync and async.
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
        opts: { onError, ttl, maxSize, useWeakRef = false },
        cache,
        cacheManager
    } = opts;

    if (error) {
        onError(error, args);
    }

    if (key && value !== null && value !== undefined) {
        // Check if we need to evict before adding
        if (maxSize && cache.size >= maxSize) {
            evictLRU(cache);
            cacheManager.recordEviction();
        }

        const accessSequence = cacheManager.getNextSequence();
        cache.set(key, createCacheItem(value, now + ttl, useWeakRef, accessSequence));
    }

    return value;
}

/**
 * Memoizes a function that is synchronous.
 *
 * @param fn function to memoize
 * @param opts options
 * @returns memoized function with enhanced cache methods
 *
 * @example
 *
 * const fib = (n: number) => {
 *     if (n <= 1) return n;
 *     return fib(n - 1) + fib(n - 2);
 * }
 *
 * const memoizedFib = memoizeSync(fib, {
 *     ttl: 1000,
 *     maxSize: 1000,
 *     onError: (error, args) => {
 *         console.error(error);
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
 * console.log(memoizedFib.cache.stats()); // { hits: 1, misses: 1, hitRate: 0.5, ... }
 *
 * // Clear cache if needed
 * memoizedFib.cache.clear();
 */
export const memoizeSync = <T extends AnyFunc>(
    fn: T,
    opts: MemoizeOptions<T>
): EnhancedMemoizedFunction<T> => {

    if (typeof fn !== 'function') {
        throw new Error('fn must be a function');
    }

    validateOpts(opts);

    const cache: MemoCache<T> = new Map();
    const cacheManager = new CacheManager(cache, opts.cleanupInterval ?? 60000);

    const memoized = function (...args: Parameters<T>) {
        const {
            key,
            now,
            isCached,
            didExpire,
            value: memoValue
        } = prepareMemo({ fn, args, opts, cache, cacheManager });

        if (isCached && !didExpire) {
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
                    entries.push([key, getCacheValue(item)]);
                }
                return entries;
            }
        },
        enumerable: false,
        configurable: false
    });

    return memoized;
}

/**
 * Memoizes a function that is asynchronous.
 *
 * @param fn function to memoize
 * @param opts options
 * @returns memoized function with enhanced cache methods
 *
 * @example
 *
 * const getUser = async (id: string) => {
 *     return await fetch(`https://api.example.com/users/${id}`);
 * }
 *
 * const memoizedGetUser = memoize(getUser, {
 *     ttl: 1000,
 *     maxSize: 1000,
 *     onError: (error, args) => {
 *         console.error(error);
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
 * console.log(memoizedGetUser.cache.stats()); // { hits: 1, misses: 1, hitRate: 0.5, ... }
 */
export const memoize = <T extends AnyAsyncFunc>(
    fn: T,
    opts: MemoizeOptions<T>
): EnhancedMemoizedFunction<T> => {

    if (typeof fn !== 'function') {
        throw new Error('fn must be a function');
    }

    validateOpts(opts);

    const cache: MemoCache<T> = new Map();
    const cacheManager = new CacheManager(cache, opts.cleanupInterval ?? 60000);

    const memoized = async function (...args: Parameters<T>) {
        const {
            key,
            now,
            isCached,
            didExpire,
            value: memoValue
        } = prepareMemo({ fn, args, opts, cache, cacheManager });

        if (isCached && !didExpire) {
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
                    entries.push([key, getCacheValue(item)]);
                }
                return entries;
            }
        },
        enumerable: false,
        configurable: false
    });

    return memoized;
};

