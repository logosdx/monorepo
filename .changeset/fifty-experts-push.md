---
"@logosdx/utils": minor
---

feat(flow-control): enhance memoization with pluggable adapters and stale-while-revalidate

## Memoization System

### Added

* `feat(memo):` Built-in inflight deduplication for async memoization - concurrent calls with identical arguments share the same promise  _(closes #78)_
* `feat(memo):` Stale-while-revalidate pattern with `staleIn` and `staleTimeout` options - return stale data instantly while fetching fresh data in background  _(closes #77)_
* `feat(memo):` Pluggable cache adapters via `CacheAdapter` interface - support for Redis, Memcached, or custom backends
* `feat(memo):` `MapCacheAdapter` with LRU eviction using sequence tracking for deterministic eviction
* `feat(memo):` Background cleanup with configurable `cleanupInterval` option
* `feat(memo):` Enhanced cache statistics with hits, misses, evictions, and hit rate tracking
* `feat(memo):` Cache management API - `clear()`, `delete()`, `has()`, `size`, `keys()`, `entries()`, `stats()`

### Changed

* `refactor(memo):` Modularize memoization system into dedicated files - `adapter.ts`, `helpers.ts`, `memoize.ts`, `memoizeSync.ts`, `types.ts`
* `refactor(memo):` Extract cache operations into reusable helper functions - `unwrapValue`, `createCacheItem`, `isExpired`, `isStale`, `evictLRU`
* `refactor(memo):` Improve type safety with dedicated `CacheItem` and `CacheStats` interfaces

### Fixed

* `fix(memo):` LRU eviction now uses sequence numbers for deterministic eviction when timestamps are identical
* `docs(memo):` Comprehensive documentation updates with distributed caching examples and SWR pattern usage
* `docs(memo):` Update llm-helpers/utils.md with memoize vs memoizeSync comparison table

## Flow Control

### Added

* `feat(inflight):` Add `withInflightDedup()` utility for concurrent promise deduplication - shares in-flight promises across concurrent calls with identical arguments, with no post-settlement caching
* `feat(inflight):` Add lifecycle hooks (onStart, onJoin, onResolve, onReject) for observability and monitoring
* `feat(inflight):` Add custom `keyFn` option for performance-critical hot paths and extracting discriminating fields
* `feat(compose):` Integrate `withInflightDedup` into `composeFlow` as fifth flow control primitive alongside retry, timeout, rate-limit, and circuit-breaker

### Fixed

* `fix(serializer):` Consistent object key ordering for stable cache keys
* `fix(serializer):` Proper WeakSet cleanup and circular reference handling
* `fix(serializer):` Add comprehensive type support - BigInt, Symbol, Error, WeakMap/WeakSet, -0 distinction, NaN, Infinity

## Testing

### Added

* `test(memo):` 32 new memoization tests covering inflight dedup, stale-while-revalidate, adapters, and LRU eviction
* `test(inflight):` 21 new serializer tests for edge cases and type coverage
* `test(integration):` 5 new integration tests for composeFlow with inflight deduplication

## Documentation

### Changed

* `docs(utils):` Update memoization documentation with SWR pattern examples and distributed caching guide
* `docs(utils):` Add comparison table for `memoize` vs `memoizeSync` capabilities
* `docs(cursor):` Improve TypeScript patterns documentation with clearer 4-block structure examples
