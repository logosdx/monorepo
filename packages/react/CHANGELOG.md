# @logosdx/react

## 4.0.0

### Patch Changes

- Updated dependencies [da017d6]
  - @logosdx/fetch@8.1.0

## 3.0.0

### Patch Changes

- Updated dependencies [5b872ff]
  - @logosdx/observer@2.5.0
  - @logosdx/fetch@8.0.1
  - @logosdx/localize@2.0.1
  - @logosdx/state-machine@2.0.1
  - @logosdx/storage@2.0.1

## 2.0.0

### Major Changes

- e6fc2da: **BREAKING:** `createFetchContext` hooks now return objects instead of tuples.

  **Queries** (`get()`):

  - Before: `[cancel, isLoading, response, error]`
  - After: `{ data, loading, error, response, refetch, cancel }`
  - `data` is unwrapped `T` (no longer need `response.data`)
  - `response` provides full `FetchResponse<T>` access (status, headers)
  - `isLoading` renamed to `loading`
  - Added `refetch()` to re-trigger the query

  **Mutations** (`post`, `put`, `del`, `patch`):

  - Before: `[trigger, cancel, isLoading, response, error]`
  - After: `{ data, loading, error, response, mutate, reset, cancel, called }`
  - `trigger()` renamed to `mutate()`, now returns `Promise<T>`
  - `data` is unwrapped `T` (no longer need `response.data`)
  - `response` provides full `FetchResponse<T>` access (status, headers)
  - `isLoading` renamed to `loading`
  - Added `reset()` to clear mutation state
  - Added `called` boolean to track whether `mutate()` has been invoked

  **New types:** `FetchContextQueryResult<T, RH>` and `FetchContextMutationResult<T, RH>` exported from `@logosdx/react`.

### Minor Changes

- 05e0b81: ## Added

  - `feat(api):` Apollo-style `useQuery`, `useMutation`, and `useAsync` hooks with auto-fetch, reactive config, polling, and cancellation
  - `feat(api):` `createQuery` and `createMutation` factory functions for reusable pre-bound hooks
  - `feat(api):` `createApiHooks` binding that pre-wires FetchEngine and ObserverEngine to all API hooks
  - `feat(api):` ObserverEngine integration — `invalidateOn` for automatic refetch on events, `emitOnSuccess` for mutation-driven event emission
  - `feat(api):` New `@logosdx/react/api` subpath export

## 1.0.0

### Major Changes

- 2f9c85c: ## Added

  - `feat(react):` New `@logosdx/react` package — React bindings for Observer, Fetch, Storage, and Localize via factory-pattern context providers and hooks.

    Each `create*Context(instance)` factory captures the engine instance and returns a `[Provider, useHook]` tuple with full type inference:

    - `createObserverContext` — `on`, `once`, `oncePromise`, `emit`, `emitFactory`
    - `createFetchContext` — `get` (auto-fetch query), `post`, `put`, `del`, `patch` (mutations), `instance`
    - `createStorageContext` — `get`, `set`, `remove`, `assign`, `has`, `clear`, `wrap`, `keys`
    - `createLocalizeContext` — `t`, `locale`, `changeTo`, `locales`

    All peer dependencies are optional — install only what you use.

  - `feat(react):` `composeProviders` utility — eliminates deeply nested provider trees. Accepts bare providers or `[Provider, props]` tuples.

  ## Fixed

  - `fix(react):` Export return types so consumers can name inferred types portably in `.d.ts` files
  - `fix(react):` Fix internal import reaching into `@logosdx/utils` dist path
  - `fix(react):` Update localize binding to use renamed `'change'` event (from `'locale-change'`)

### Patch Changes

- Updated dependencies [2f9c85c]
- Updated dependencies [340ba3c]
- Updated dependencies [2f9c85c]
- Updated dependencies [879cea2]
- Updated dependencies [2f9c85c]
- Updated dependencies [879cea2]
  - @logosdx/fetch@8.0.0
  - @logosdx/localize@2.0.0
  - @logosdx/observer@2.4.0
  - @logosdx/state-machine@2.0.0
  - @logosdx/storage@2.0.0
  - @logosdx/utils@6.1.0

## 1.0.0-beta.2

### Major Changes

- 2f9c85c: ## Added

  - `feat(react):` New `@logosdx/react` package — React bindings for Observer, Fetch, Storage, and Localize via factory-pattern context providers and hooks.

    Each `create*Context(instance)` factory captures the engine instance and returns a `[Provider, useHook]` tuple with full type inference:

    - `createObserverContext` — `on`, `once`, `oncePromise`, `emit`, `emitFactory`
    - `createFetchContext` — `get` (auto-fetch query), `post`, `put`, `del`, `patch` (mutations), `instance`
    - `createStorageContext` — `get`, `set`, `remove`, `assign`, `has`, `clear`, `wrap`, `keys`
    - `createLocalizeContext` — `t`, `locale`, `changeTo`, `locales`

    All peer dependencies are optional — install only what you use.

  - `feat(react):` `composeProviders` utility — eliminates deeply nested provider trees. Accepts bare providers or `[Provider, props]` tuples.

  ## Fixed

  - `fix(react):` Export return types so consumers can name inferred types portably in `.d.ts` files
  - `fix(react):` Fix internal import reaching into `@logosdx/utils` dist path
  - `fix(react):` Update localize binding to use renamed `'change'` event (from `'locale-change'`)

### Patch Changes

- Updated dependencies [2f9c85c]
- Updated dependencies [340ba3c]
- Updated dependencies [2f9c85c]
- Updated dependencies [879cea2]
- Updated dependencies [2f9c85c]
- Updated dependencies [879cea2]
  - @logosdx/fetch@8.0.0-beta.3
  - @logosdx/localize@2.0.0-beta.2
  - @logosdx/observer@2.4.0-beta.2
  - @logosdx/state-machine@2.0.0-beta.1
  - @logosdx/storage@2.0.0-beta.1
  - @logosdx/utils@6.1.0-beta.1

## 0.1.0-beta.1

### Patch Changes

- f62552d: ## Fixed
  - `fix(react):` Export return types so consumers can name inferred types portably in `.d.ts` files
  - `fix(react):` Fix internal import reaching into `@logosdx/utils` dist path

## 0.1.0-beta.0

### Minor Changes

- 9c1a8f2: ## Added

  - `feat(react):` New `@logosdx/react` package — React bindings for Observer, Fetch, Storage, and Localize via factory-pattern context providers and hooks.

    Each `create*Context(instance)` factory captures the engine instance and returns a `[Provider, useHook]` tuple with full type inference:

    - `createObserverContext` — `on`, `once`, `oncePromise`, `emit`, `emitFactory`
    - `createFetchContext` — `get` (auto-fetch query), `post`, `put`, `del`, `patch` (mutations), `instance`
    - `createStorageContext` — `get`, `set`, `remove`, `assign`, `has`, `clear`, `wrap`, `keys`
    - `createLocalizeContext` — `t`, `locale`, `changeTo`, `locales`

    All peer dependencies are optional — install only what you use.

  - `feat(react):` `composeProviders` utility — eliminates deeply nested provider trees. Accepts bare providers or `[Provider, props]` tuples for providers that need configuration. First entry becomes the outermost wrapper.

  - `feat(build):` Strip `#private;` brands from `.d.ts` declaration files during build. ES private fields (`#field`) emit an opaque `#private` marker that makes classes nominally typed by their generics. Stripping it restores structural compatibility while keeping runtime privacy intact.

  ## Fixed

  - `fix(localize):` `LocaleManager.off()` now accepts `LocaleListener<Code>` instead of `EventListenerOrEventListenerObject`, matching the `on()` signature so listeners can be passed to both without type errors.

### Patch Changes

- Updated dependencies [9c1a8f2]
- Updated dependencies [3dc7890]
  - @logosdx/localize@1.0.22-beta.1
  - @logosdx/observer@2.3.1-beta.1
  - @logosdx/fetch@8.0.0-beta.2
