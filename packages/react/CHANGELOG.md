# @logosdx/react

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
