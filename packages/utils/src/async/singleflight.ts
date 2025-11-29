import type { CacheAdapter, CacheItem } from '../flow-control/memo/types.ts';
import { MapCacheAdapter } from '../flow-control/memo/adapter.ts';

/**
 * Cache entry returned by SingleFlight with computed staleness.
 *
 * @template T - The type of the cached value
 */
export interface CacheEntry<T> {

    /** The cached value */
    value: T;

    /** Whether the entry is stale (past staleAt but before expiresAt) */
    isStale: boolean;

    /** Timestamp when the entry expires (ms since epoch) */
    expiresAt: number;

    /** Timestamp when the entry becomes stale for SWR (ms since epoch) */
    staleAt?: number | undefined;
}

/**
 * In-flight request entry.
 *
 * @template T - The type of the promised value
 */
export interface InflightEntry<T> {

    /** The shared promise for this request */
    promise: Promise<T>;

    /** Number of callers currently waiting on this promise */
    waitingCount: number;
}

/**
 * Configuration options for SingleFlight.
 *
 * @template T - The type of values to cache
 */
export interface SingleFlightOptions<T> {

    /** External cache adapter (Redis, IndexedDB, etc.). If omitted, uses MapCacheAdapter. */
    adapter?: CacheAdapter<T> | undefined;

    /** Default TTL for cache entries (ms). Default: 60000 (1 minute) */
    defaultTtl?: number | undefined;

    /** Default stale threshold for SWR (ms). Default: undefined (no SWR) */
    defaultStaleIn?: number | undefined;

    /** Maximum cache size for default adapter. Default: 1000 */
    maxSize?: number | undefined;

    /** Background cleanup interval for default adapter (ms). Default: 60000 */
    cleanupInterval?: number | undefined;
}

/**
 * Options for setting cache entries.
 */
export interface SetCacheOptions {

    /** Time to live in milliseconds. Uses defaultTtl if not specified. */
    ttl?: number | undefined;

    /** Time until stale for SWR in milliseconds. Uses defaultStaleIn if not specified. */
    staleIn?: number | undefined;
}

/**
 * Statistics about SingleFlight state.
 */
export interface SingleFlightStats {

    /** Current number of cached items */
    cacheSize: number;

    /** Current number of in-flight requests */
    inflightCount: number;
}

/**
 * A generic coordinator for cache and in-flight request deduplication.
 *
 * SingleFlight is a **state manager** that provides primitives for:
 * - Caching values with TTL and stale-while-revalidate (SWR)
 * - Tracking in-flight promises to prevent duplicate concurrent executions
 *
 * It does **NOT** handle execution - callers control the flow and use
 * SingleFlight as a coordination layer.
 *
 * **Core principles:**
 * - Generic - No knowledge of HTTP, routes, methods, etc. Just keys and values.
 * - Primitives, not executor - Provides building blocks, caller orchestrates.
 * - Reusable - Can be used in FetchEngine, database queries, memoize, anywhere.
 * - Composable - Consumers add their own routing, serialization, events.
 * - Async-first - All cache operations are async for adapter flexibility.
 *
 * @template T - The type of values to cache/track
 *
 * @example
 * ```typescript
 * // Basic usage - deduplication only
 * const flight = new SingleFlight();
 *
 * async function fetchUser(id: string) {
 *     const key = `user:${id}`;
 *
 *     // Check in-flight
 *     const inflight = flight.getInflight(key);
 *     if (inflight) {
 *         flight.joinInflight(key);
 *         return inflight.promise;
 *     }
 *
 *     // Start new request
 *     const promise = api.fetchUser(id);
 *     const cleanup = flight.trackInflight(key, promise);
 *
 *     try {
 *         return await promise;
 *     }
 *     finally {
 *         cleanup();
 *     }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With caching and SWR
 * const flight = new SingleFlight<UserData>({
 *     defaultTtl: 60000,     // 1 minute cache
 *     defaultStaleIn: 30000  // Stale after 30 seconds
 * });
 *
 * async function fetchUser(id: string) {
 *     const key = `user:${id}`;
 *
 *     // Check cache first
 *     const cached = await flight.getCache(key);
 *     if (cached && !cached.isStale) {
 *         return cached.value;
 *     }
 *
 *     // Check in-flight
 *     const inflight = flight.getInflight(key);
 *     if (inflight) {
 *         flight.joinInflight(key);
 *         return inflight.promise;
 *     }
 *
 *     // Return stale immediately, revalidate in background
 *     if (cached?.isStale) {
 *         const promise = api.fetchUser(id);
 *         const cleanup = flight.trackInflight(key, promise);
 *         promise
 *             .then(value => flight.setCache(key, value))
 *             .finally(cleanup);
 *         return cached.value;
 *     }
 *
 *     // Fresh fetch
 *     const promise = api.fetchUser(id);
 *     const cleanup = flight.trackInflight(key, promise);
 *     try {
 *         const value = await promise;
 *         await flight.setCache(key, value);
 *         return value;
 *     }
 *     finally {
 *         cleanup();
 *     }
 * }
 * ```
 */
export class SingleFlight<T = unknown> {

    #adapter: CacheAdapter<T>;
    #inflight = new Map<string, { promise: Promise<T>; waitingCount: number }>();
    #defaultTtl: number;
    #defaultStaleIn?: number | undefined;

    /**
     * Creates a new SingleFlight instance.
     *
     * @param opts - Configuration options
     */
    constructor(opts?: SingleFlightOptions<T>) {

        this.#defaultTtl = opts?.defaultTtl ?? 60000;
        this.#defaultStaleIn = opts?.defaultStaleIn;
        this.#adapter = opts?.adapter ?? new MapCacheAdapter<T>({
            maxSize: opts?.maxSize ?? 1000,
            cleanupInterval: opts?.cleanupInterval ?? 60000
        });
    }

    // === Cache primitives ===

    /**
     * Get cached value if exists and not expired.
     *
     * Returns null if not cached or expired.
     * Returns `{ isStale: true }` if past staleAt but before expiresAt.
     *
     * @param key - Cache key
     * @returns Cache entry or null if not found/expired
     */
    async getCache(key: string): Promise<CacheEntry<T> | null> {

        const item = await this.#adapter.get(key);

        if (!item) {

            return null;
        }

        const now = Date.now();

        if (now >= item.expiresAt) {

            await this.#adapter.delete(key);
            return null;
        }

        const isStale = item.staleAt !== undefined && now >= item.staleAt;

        return {
            value: item.value as T,
            isStale,
            expiresAt: item.expiresAt,
            staleAt: item.staleAt
        };
    }

    /**
     * Set a cache entry.
     *
     * @param key - Cache key
     * @param value - Value to cache
     * @param opts - Optional TTL and staleIn overrides
     */
    async setCache(key: string, value: T, opts?: SetCacheOptions): Promise<void> {

        const ttl = opts?.ttl ?? this.#defaultTtl;
        const staleIn = opts?.staleIn ?? this.#defaultStaleIn;

        const now = Date.now();
        const item: CacheItem<T> = {
            value,
            createdAt: now,
            expiresAt: now + ttl,
            staleAt: staleIn !== undefined ? now + staleIn : undefined
        };

        await this.#adapter.set(key, item, item.expiresAt);
    }

    /**
     * Delete a cache entry.
     *
     * @param key - Cache key
     * @returns true if entry existed
     */
    async deleteCache(key: string): Promise<boolean> {

        return this.#adapter.delete(key);
    }

    /**
     * Check if key is cached (without returning value).
     *
     * Note: May return true for expired items if adapter doesn't clean eagerly.
     *
     * @param key - Cache key
     * @returns true if key exists in cache
     */
    async hasCache(key: string): Promise<boolean> {

        const exists = await this.#adapter.has(key);

        if (!exists) {

            return false;
        }

        // Verify not expired
        const item = await this.#adapter.get(key);

        return item !== null && Date.now() < item.expiresAt;
    }

    // === In-flight primitives ===

    /**
     * Get in-flight entry if exists.
     *
     * @param key - Request key
     * @returns In-flight entry or null if not in-flight
     */
    getInflight(key: string): InflightEntry<T> | null {

        const entry = this.#inflight.get(key);

        if (!entry) {

            return null;
        }

        return {
            promise: entry.promise,
            waitingCount: entry.waitingCount
        };
    }

    /**
     * Track an in-flight promise.
     *
     * Returns cleanup function to call on completion.
     *
     * @param key - Request key
     * @param promise - The promise to track
     * @returns Cleanup function
     */
    trackInflight(key: string, promise: Promise<T>): () => void {

        this.#inflight.set(key, {
            promise,
            waitingCount: 1
        });

        return () => {

            this.#inflight.delete(key);
        };
    }

    /**
     * Join an existing in-flight request.
     *
     * Increments waitingCount and returns new count.
     *
     * @param key - Request key
     * @returns New waiting count, or 0 if no in-flight request
     */
    joinInflight(key: string): number {

        const entry = this.#inflight.get(key);

        if (!entry) {

            return 0;
        }

        entry.waitingCount++;

        return entry.waitingCount;
    }

    /**
     * Check if key has in-flight request.
     *
     * @param key - Request key
     * @returns true if request is in-flight
     */
    hasInflight(key: string): boolean {

        return this.#inflight.has(key);
    }

    // === Lifecycle ===

    /**
     * Clear all state (cache + in-flight).
     */
    async clear(): Promise<void> {

        await this.clearCache();
        this.#inflight.clear();
    }

    /**
     * Clear only cache entries.
     */
    async clearCache(): Promise<void> {

        await this.#adapter.clear();
    }

    /**
     * Get statistics about current state.
     *
     * @returns Cache size and in-flight count
     */
    stats(): SingleFlightStats {

        return {
            cacheSize: this.#adapter.size,
            inflightCount: this.#inflight.size
        };
    }
}

// Re-export types for convenience
export type { CacheAdapter, CacheItem } from '../flow-control/memo/types.ts';
