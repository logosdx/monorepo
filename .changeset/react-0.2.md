---
"@logosdx/react": minor
---

## Added

* `feat(react):` New `@logosdx/react` package — React bindings for Observer, Fetch, Storage, and Localize via factory-pattern context providers and hooks.

    Each `create*Context(instance)` factory captures the engine instance and returns a `[Provider, useHook]` tuple with full type inference:

    - `createObserverContext` — `on`, `once`, `oncePromise`, `emit`, `emitFactory`
    - `createFetchContext` — `get` (auto-fetch query), `post`, `put`, `del`, `patch` (mutations), `instance`
    - `createStorageContext` — `get`, `set`, `remove`, `assign`, `has`, `clear`, `wrap`, `keys`
    - `createLocalizeContext` — `t`, `locale`, `changeTo`, `locales`

    All peer dependencies are optional — install only what you use.

* `feat(react):` `composeProviders` utility — eliminates deeply nested provider trees. Accepts bare providers or `[Provider, props]` tuples.

## Fixed

* `fix(react):` Export return types so consumers can name inferred types portably in `.d.ts` files
* `fix(react):` Fix internal import reaching into `@logosdx/utils` dist path
* `fix(react):` Update localize binding to use renamed `'change'` event (from `'locale-change'`)
