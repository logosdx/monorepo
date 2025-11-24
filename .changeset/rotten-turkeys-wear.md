---
"@logosdx/utils": major
"@logosdx/kit": major
---

## @logosdx/utils

### Added

* `feat(memo): add shouldCache option for conditional caching bypass` - Allows memoized functions to conditionally bypass cache based on request context (e.g., cache-busting flags). Bypassed calls still benefit from inflight deduplication. Added to both `memoize` and `memoizeSync` functions. _(#92)_
* `feat(inflight): add shouldDedupe option for conditional deduplication bypass` - Enables withInflightDedup to conditionally bypass deduplication and execute producers directly based on request parameters. Early-exit optimization avoids serialization overhead when bypassed. _(#91)_

### Changed

* **Breaking:** `refactor(memo)!: change shouldCache args signature to spread pattern` - `shouldCache` receives spread arguments `(...args)` matching function signature, while `generateKey` continues receiving tuple `([arg1, arg2, ...])` for consistency with existing serialization patterns.
* **Breaking:** `refactor(inflight)!: change keyFn signature to spread pattern for consistency` - `keyFn` now receives spread arguments `(...args)` matching the wrapped function signature. Previously received tuple-style arguments. Updated for consistency with `shouldDedupe`.

### Fixed

* `fix(memo): add error handling for shouldCache predicate failures` - shouldCache errors gracefully fall back to normal caching behavior via attemptSync, preventing function execution failures.
* `fix(inflight): add error handling for shouldDedupe predicate failures` - shouldDedupe errors gracefully fall back to normal deduplication behavior via attemptSync.

---

## Documentation

### Changed

* `docs(utils): update llm-helpers with conditional caching examples` - Added comprehensive examples for `shouldCache` and `shouldDedupe` usage patterns including cache-busting scenarios.
* `docs(utils): update package docs with conditional caching patterns` - Added examples and usage guidance for new conditional bypass options.

---

## Testing

### Added

* `test(inflight): add comprehensive shouldDedupe test coverage` - 8 new test scenarios covering bypass behavior, hook suppression, concurrent mixing, error handling, and argument passing.
* `test(memo): add comprehensive shouldCache test coverage` - 7 new test scenarios for both memoize and memoizeSync covering cache bypass, deduplication interaction, error handling, and cache size verification.

---

## Summary

This release introduces **conditional caching and deduplication** capabilities to `@logosdx/utils` memoization and inflight utilities. Key features:

1. **Selective Cache Bypass**: `shouldCache` option allows cache-busting while retaining deduplication benefits
2. **Selective Deduplication Bypass**: `shouldDedupe` option enables direct execution bypassing inflight tracking
3. **Performance Optimized**: Early-exit paths avoid serialization overhead when bypassing
4. **Error Resilient**: Predicate errors gracefully fall back to default behavior
5. **Consistent API**: Spread argument pattern across both memoize and inflight utilities

**Breaking Changes**: Function signature updates for `keyFn` and `shouldCache` options require argument pattern adjustments when using custom key generators.

**Related Issues**: Partial implementation for #91 (Request Deduplication), #92 (Request Memoization/Caching)
