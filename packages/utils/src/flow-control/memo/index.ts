export type {
    CacheStats,
    CacheItem,
    CacheAdapter,
    MemoizeOptions,
    EnhancedMemoizedFunction,
    MapCacheAdapterOptions
} from './types.ts';

export { MapCacheAdapter } from './adapter.ts';
export { memoize } from './memoize.ts';
export { memoizeSync } from './memoizeSync.ts';
