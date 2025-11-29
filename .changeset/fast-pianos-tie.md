---
"@logosdx/fetch": major
"@logosdx/utils": major
"@logosdx/kit": major
---


## @logosdx/fetch

### Added

* `feat(fetch):` Request deduplication via `dedupePolicy` - share in-flight promises across concurrent identical requests _(closes #91)_
* `feat(fetch):` Response caching with TTL and stale-while-revalidate (SWR) via `cachePolicy` _(closes #92)_
* `feat(fetch):` Rate limiting via `rateLimitPolicy` - token bucket algorithm with per-endpoint buckets _(closes #93)_
* `feat(fetch):` Route matching rules with `is`, `startsWith`, `endsWith`, `includes`, and `match` (regex) patterns
* `feat(fetch):` New deduplication events: `fetch-dedupe-start`, `fetch-dedupe-join`, `fetch-dedupe-complete`, `fetch-dedupe-error`
* `feat(fetch):` New cache events: `fetch-cache-hit`, `fetch-cache-miss`, `fetch-cache-stale`, `fetch-cache-set`, `fetch-cache-expire`, `fetch-cache-revalidate`, `fetch-cache-revalidate-error`
* `feat(fetch):` New rate limit events: `fetch-ratelimit-wait`, `fetch-ratelimit-reject`, `fetch-ratelimit-acquire`
* `feat(fetch):` Cache invalidation API: `clearCache()`, `deleteCache(key)`, `invalidateCache(predicate)`, `invalidatePath(pattern)`, `cacheStats()`
* `feat(fetch):` Independent timeout/abort per caller when joining deduplicated requests
* `feat(fetch):` Pluggable cache adapter via `cachePolicy.adapter` for Redis, IndexedDB, AsyncStorage, localStorage, etc.
* `feat(fetch):` `defaultRequestSerializer` - generates cache/dedupe keys from method + URL path + query + payload
* `feat(fetch):` `defaultRateLimitSerializer` - groups requests by method + pathname for per-endpoint rate limiting
* `feat(fetch):` New type exports: `CacheConfig`, `CacheRule`, `RateLimitConfig`, `RateLimitRule`


## @logosdx/utils

### Added

* `feat(utils):` `SingleFlight<T>` - generic coordinator for cache and in-flight request deduplication with SWR support
* `feat(utils):` `Deferred<T>` - promise with external resolve/reject control
* `feat(utils):` `serializer()` - enhanced key generation handling circular refs, functions, symbols, Maps, Sets, Dates, and more

### Changed

* **Breaking:** `refactor(utils)!:` `CacheAdapter` interface is now async-only with string keys: `CacheAdapter<T>` replaces `CacheAdapter<K, V>`
* **Breaking:** `refactor(utils)!:` `CacheItem<T>` properties `accessCount`, `lastAccessed`, `accessSequence` are now optional; added `staleAt` for SWR
