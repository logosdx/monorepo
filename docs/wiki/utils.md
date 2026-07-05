---
type: Domain
---

# utils

## What it does

`@logosdx/utils` is the foundation layer imported by every other package in the monorepo. It provides flow control, async primitives, data operations, validation, type utilities, and data structures used throughout.

## Artifacts

- [`skills/logosdx/references/utils.md`](../../skills/logosdx/references/utils.md) — canonical skill reference for error tuples, flow control, typed helpers, unit conversion, config parsing/update functions

## CLI code

- [`packages/utils/src/index.ts`](../../packages/utils/src/index.ts) — barrel re-exports all modules
- [`packages/utils/src/types.ts`](../../packages/utils/src/types.ts) — shared type definitions (`Func`, `AsyncFunc`, `PathValue`, `DeepOptional`, `Truthy`, etc.)
- [`packages/utils/src/async/`](../../packages/utils/src/async) — async primitives (attempt, attemptSync, retry, deferred)
- [`packages/utils/src/flow-control/`](../../packages/utils/src/flow-control) — debounce, throttle, circuit breaker, memoize, batch, chunk
- [`packages/utils/src/data-structures/`](../../packages/utils/src/data-structures) — PriorityQueue, clone, equals, merge, addHandlerFor, mergeDefaults
- [`packages/utils/src/validation/`](../../packages/utils/src/validation) — assert, isObject, isDefined, isFunction, environment detection
- [`packages/utils/src/array-utils/`](../../packages/utils/src/array-utils) — array helpers
- [`packages/utils/src/object-utils/`](../../packages/utils/src/object-utils) — object helpers
- [`packages/utils/src/config/`](../../packages/utils/src/config) — `makeNestedConfig()` returns a `NestedConfig<C, F>`: `allConfigs()`/`getConfig()` (parse-once, cached) plus `updateFlatConfig()`, `updateParsedConfig()`, `setDeepInParsedConfig()` for runtime overrides; `castValuesToTypes()` does flat-to-typed coercion
- [`packages/utils/src/misc/`](../../packages/utils/src/misc) — miscellaneous helpers
- [`packages/utils/src/units/`](../../packages/utils/src/units) — unit conversion utilities
- [`packages/utils/src/_helpers.ts`](../../packages/utils/src/_helpers.ts) — internal test helpers (not exported)

## Docs

- [`docs/packages/utils/index.md`](../packages/utils/index.md) — overview
- [`docs/packages/utils/data.md`](../packages/utils/data.md) — data operations reference
- [`docs/packages/utils/error-handling.md`](../packages/utils/error-handling.md) — attempt/attemptSync error tuple docs
- [`docs/packages/utils/flow-control.md`](../packages/utils/flow-control.md) — debounce, throttle, circuit breaker docs
- [`docs/packages/utils/performance.md`](../packages/utils/performance.md) — memoize, batch, chunk docs
- [`docs/packages/utils/validation.md`](../packages/utils/validation.md) — validation helpers docs
- [`docs/spec/config-update-fns.md`](../spec/config-update-fns.md) — implementation log for the `makeNestedConfig` state-cache + update-fns rework

## Coupling

- All other packages (`observer`, `fetch`, `dom`, `state-machine`, `storage`, `localize`, `hooks`, `react`, `kit`) import directly from `@logosdx/utils`. Any breaking change here cascades to all packages.
- Tests in [`tests/src/utils/`](../../tests/src/utils) import from [`packages/utils/src/index.ts`](../../packages/utils/src/index.ts) via relative path.

## Conventions worth knowing

- `attempt(fn)` returns `[result, error]` tuple — this is the sole sanctioned error-handling pattern for I/O; `try-catch` is prohibited for I/O.
- `attemptSync(fn)` is the synchronous variant of the same pattern.
- Environment detection utilities expose `isBrowser`, `isNode`, `isCloudflare`, `isReactNative` guards.
- `PriorityQueue` is exported from `data-structures/` and used by `@logosdx/observer`'s queue subsystem.
- `makeNestedConfig()`'s `allConfigs()` parses the flatmap once and caches the result (`wasParsed` flag); `updateFlatConfig()`, `updateParsedConfig()`, and `setDeepInParsedConfig()` invalidate the cache. `updateFlatConfig()` and `updateParsedConfig()` both `assert` a non-null object override and throw otherwise. `updateParsedConfig()`/`setDeepInParsedConfig()` accumulate into the same override object, which is re-applied on every re-parse (survives a later `updateFlatConfig()`).
