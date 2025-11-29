import { assert, isOptional } from '../../validation/index.ts';
import type { CacheAdapter, CacheItem, MapCacheAdapterOptions } from './types.ts';
import { isExpired, evictLRU } from './helpers.ts';

/**
 * Map-based cache adapter with LRU eviction and background cleanup.
 *
 * Provides cache operations using a Map with:
 * - LRU eviction when maxSize is reached
 * - Background cleanup of expired entries
 * - Access statistics tracking
 *
 * All methods are async to conform to CacheAdapter interface,
 * but operations are synchronous internally for performance.
 *
 * @example
 * const adapter = new MapCacheAdapter({ maxSize: 500, cleanupInterval: 30000 });
 * await adapter.set('key', item, Date.now() + 60000);
 * const cached = await adapter.get('key');
 */
export class MapCacheAdapter<T> implements CacheAdapter<T> {

    #cache = new Map<string, CacheItem<T>>();
    #maxSize: number;
    #cleanupInterval: number;
    #cleanupTimer?: NodeJS.Timeout | number | undefined;
    #stats = {
        evictions: 0
    };

    constructor(opts: MapCacheAdapterOptions = {}) {

        const {
            maxSize = 1000,
            cleanupInterval = 60000
        } = opts;

        assert(maxSize > 0, 'maxSize must be greater than 0');
        assert(isOptional(cleanupInterval, (val) => typeof val === 'number' && val >= 0), 'cleanupInterval must be >= 0');

        this.#maxSize = maxSize;
        this.#cleanupInterval = cleanupInterval;

        if (cleanupInterval > 0) {

            this.#startCleanup();
        }
    }

    async get(key: string): Promise<CacheItem<T> | null> {

        const item = this.#cache.get(key);

        if (!item) {

            return null;
        }

        if (isExpired(item)) {

            this.#cache.delete(key);
            return null;
        }

        return item;
    }

    async set(key: string, value: CacheItem<T>, _expiresAt?: number): Promise<void> {

        if (this.#cache.size >= this.#maxSize && !this.#cache.has(key)) {

            evictLRU(this.#cache);
            this.#stats.evictions++;
        }

        this.#cache.set(key, value);
    }

    async delete(key: string): Promise<boolean> {

        return this.#cache.delete(key);
    }

    async clear(): Promise<void> {

        this.#cache.clear();

        if (this.#cleanupTimer !== undefined) {

            clearInterval(this.#cleanupTimer);
            this.#cleanupTimer = undefined;
        }
    }

    async has(key: string): Promise<boolean> {

        const item = this.#cache.get(key);

        if (!item) {

            return false;
        }

        if (isExpired(item)) {

            this.#cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Sync iterator over all cache keys.
     * Kept for memoize compatibility.
     */
    *keys(): IterableIterator<string> {

        for (const key of this.#cache.keys()) {

            yield key;
        }
    }

    /**
     * Sync iterator over all cache entries.
     * Kept for memoize compatibility.
     */
    *entries(): IterableIterator<[string, CacheItem<T>]> {

        for (const entry of this.#cache.entries()) {

            yield entry;
        }
    }

    get size(): number {

        return this.#cache.size;
    }

    /**
     * Gets eviction statistics.
     *
     * @returns Object with eviction count
     */
    getStats() {

        return {
            evictions: this.#stats.evictions,
            size: this.#cache.size
        };
    }

    /**
     * Manually trigger cleanup of expired entries.
     */
    cleanupExpired(): void {

        const now = Date.now();

        for (const [key, item] of this.#cache.entries()) {

            if (now >= item.expiresAt) {

                this.#cache.delete(key);
            }
        }
    }

    #startCleanup(): void {

        this.#cleanupTimer = setInterval(
            () => this.cleanupExpired(),
            this.#cleanupInterval
        );

        if (typeof (this.#cleanupTimer as NodeJS.Timeout).unref === 'function') {

            (this.#cleanupTimer as NodeJS.Timeout).unref();
        }
    }
}
