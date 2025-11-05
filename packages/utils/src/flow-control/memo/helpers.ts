import { isObject } from '../../validation.ts';
import type { CacheItem } from './types.ts';

/**
 * Unwraps a cache value, handling WeakRef if present.
 * Returns tuple: [value, wasGarbageCollected]
 *
 * @param value - Value to unwrap (may be WeakRef)
 * @returns Tuple of [unwrapped value, whether it was GC'd]
 */
export const unwrapValue = <T>(
    value: T | WeakRef<object>
): [T | undefined, boolean] => {

    if (value instanceof WeakRef) {

        const deref = value.deref() as T | undefined;
        return [deref, deref === undefined];
    }

    return [value as T, false];
};

/**
 * Creates a cache item with metadata.
 *
 * @param value - Value to cache
 * @param createdAt - Creation timestamp
 * @param expiresAt - Expiration timestamp
 * @param useWeakRef - Whether to use WeakRef for objects
 * @param accessSequence - Monotonic sequence number
 * @returns Cache item with metadata
 */
export const createCacheItem = <T>(
    value: T,
    createdAt: number,
    expiresAt: number,
    useWeakRef: boolean,
    accessSequence: number
): CacheItem<T> => {

    const storedValue =
        useWeakRef && isObject(value) && value !== null
            ? new WeakRef(value as object)
            : value;

    return {
        value: storedValue,
        createdAt,
        expiresAt,
        accessCount: 1,
        lastAccessed: createdAt,
        accessSequence
    };
};

/**
 * Checks if a cache item is expired.
 *
 * @param item - Cache item to check
 * @returns True if expired
 */
export const isExpired = <T>(item: CacheItem<T>): boolean => {

    return Date.now() >= item.expiresAt;
};

/**
 * Checks if a cache item is stale (older than staleIn but not expired).
 *
 * @param item - Cache item to check
 * @param staleIn - Staleness threshold in milliseconds
 * @returns True if stale but not expired
 */
export const isStale = <T>(item: CacheItem<T>, staleIn: number): boolean => {

    const now = Date.now();
    const age = now - item.createdAt;

    return age > staleIn && now < item.expiresAt;
};

/**
 * Updates access metadata for a cache item atomically.
 *
 * @param item - Cache item to update
 * @param sequence - New sequence number
 */
export const updateAccessMetadata = <T>(
    item: CacheItem<T>,
    sequence: number
): void => {

    const now = Date.now();
    item.lastAccessed = now;
    item.accessCount++;
    item.accessSequence = sequence;
};

/**
 * Symbol used for timeout racing in stale-while-revalidate.
 */
export const TIMEOUT_SYMBOL = Symbol('timeout');

/**
 * Evicts the least recently used item from a cache.
 * Uses sequence number for tie-breaking when timestamps are identical.
 *
 * @param cache - Map to evict from
 * @returns Key of evicted item, or null if cache is empty
 */
export const evictLRU = <T>(cache: Map<string, CacheItem<T>>): string | null => {

    let lruKey: string | null = null;
    let lruTime = Infinity;
    let lruSequence = Infinity;

    for (const [key, item] of cache.entries()) {

        const isLessRecent =
            item.lastAccessed < lruTime ||
            (item.lastAccessed === lruTime && item.accessSequence < lruSequence);

        if (isLessRecent) {

            lruTime = item.lastAccessed;
            lruSequence = item.accessSequence;
            lruKey = key;
        }
    }

    if (lruKey) {

        cache.delete(lruKey);
    }

    return lruKey;
};
