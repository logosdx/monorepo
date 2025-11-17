import { assert, isOptional } from '../../validation/index.ts';
import type { CacheAdapter, CacheItem, MapCacheAdapterOptions } from './types.ts';
import { isExpired, evictLRU } from './helpers.ts';

/**
 * Map-based cache adapter with LRU eviction and background cleanup.
 *
 * Provides synchronous cache operations using a Map with:
 * - LRU eviction when maxSize is reached
 * - Background cleanup of expired entries
 * - Optional WeakRef support for memory management
 * - Access statistics tracking
 *
 * @example
 * const adapter = new MapCacheAdapter({ maxSize: 500, cleanupInterval: 30000 });
 * adapter.set('key', item, Date.now() + 60000);
 * const cached = adapter.get('key');
 */
export class MapCacheAdapter<V extends CacheItem<any>> implements CacheAdapter<string, V> {

    #cache = new Map<string, V>();
    #maxSize: number;
    #cleanupInterval: number;
    #cleanupTimer?: NodeJS.Timeout | number;
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

    get(key: string): V | undefined {

        const item = this.#cache.get(key);

        if (!item) {

            return undefined;
        }

        if (isExpired(item)) {

            this.#cache.delete(key);
            return undefined;
        }

        return item;
    }

    set(key: string, value: V, _expiresAt: number): void {

        if (this.#cache.size >= this.#maxSize && !this.#cache.has(key)) {

            evictLRU(this.#cache);
            this.#stats.evictions++;
        }

        this.#cache.set(key, value);
    }

    delete(key: string): boolean {

        return this.#cache.delete(key);
    }

    clear(): void {

        this.#cache.clear();

        if (this.#cleanupTimer !== undefined) {

            clearInterval(this.#cleanupTimer);
        }
    }

    has(key: string): boolean {

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

    *keys(): IterableIterator<string> {

        for (const key of this.#cache.keys()) {

            yield key;
        }
    }

    *entries(): IterableIterator<[string, V]> {

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
