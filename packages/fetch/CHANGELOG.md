# @logosdx/fetch

## 7.0.4

### Patch Changes

- Updated dependencies [ea81582]
  - @logosdx/utils@5.1.0
  - @logosdx/observer@2.2.1

## 7.0.3

### Patch Changes

- Updated dependencies [923f8c7]
  - @logosdx/observer@2.2.0

## 7.0.2

### Patch Changes

- 7fd7216: fix(fetch): preserve full baseUrl path when constructing request URLs

  Previously, `#makeUrl` unconditionally removed the last character from the baseUrl, which would incorrectly truncate paths like `/org/1/v1` to `/org/1/v`. Now only trailing slashes are removed.

## 7.0.1

### Patch Changes

- 37d3b47: Fix retry logic throwing "Unexpected end of retry logic" instead of actual error on final attempt

  When a request failed on the final retry attempt and `shouldRetry` returned `true`, the loop would increment `_attempt` past `maxAttempts`, exit the while loop, and throw a generic error instead of the actual fetch error. Changed the retry condition from `<=` to `<` to ensure the actual error is thrown after exhausting all attempts.

## 7.0.0

### Major Changes

- 582644e: ## @logosdx/fetch

  ### Added

  - `feat(fetch):` Request deduplication via `dedupePolicy` - share in-flight promises across concurrent identical requests _(closes #91)_
  - `feat(fetch):` Response caching with TTL and stale-while-revalidate (SWR) via `cachePolicy` _(closes #92)_
  - `feat(fetch):` Rate limiting via `rateLimitPolicy` - token bucket algorithm with per-endpoint buckets _(closes #93)_
  - `feat(fetch):` Route matching rules with `is`, `startsWith`, `endsWith`, `includes`, and `match` (regex) patterns
  - `feat(fetch):` New deduplication events: `fetch-dedupe-start`, `fetch-dedupe-join`, `fetch-dedupe-complete`, `fetch-dedupe-error`
  - `feat(fetch):` New cache events: `fetch-cache-hit`, `fetch-cache-miss`, `fetch-cache-stale`, `fetch-cache-set`, `fetch-cache-expire`, `fetch-cache-revalidate`, `fetch-cache-revalidate-error`
  - `feat(fetch):` New rate limit events: `fetch-ratelimit-wait`, `fetch-ratelimit-reject`, `fetch-ratelimit-acquire`
  - `feat(fetch):` Cache invalidation API: `clearCache()`, `deleteCache(key)`, `invalidateCache(predicate)`, `invalidatePath(pattern)`, `cacheStats()`
  - `feat(fetch):` Independent timeout/abort per caller when joining deduplicated requests
  - `feat(fetch):` Pluggable cache adapter via `cachePolicy.adapter` for Redis, IndexedDB, AsyncStorage, localStorage, etc.
  - `feat(fetch):` `defaultRequestSerializer` - generates cache/dedupe keys from method + URL path + query + payload
  - `feat(fetch):` `defaultRateLimitSerializer` - groups requests by method + pathname for per-endpoint rate limiting
  - `feat(fetch):` New type exports: `CacheConfig`, `CacheRule`, `RateLimitConfig`, `RateLimitRule`

  ## @logosdx/utils

  ### Added

  - `feat(utils):` `SingleFlight<T>` - generic coordinator for cache and in-flight request deduplication with SWR support
  - `feat(utils):` `Deferred<T>` - promise with external resolve/reject control
  - `feat(utils):` `serializer()` - enhanced key generation handling circular refs, functions, symbols, Maps, Sets, Dates, and more

  ### Changed

  - **Breaking:** `refactor(utils)!:` `CacheAdapter` interface is now async-only with string keys: `CacheAdapter<T>` replaces `CacheAdapter<K, V>`
  - **Breaking:** `refactor(utils)!:` `CacheItem<T>` properties `accessCount`, `lastAccessed`, `accessSequence` are now optional; added `staleAt` for SWR

### Patch Changes

- Updated dependencies [582644e]
- Updated dependencies [e4e4f43]
  - @logosdx/utils@5.0.0
  - @logosdx/observer@2.1.1

## 6.0.0

### Major Changes

- 567ed1f: ## @logosdx/fetch

  ### Added

  - `feat(fetch):` FetchEngine now extends ObserverEngine for unified event handling
  - `feat(fetch):` Added `name` and `spy` options to FetchEngine constructor for debugging
  - `feat(fetch):` Added `FetchEngine.EventData` and `FetchEngine.EventMap` type definitions

  ### Changed

  - **Breaking:** `refactor!(fetch):` Event system migrated from EventTarget to ObserverEngine
    - `on('*', listener)` → `on(/fetch-.*/, listener)` for wildcard events
    - Non-regex listeners now receive `(data: EventData, info?: { event, listener })` instead of `FetchEvent`
    - Regex listeners receive `({ event: string, data: EventData })` as first argument
    - `on()` now returns a cleanup function (can also use inherited `off()` method)
  - **Breaking:** `refactor!(fetch):` Removed `FetchEvent` class and `FetchEventNames` enum exports
  - `refactor(fetch):` `destroy()` now automatically clears all event listeners via ObserverEngine's `clear()`

  ### Removed

  - **Breaking:** `feat!(fetch):` Removed `FetchEvent` export - use `FetchEngine.EventData` type instead
  - **Breaking:** `feat!(fetch):` Removed `FetchEventNames` export - event names are now string literals

  ## @logosdx/utils

  ### Changed

  - `fix(utils):` Changed `Func` and `AsyncFunc` type generics from `unknown[]`/`unknown` to `any[]`/`any` for better variance compatibility

### Patch Changes

- Updated dependencies [567ed1f]
- Updated dependencies [204dd76]
- Updated dependencies [931a1e5]
  - @logosdx/utils@4.0.0
  - @logosdx/observer@2.1.0

## 5.0.4

### Patch Changes

- Updated dependencies [e6b07d8]
  - @logosdx/utils@3.0.1

## 5.0.3

### Patch Changes

- Updated dependencies [96fe247]
  - @logosdx/utils@3.0.0

## 5.0.2

### Patch Changes

- Updated dependencies [6416ac4]
  - @logosdx/utils@2.5.0

## 5.0.1

### Patch Changes

- Updated dependencies [8fda604]
  - @logosdx/utils@2.4.0

## 5.0.0

### Major Changes

- ba282ad: ## @logosdx/fetch

  ### Changed

  - **Breaking:** `refactor(response)`: Response headers changed from Web API `Headers` object to typed plain object with bracket notation access

    **Before:**

    ```typescript
    const response = await api.get("/users");
    const contentType = response.headers.get("content-type");
    if (response.headers.has("x-custom")) {
    }
    ```

    **After:**

    ```typescript
    const response = await api.get("/users");
    const contentType = response.headers["content-type"];
    if (response.headers["x-custom"]) {
    }
    ```

    **Migration:** Replace all `.get()`, `.has()`, `.entries()` calls with bracket notation or `Object` methods. Response headers are now typed via `InstanceResponseHeaders` interface for better TypeScript support.

  ### Added

  - `feat(lifecycle)`: Add `destroy()` method for cleaning up FetchEngine instances and preventing memory leaks
  - `feat(lifecycle)`: Add `isDestroyed()` method to check if instance has been destroyed
  - `feat(types)`: Add `RH` generic parameter for typed response headers via `InstanceResponseHeaders` interface

  ### Fixed

  - `fix(memory)`: Prevent memory leaks by ensuring timeout cleanup in all code paths via finally block
  - `fix(memory)`: Add instance-level AbortController for automatic event listener cleanup on destroy

## 4.0.1

### Patch Changes

- Updated dependencies [9edb1c4]
- Updated dependencies [6560f02]
  - @logosdx/utils@2.3.0

## 4.0.0

### Major Changes

- 0cf6edd: **BREAKING CHANGE**: Rename `retryConfig` option to `retry`

  - Rename `retryConfig` to `retry` in FetchEngine constructor options
  - Rename `retryConfig` to `retry` in FetchConfig and RequestOpts interfaces
  - Add support for `retry: true` to enable default retry configuration
  - Maintain existing support for `retry: false` to disable retries
  - Maintain existing support for `retry: {...}` for custom RetryConfig objects

  **Migration:**

  ```typescript
  // Before
  const api = new FetchEngine({
    retryConfig: { maxAttempts: 3 },
  });

  // After
  const api = new FetchEngine({
    retry: { maxAttempts: 3 },
    // or retry: true for defaults
    // or retry: false to disable
  });
  ```

### Patch Changes

- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
  - @logosdx/utils@2.2.0

## 3.0.1

### Patch Changes

- e1c0ba2: Remove formatHeaders feature as modern browsers handle header casing automatically. HTTP/2 standardizes headers to lowercase, making manual header formatting unnecessary. This simplifies the codebase while maintaining all existing functionality.
- Updated dependencies [9e6afcd]
  - @logosdx/utils@2.1.2

## 3.0.0

### Major Changes

- 7fdab75: **BREAKING CHANGE**: HTTP methods now return `FetchResponse<T>` objects instead of raw data

  All HTTP methods (`get`, `post`, `put`, etc.) now return enhanced response objects containing:

  - `data`: Parsed response body (your original return value)
  - `headers`: Response headers object
  - `status`: HTTP status code
  - `request`: Original request object
  - `config`: Typed configuration used for the request

  **Migration:**

  ```typescript
  // Before
  const users = await api.get("/users");

  // After - destructure for backward compatibility
  const { data: users } = await api.get("/users");

  // Or access full response details
  const response = await api.get("/users");
  console.log("Data:", response.data);
  console.log("Status:", response.status);
  console.log("Headers:", response.headers.get("content-type"));
  ```

  This provides better debugging capabilities and access to response metadata while maintaining backward compatibility through destructuring.

## 2.0.0

### Major Changes

- fdec519: ## Breaking Changes to Retry Configuration

  ### Simplified `retryConfig` API

  - **`retryConfig` can now be set to `false`** to disable retries entirely (previously required `maxAttempts: 0`)
  - **`baseDelay` is now only a `number`** - removed function signature `(error: FetchError, attempt: number) => number`
    - Custom delay logic should now be handled through the `shouldRetry` function
    - `baseDelay` is used for exponential backoff calculations when `shouldRetry` returns `true`

  ### Enhanced `shouldRetry` Behavior

  The `shouldRetry` function now has full control over retry delays:

  - Return `true` to retry with default exponential backoff (using `baseDelay`)
  - Return `false` to stop retrying
  - Return a `number` (milliseconds) to specify an exact delay, overriding exponential backoff

  ### Migration Guide

  **Before:**

  ```typescript
  // Disable retries
  new FetchEngine({
    retryConfig: { maxAttempts: 0 },
  });

  // Custom delay function
  new FetchEngine({
    retryConfig: {
      baseDelay: (error, attempt) => attempt * 1000,
    },
  });
  ```

  **After:**

  ```typescript
  // Disable retries
  new FetchEngine({
    retryConfig: false,
  });

  // Custom delay through shouldRetry
  new FetchEngine({
    retryConfig: {
      baseDelay: 1000,
      shouldRetry: (error, attempt) => attempt * 1000,
    },
  });
  ```

## 1.2.0

### Minor Changes

- cd91503: feat(fetch): add global instance and dynamic request modifiers

  - Add default global fetch instance for simplified usage without creating custom instances
  - Export individual methods (get, post, put, etc.) for convenient destructuring
  - Add smart URL handling - absolute URLs now bypass base URL configuration
  - Add `changeModifyOptions()` method to dynamically update global request modifiers at runtime
  - Add `changeModifyMethodOptions()` method to set method-specific modifiers dynamically
  - Add new events: `fetch-modify-options-change` and `fetch-modify-method-options-change`
  - Change default state type from `{}` to `FetchEngine.InstanceState` for better TypeScript support
  - Global instance automatically uses current domain as base URL (or fallback to logosdx.dev)

## 1.1.5

### Patch Changes

- Updated dependencies [2c6c8cc]
  - @logosdx/utils@2.1.1

## 1.1.4

### Patch Changes

- 755e80d: ## Flow Control Utilities and Engine Improvements

  ### Added Flow Control Utilities

  - **runInSeries/makeInSeries**: Execute functions sequentially
  - **nextLoop**: Promise that resolves after next event loop
  - **nTimes**: Utility to repeat operations N times
  - **setImmediate polyfill**: Cross-platform immediate execution

  ### Batch Processing Enhancement

  - Added `nextLoop()` call in batch processing to prevent blocking
  - Improves performance for large batch operations

  ### Fetch Engine Improvements

  - Fixed status code handling in error parsing (status fallback)
  - Fixed `addEventListener` now returns cleanup function for better resource management

- Updated dependencies [755e80d]
  - @logosdx/utils@2.1.0

## 1.1.3

### Patch Changes

- Updated dependencies [cbd0e23]
  - @logosdx/utils@2.0.3

## 1.1.2

### Patch Changes

- eecc5d4: Export type so they aren't compiled into ESM files
- Updated dependencies [eecc5d4]
  - @logosdx/utils@2.0.2

## 1.1.1

### Patch Changes

- 43b3457: ### Fixed

  - Export bug from utils.
  - Better naming for options

- Updated dependencies [43b3457]
  - @logosdx/utils@2.0.1

## 1.1.0

### Minor Changes

- 68b2d8b: ## Major Release: Unified Queue System, API Simplification, and Reliability Improvements

  - **New Feature: Queue System**
    Introduced a modular, observable queue system with priority queue support, improved rate limiting (token-based), and enhanced lifecycle management. Queue logic is now organized for clarity and extensibility.

  - **API Simplification & Consistency**
    Core data utilities have been renamed for clarity (`deepClone` → `clone`, `deepEqual` → `equals`, `deepMerge`/`applyDefaults` → `merge`). Type and pattern consistency improved across all packages.

  - **Breaking Changes**

    - `destroy` methods are now `cleanup` throughout the codebase.
    - Wildcard event listeners (`*`) replaced with regex pattern support.
    - Utility function renames require import updates.

  - **Reliability & Developer Experience**
    - Expanded test coverage for new queue and priority queue features.
    - Improved error handling and type safety.
    - Enhanced documentation with real-world examples.
    - Performance optimizations for queue operations.

  **Migration:**
  Update imports to use new utility names and replace any `destroy()` calls with `cleanup()`. Update event listeners to use regex patterns instead of wildcards (`*`).

### Patch Changes

- Updated dependencies [68b2d8b]
  - @logosdx/utils@2.0.0

## 1.0.4

### Patch Changes

- 062ceab: Missed update

## 1.0.3

### Patch Changes

- a84138b: Force release due to bad build
- Updated dependencies [1dcc2d1]
- Updated dependencies [a84138b]
  - @logosdx/utils@1.1.0

## 1.0.2

### Patch Changes

- 0704421: publish .d.ts files
- Updated dependencies [0704421]
  - @logosdx/utils@1.0.2

## 1.0.0

### Major Changes

- b051504: Re-release as LogosDX

### Patch Changes

- Updated dependencies [b051504]
  - @logosdx/utils@1.0.0
