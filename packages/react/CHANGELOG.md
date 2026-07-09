# @logosdx/react

## 5.0.0

### Major Changes

- 24876f0: ## Breaking Changes

  ### Non-2xx responses resolve instead of throwing

  `FetchEngine` no longer throws/rejects on a non-2xx status. Every completed exchange
  resolves as a `FetchResponse` discriminated union on `ok`; narrow on `res.ok` before
  reading `data` as `T`.

  **Before:**

  ```ts
  const [user, err] = await attempt(() => api.get<User>(`/users/${id}`));
  if (err) return handleError(err); // ran for both transport AND 404/500
  console.log(user.name);
  ```

  **After:**

  ```ts
  const [res, err] = await attempt(() => api.get<User>(`/users/${id}`));
  if (err) return handleError(err); // transport-only: abort, timeout, parse-on-ok:true
  if (!res.ok) return handleHttpError(res.status, res.data);
  console.log(res.data.name);
  ```

  Anything that counts thrown errors — `composeFlow`'s `circuitBreaker`, external retry
  wrappers, `catch`-based failure counters — no longer sees HTTP failures. Throw on
  `!res.ok` inside the wrapped function if a non-2xx should count as a failure.

  ### `FetchError` is transport-only

  `FetchError` drops its `data` field and `T` generic — it's never an HTTP status error
  anymore. `step` narrows to `'fetch' | 'parse'` (the `'response'` step is gone).

  ### `shouldRetry` receives `FetchResponse | FetchError`

  `retryableStatusCodes` is now a second retry trigger, evaluated against a resolved
  `ok: false` response. `shouldRetry(outcome)` receives either shape — discriminate with
  `isFetchError(outcome)`. Exhausted HTTP-status retries resolve (`ok: false`), they don't
  throw.

  ### Events: `response` fires for every status; `error` narrows to transport

  - `response` fires for every completed exchange, any status.
  - `response-4xx` / `response-5xx` fire additionally for their status ranges.
  - `error` fires only for transport failures, parse-on-`ok:true`, and rate-limit reject.
  - `retry` carries whichever outcome triggered it (`FetchResponse | FetchError`).
  - All fire per attempt, sharing one `requestId` across a retried request's attempts.

  ### Caching and cookies

  - `ok: false` responses are never written to cache — neither the initial store write nor
    SWR background revalidation, which now leaves the existing stale entry untouched.
  - `cache-revalidate-error`'s failure cause moved to a new `outcome` field
    (`FetchResponse | FetchError`) — for a non-2xx revalidation there is no `error` key,
    only `outcome`; reading `error.message` there is `undefined`.
  - `Set-Cookie` response headers are captured into the cookie jar regardless of status.

  ### `@logosdx/react`: `error`/`response` state replaced by a `failure` union

  `useQuery`, `useMutation`, and `createFetchContext` expose one `failure` field in place
  of the old `FetchError`-only `error` state:

  ```ts
  type FetchFailure<T> =
    | { kind: "transport"; error: FetchError }
    | { kind: "http"; response: Extract<FetchResponse<T>, { ok: false }> };
  ```

  `useMutation`'s `mutate()` never rejects — `Promise<T | undefined>`, resolving
  `undefined` on any failure; read `failure` for why. `useAsync`'s generic failure state
  is `AsyncFailure` (`{ kind: 'rejected' }` for a thrown non-`FetchError`, or
  `{ kind: 'http' }` for a resolved `ok: false`).

  ## No migration shim

  This is a clean break — there is no `throwHttpErrors`/`validateStatus` config toggle to
  opt back into throw-on-status. Update every call site that branches on a caught
  non-2xx error to branch on `res.ok` instead.

### Patch Changes

- Updated dependencies [24876f0]
  - @logosdx/fetch@9.0.0

## 4.0.2

### Patch Changes

- Updated dependencies [154b5b1]
  - @logosdx/utils@7.0.1
  - @logosdx/fetch@8.1.2
  - @logosdx/localize@2.0.3
  - @logosdx/observer@2.5.2
  - @logosdx/state-machine@2.0.3
  - @logosdx/storage@2.0.3

## 4.0.1

### Patch Changes

- Updated dependencies [789a406]
  - @logosdx/utils@7.0.0
  - @logosdx/fetch@8.1.1
  - @logosdx/localize@2.0.2
  - @logosdx/observer@2.5.1
  - @logosdx/state-machine@2.0.2
  - @logosdx/storage@2.0.2

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
