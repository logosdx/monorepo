# @logosdx/kit

## 4.0.6

### Patch Changes

- Updated dependencies [164bd3c]
- Updated dependencies [164bd3c]
  - @logosdx/fetch@7.1.0
  - @logosdx/observer@2.3.0

## 4.0.5

### Patch Changes

- Updated dependencies [5380675]
  - @logosdx/utils@6.0.0
  - @logosdx/observer@2.2.2
  - @logosdx/fetch@7.0.5
  - @logosdx/localize@1.0.21
  - @logosdx/state-machine@1.0.21
  - @logosdx/storage@1.0.21

## 4.0.4

### Patch Changes

- Updated dependencies [ea81582]
  - @logosdx/utils@5.1.0
  - @logosdx/fetch@7.0.4
  - @logosdx/localize@1.0.20
  - @logosdx/observer@2.2.1
  - @logosdx/state-machine@1.0.20
  - @logosdx/storage@1.0.20

## 4.0.3

### Patch Changes

- Updated dependencies [923f8c7]
  - @logosdx/observer@2.2.0
  - @logosdx/fetch@7.0.3

## 4.0.2

### Patch Changes

- Updated dependencies [7fd7216]
  - @logosdx/fetch@7.0.2

## 4.0.1

### Patch Changes

- Updated dependencies [37d3b47]
  - @logosdx/fetch@7.0.1

## 4.0.0

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
  - @logosdx/fetch@7.0.0
  - @logosdx/utils@5.0.0
  - @logosdx/localize@1.0.19
  - @logosdx/observer@2.1.1
  - @logosdx/state-machine@1.0.19
  - @logosdx/storage@1.0.19

## 3.0.0

### Major Changes

- 204dd76: ## @logosdx/utils

  ### Added

  - `feat(memo): add shouldCache option for conditional caching bypass` - Allows memoized functions to conditionally bypass cache based on request context (e.g., cache-busting flags). Bypassed calls still benefit from inflight deduplication. Added to both `memoize` and `memoizeSync` functions. _(#92)_
  - `feat(inflight): add shouldDedupe option for conditional deduplication bypass` - Enables withInflightDedup to conditionally bypass deduplication and execute producers directly based on request parameters. Early-exit optimization avoids serialization overhead when bypassed. _(#91)_

  ### Changed

  - **Breaking:** `refactor(memo)!: change shouldCache args signature to spread pattern` - `shouldCache` receives spread arguments `(...args)` matching function signature, while `generateKey` continues receiving tuple `([arg1, arg2, ...])` for consistency with existing serialization patterns.
  - **Breaking:** `refactor(inflight)!: change keyFn signature to spread pattern for consistency` - `keyFn` now receives spread arguments `(...args)` matching the wrapped function signature. Previously received tuple-style arguments. Updated for consistency with `shouldDedupe`.

  ### Fixed

  - `fix(memo): add error handling for shouldCache predicate failures` - shouldCache errors gracefully fall back to normal caching behavior via attemptSync, preventing function execution failures.
  - `fix(inflight): add error handling for shouldDedupe predicate failures` - shouldDedupe errors gracefully fall back to normal deduplication behavior via attemptSync.

  ***

  ## Documentation

  ### Changed

  - `docs(utils): update llm-helpers with conditional caching examples` - Added comprehensive examples for `shouldCache` and `shouldDedupe` usage patterns including cache-busting scenarios.
  - `docs(utils): update package docs with conditional caching patterns` - Added examples and usage guidance for new conditional bypass options.

  ***

  ## Testing

  ### Added

  - `test(inflight): add comprehensive shouldDedupe test coverage` - 8 new test scenarios covering bypass behavior, hook suppression, concurrent mixing, error handling, and argument passing.
  - `test(memo): add comprehensive shouldCache test coverage` - 7 new test scenarios for both memoize and memoizeSync covering cache bypass, deduplication interaction, error handling, and cache size verification.

  ***

  ## Summary

  This release introduces **conditional caching and deduplication** capabilities to `@logosdx/utils` memoization and inflight utilities. Key features:

  1. **Selective Cache Bypass**: `shouldCache` option allows cache-busting while retaining deduplication benefits
  2. **Selective Deduplication Bypass**: `shouldDedupe` option enables direct execution bypassing inflight tracking
  3. **Performance Optimized**: Early-exit paths avoid serialization overhead when bypassing
  4. **Error Resilient**: Predicate errors gracefully fall back to default behavior
  5. **Consistent API**: Spread argument pattern across both memoize and inflight utilities

  **Breaking Changes**: Function signature updates for `keyFn` and `shouldCache` options require argument pattern adjustments when using custom key generators.

  **Related Issues**: Partial implementation for #91 (Request Deduplication), #92 (Request Memoization/Caching)

### Patch Changes

- Updated dependencies [567ed1f]
- Updated dependencies [204dd76]
- Updated dependencies [931a1e5]
  - @logosdx/fetch@6.0.0
  - @logosdx/utils@4.0.0
  - @logosdx/observer@2.1.0
  - @logosdx/localize@1.0.18
  - @logosdx/state-machine@1.0.18
  - @logosdx/storage@1.0.18

## 2.0.1

### Patch Changes

- Updated dependencies [e6b07d8]
  - @logosdx/utils@3.0.1
  - @logosdx/fetch@5.0.4
  - @logosdx/localize@1.0.17
  - @logosdx/observer@2.0.13
  - @logosdx/state-machine@1.0.17
  - @logosdx/storage@1.0.17

## 2.0.0

### Major Changes

- 96fe247: # @logosdx/utils Major Reorganization & API Improvements

  ## Utils Package

  ### Changed

  - **Breaking:** `refactor(config): makeNestedConfig now returns object with allConfigs() and getConfig(path, default) methods instead of single overloaded function`

    - **Old API**: `config()` returned full config, `config('path')` accessed nested value
    - **New API**: `config.allConfigs()` returns full config, `config.getConfig('path', default?)` accesses nested value
    - **Rationale**: Eliminates confusing function overload, provides clearer API surface
    - **Migration**: Replace `config()` → `config.allConfigs()`, `config('path')` → `config.getConfig('path')`

  - `refactor(structure): reorganized internal module structure for better discoverability`
    - Moved async operations (`attempt`, `retry`, `batch`, `inflight`) to dedicated `async/` directory
    - Split `validation.ts` into focused modules: `type-guards.ts`, `assert.ts`, `comparisons.ts`, `environment.ts`, `values.ts`
    - Split `misc.ts` into domain-specific modules: `misc/index.ts`, `array-utils/`, `object-utils/`
    - Split `units.ts` into `units/time.ts` and `units/bytes.ts`
    - Updated all internal imports to reflect new structure

  ### Added

  - `feat(config): new castValuesToTypes() function for type coercion from environment variables`

    - Supports `parseUnits` option for parsing time durations ('5m', '1hour') and byte sizes ('10mb', '100gb')
    - Supports `skipConversion` callback for selective value preservation (e.g., API keys)
    - Recursively processes nested objects
    - Mutates input object in-place for performance

  - `feat(config): new makeNestedConfig() with enhanced configuration loading`

    - Converts flat environment variable structures to nested objects
    - Supports custom separators, prefix stripping, and casing control
    - Optional memoization support via `memoizeOpts`
    - Improved error messages for configuration conflicts

  - `feat(array-utils): extracted array utilities to dedicated module`

    - `itemsToArray()`: Normalizes single items to arrays
    - `oneOrMany()`: Unwraps single-item arrays
    - `chunk()`: Splits arrays into batches

  - `feat(object-utils): extracted object utilities to dedicated module`
    - `reach()`: Deep property access with dot notation
    - `setDeep()`: Deep property setting with automatic intermediate object creation
    - `setDeepMany()`: Batch deep property setting

  ### Fixed

  - `fix(imports): updated all cross-module imports to use new structure`
    - Flow control modules now import from `../async/`
    - All modules now import validation from `../validation/index.ts`
    - Memoization imports updated for new async location

  ## Kit Package

  ### Changed

  - `refactor(deps): updated to support new @logosdx/utils major version`
    - No API changes to kit itself
    - Compatible with reorganized utils structure

  ***

  **Testing**: All 121 tests pass, including 26 comprehensive tests for `makeNestedConfig` covering all options and edge cases.

  **Migration Guide**:

  ```typescript
  // Before (v1.x)
  const config = makeNestedConfig(process.env, opts);
  const fullConfig = config();
  const dbHost = config("db.host");

  // After (v2.x)
  const config = makeNestedConfig(process.env, opts);
  const fullConfig = config.allConfigs();
  const dbHost = config.getConfig("db.host");
  const dbHostWithDefault = config.getConfig("db.host", "localhost");
  ```

### Patch Changes

- Updated dependencies [96fe247]
  - @logosdx/utils@3.0.0
  - @logosdx/fetch@5.0.3
  - @logosdx/localize@1.0.16
  - @logosdx/observer@2.0.12
  - @logosdx/state-machine@1.0.16
  - @logosdx/storage@1.0.16

## 1.0.20

### Patch Changes

- Updated dependencies [6416ac4]
  - @logosdx/utils@2.5.0
  - @logosdx/fetch@5.0.2
  - @logosdx/localize@1.0.15
  - @logosdx/observer@2.0.11
  - @logosdx/state-machine@1.0.15
  - @logosdx/storage@1.0.15

## 1.0.19

### Patch Changes

- Updated dependencies [8fda604]
  - @logosdx/utils@2.4.0
  - @logosdx/fetch@5.0.1
  - @logosdx/localize@1.0.14
  - @logosdx/observer@2.0.10
  - @logosdx/state-machine@1.0.14
  - @logosdx/storage@1.0.14

## 1.0.18

### Patch Changes

- Updated dependencies [ba282ad]
  - @logosdx/fetch@5.0.0

## 1.0.17

### Patch Changes

- Updated dependencies [9edb1c4]
- Updated dependencies [6560f02]
  - @logosdx/observer@2.0.9
  - @logosdx/utils@2.3.0
  - @logosdx/fetch@4.0.1
  - @logosdx/localize@1.0.13
  - @logosdx/state-machine@1.0.13
  - @logosdx/storage@1.0.13

## 1.0.16

### Patch Changes

- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
  - @logosdx/utils@2.2.0
  - @logosdx/fetch@4.0.0
  - @logosdx/localize@1.0.12
  - @logosdx/observer@2.0.8
  - @logosdx/state-machine@1.0.12
  - @logosdx/storage@1.0.12

## 1.0.15

### Patch Changes

- Updated dependencies [9e6afcd]
- Updated dependencies [e1c0ba2]
  - @logosdx/utils@2.1.2
  - @logosdx/fetch@3.0.1
  - @logosdx/localize@1.0.11
  - @logosdx/observer@2.0.7
  - @logosdx/state-machine@1.0.11
  - @logosdx/storage@1.0.11

## 1.0.14

### Patch Changes

- Updated dependencies [7fdab75]
  - @logosdx/fetch@3.0.0

## 1.0.13

### Patch Changes

- Updated dependencies [fdec519]
  - @logosdx/fetch@2.0.0

## 1.0.12

### Patch Changes

- Updated dependencies [cd91503]
  - @logosdx/fetch@1.2.0

## 1.0.11

### Patch Changes

- Updated dependencies [c6a8fd2]
  - @logosdx/observer@2.0.6

## 1.0.10

### Patch Changes

- Updated dependencies [2c6c8cc]
  - @logosdx/utils@2.1.1
  - @logosdx/fetch@1.1.5
  - @logosdx/localize@1.0.10
  - @logosdx/observer@2.0.5
  - @logosdx/state-machine@1.0.10
  - @logosdx/storage@1.0.10

## 1.0.9

### Patch Changes

- Updated dependencies [755e80d]
  - @logosdx/utils@2.1.0
  - @logosdx/fetch@1.1.4
  - @logosdx/localize@1.0.9
  - @logosdx/observer@2.0.4
  - @logosdx/state-machine@1.0.9
  - @logosdx/storage@1.0.9

## 1.0.8

### Patch Changes

- Updated dependencies [cbd0e23]
  - @logosdx/utils@2.0.3
  - @logosdx/fetch@1.1.3
  - @logosdx/localize@1.0.8
  - @logosdx/observer@2.0.3
  - @logosdx/state-machine@1.0.8
  - @logosdx/storage@1.0.8

## 1.0.7

### Patch Changes

- eecc5d4: Export type so they aren't compiled into ESM files
- Updated dependencies [eecc5d4]
  - @logosdx/fetch@1.1.2
  - @logosdx/localize@1.0.7
  - @logosdx/observer@2.0.2
  - @logosdx/state-machine@1.0.7
  - @logosdx/storage@1.0.7
  - @logosdx/utils@2.0.2

## 1.0.6

### Patch Changes

- 43b3457: ### Fixed

  - Export bug from utils.
  - Better naming for options

- Updated dependencies [43b3457]
  - @logosdx/fetch@1.1.1
  - @logosdx/localize@1.0.6
  - @logosdx/observer@2.0.1
  - @logosdx/state-machine@1.0.6
  - @logosdx/storage@1.0.6
  - @logosdx/utils@2.0.1

## 1.0.5

### Patch Changes

- Updated dependencies [68b2d8b]
  - @logosdx/observer@2.0.0
  - @logosdx/utils@2.0.0
  - @logosdx/fetch@1.1.0
  - @logosdx/localize@1.0.5
  - @logosdx/state-machine@1.0.5
  - @logosdx/storage@1.0.5

## 1.0.4

### Patch Changes

- 062ceab: Missed update
- Updated dependencies [062ceab]
  - @logosdx/fetch@1.0.4
  - @logosdx/localize@1.0.4
  - @logosdx/observer@1.0.4
  - @logosdx/state-machine@1.0.4
  - @logosdx/storage@1.0.4

## 1.0.3

### Patch Changes

- a84138b: Force release due to bad build
- Updated dependencies [1dcc2d1]
- Updated dependencies [a84138b]
  - @logosdx/utils@1.1.0
  - @logosdx/fetch@1.0.3
  - @logosdx/localize@1.0.3
  - @logosdx/observer@1.0.3
  - @logosdx/state-machine@1.0.3
  - @logosdx/storage@1.0.3

## 1.0.2

### Patch Changes

- 0704421: publish .d.ts files
- Updated dependencies [0704421]
  - @logosdx/state-machine@1.0.2
  - @logosdx/localize@1.0.2
  - @logosdx/observer@1.0.2
  - @logosdx/storage@1.0.2
  - @logosdx/fetch@1.0.2
  - @logosdx/utils@1.0.2

## 1.0.0

### Major Changes

- b051504: Re-release as LogosDX

### Patch Changes

- Updated dependencies [b051504]
  - @logosdx/fetch@1.0.0
  - @logosdx/localize@1.0.0
  - @logosdx/observer@1.0.0
  - @logosdx/state-machine@1.0.0
  - @logosdx/storage@1.0.0
  - @logosdx/utils@1.0.0
