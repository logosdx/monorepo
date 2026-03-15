# @logosdx/localize

## 2.0.1

### Patch Changes

- Updated dependencies [5b872ff]
  - @logosdx/observer@2.5.0

## 2.0.0

### Major Changes

- 340ba3c: ## Breaking Changes

  ### EventTarget replaced with ObserverEngine

  `LocaleManager` no longer extends `EventTarget`. It now uses `@logosdx/observer`'s `ObserverEngine` internally. The public API (`on`, `off`, `once`) remains the same, but listeners now receive a plain `{ code }` object instead of a `LocaleEvent` instance.

  **Before:**

      import { LocaleEvent } from '@logosdx/localize';

      manager.on('change', (event: LocaleEvent) => {
          console.log(event.type, event.code);
      });

  **After:**

      manager.on('change', ({ code }) => {
          console.log(code);
      });

  ### `LocaleEvent` class removed

  The `LocaleEvent` class (which extended `Event`) has been removed. Listeners receive `{ code: Code }` directly. The `once` parameter on `on()` has been replaced with a dedicated `once()` method.

  **Before:**

      manager.on('change', handler, true);  // once flag

  **After:**

      manager.once('change', handler);

  ### Event names renamed

  `LocaleEventName` changed from `'locale-change'` to `'change' | 'loading' | 'error'`. Update all `on()` / `off()` calls.

  **Before:**

      manager.on('locale-change', handler);

  **After:**

      manager.on('change', handler);

  ### `LOC_CHANGE` constant removed

  The exported `LOC_CHANGE` constant has been removed. Use the string `'change'` directly.

  ### Missing key return value changed

  Missing translation keys now return `'[key.path]'` instead of `'?'`. A `console.warn` is emitted in non-production environments.

  ### `changeTo()` is now async

  `changeTo(code)` returns `Promise<void>`. Existing sync callers can ignore the promise, but `await` is required when using async locale loading.

  ## Added

  - `feat(localize):` `register(code, { text, loader })` — lazy-loaded locales with dynamic import loaders
  - `feat(localize):` `isLoaded(code): boolean` — check whether a locale's labels have been fetched
  - `feat(localize):` `manager.intl` getter — `IntlFormatters` with cached `number()`, `date()`, `relative()` helpers
  - `feat(localize):` ICU-lite pluralization — `{count, plural, one {# item} other {# items}}` via `Intl.PluralRules`
  - `feat(localize):` `ScopedLocale` class via `manager.ns(prefix)` — namespace-scoped translator, chainable
  - `feat(localize):` `createIntlFormatters(locale)` and `parsePlural(str, values, locale)` exported for standalone use
  - `feat(localize):` `on()` returns an unsubscribe cleanup function
  - `feat(localize):` `once()` method for one-time event listeners
  - `feat(localize):` `'loading'` and `'error'` events for async locale loading lifecycle
  - `feat(localize):` Type extractor CLI — `npx logosdx-locale extract --dir ./i18n --out ./src/locale-keys.ts` generates TypeScript interfaces and `LocaleCodes` union from JSON locale files
  - `feat(localize):` `--watch` mode for CLI — auto-regenerates types on file changes
  - `feat(localize):` Programmatic API via `@logosdx/localize/extractor` — `scanDirectory()`, `generateOutput()`, `jsonToInterface()`

  ## Fixed

  - `fix(localize):` `format()` filter used `||` instead of `&&`, never filtering null/undefined values
  - `fix(localize):` `format()` empty-check failed for plain object values (no `.length` property)
  - `fix(localize):` `reachIn` returned parent object instead of `defValue` when path segment was missing
  - `fix(localize):` Concurrent `changeTo()` calls for the same unloaded locale now deduplicate (race guard)

  ## Changed

  - `perf(localize):` Cache compiled `RegExp` instances in `format()` across calls
  - `perf(localize):` Optimize `#merge()` — single clone + merge instead of double
  - `perf(localize):` Cache `Intl.*Format` instances keyed by locale + options
  - `perf(localize):` Cache `intl` getter result, invalidated on locale change

### Patch Changes

- Updated dependencies [2f9c85c]
- Updated dependencies [879cea2]
  - @logosdx/observer@2.4.0
  - @logosdx/utils@6.1.0

## 2.0.0-beta.2

### Major Changes

- 340ba3c: ## Breaking Changes

  ### EventTarget replaced with ObserverEngine

  `LocaleManager` no longer extends `EventTarget`. It now uses `@logosdx/observer`'s `ObserverEngine` internally. The public API (`on`, `off`, `once`) remains the same, but listeners now receive a plain `{ code }` object instead of a `LocaleEvent` instance.

  **Before:**

      import { LocaleEvent } from '@logosdx/localize';

      manager.on('change', (event: LocaleEvent) => {
          console.log(event.type, event.code);
      });

  **After:**

      manager.on('change', ({ code }) => {
          console.log(code);
      });

  ### `LocaleEvent` class removed

  The `LocaleEvent` class (which extended `Event`) has been removed. Listeners receive `{ code: Code }` directly. The `once` parameter on `on()` has been replaced with a dedicated `once()` method.

  **Before:**

      manager.on('change', handler, true);  // once flag

  **After:**

      manager.once('change', handler);

  ### Event names renamed

  `LocaleEventName` changed from `'locale-change'` to `'change' | 'loading' | 'error'`. Update all `on()` / `off()` calls.

  **Before:**

      manager.on('locale-change', handler);

  **After:**

      manager.on('change', handler);

  ### `LOC_CHANGE` constant removed

  The exported `LOC_CHANGE` constant has been removed. Use the string `'change'` directly.

  ### Missing key return value changed

  Missing translation keys now return `'[key.path]'` instead of `'?'`. A `console.warn` is emitted in non-production environments.

  ### `changeTo()` is now async

  `changeTo(code)` returns `Promise<void>`. Existing sync callers can ignore the promise, but `await` is required when using async locale loading.

  ## Added

  - `feat(localize):` `register(code, { text, loader })` — lazy-loaded locales with dynamic import loaders
  - `feat(localize):` `isLoaded(code): boolean` — check whether a locale's labels have been fetched
  - `feat(localize):` `manager.intl` getter — `IntlFormatters` with cached `number()`, `date()`, `relative()` helpers
  - `feat(localize):` ICU-lite pluralization — `{count, plural, one {# item} other {# items}}` via `Intl.PluralRules`
  - `feat(localize):` `ScopedLocale` class via `manager.ns(prefix)` — namespace-scoped translator, chainable
  - `feat(localize):` `createIntlFormatters(locale)` and `parsePlural(str, values, locale)` exported for standalone use
  - `feat(localize):` `on()` returns an unsubscribe cleanup function
  - `feat(localize):` `once()` method for one-time event listeners
  - `feat(localize):` `'loading'` and `'error'` events for async locale loading lifecycle
  - `feat(localize):` Type extractor CLI — `npx logosdx-locale extract --dir ./i18n --out ./src/locale-keys.ts` generates TypeScript interfaces and `LocaleCodes` union from JSON locale files
  - `feat(localize):` `--watch` mode for CLI — auto-regenerates types on file changes
  - `feat(localize):` Programmatic API via `@logosdx/localize/extractor` — `scanDirectory()`, `generateOutput()`, `jsonToInterface()`

  ## Fixed

  - `fix(localize):` `format()` filter used `||` instead of `&&`, never filtering null/undefined values
  - `fix(localize):` `format()` empty-check failed for plain object values (no `.length` property)
  - `fix(localize):` `reachIn` returned parent object instead of `defValue` when path segment was missing
  - `fix(localize):` Concurrent `changeTo()` calls for the same unloaded locale now deduplicate (race guard)

  ## Changed

  - `perf(localize):` Cache compiled `RegExp` instances in `format()` across calls
  - `perf(localize):` Optimize `#merge()` — single clone + merge instead of double
  - `perf(localize):` Cache `Intl.*Format` instances keyed by locale + options
  - `perf(localize):` Cache `intl` getter result, invalidated on locale change

### Patch Changes

- Updated dependencies [2f9c85c]
- Updated dependencies [879cea2]
  - @logosdx/observer@2.4.0-beta.2
  - @logosdx/utils@6.1.0-beta.1

## 1.0.22-beta.1

### Patch Changes

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

## 1.0.22-beta.0

### Patch Changes

- Updated dependencies [11e8233]
  - @logosdx/utils@6.1.0-beta.0

## 1.0.21

### Patch Changes

- Updated dependencies [5380675]
  - @logosdx/utils@6.0.0

## 1.0.20

### Patch Changes

- Updated dependencies [ea81582]
  - @logosdx/utils@5.1.0

## 1.0.19

### Patch Changes

- Updated dependencies [582644e]
- Updated dependencies [e4e4f43]
  - @logosdx/utils@5.0.0

## 1.0.18

### Patch Changes

- Updated dependencies [567ed1f]
- Updated dependencies [204dd76]
  - @logosdx/utils@4.0.0

## 1.0.17

### Patch Changes

- Updated dependencies [e6b07d8]
  - @logosdx/utils@3.0.1

## 1.0.16

### Patch Changes

- Updated dependencies [96fe247]
  - @logosdx/utils@3.0.0

## 1.0.15

### Patch Changes

- Updated dependencies [6416ac4]
  - @logosdx/utils@2.5.0

## 1.0.14

### Patch Changes

- Updated dependencies [8fda604]
  - @logosdx/utils@2.4.0

## 1.0.13

### Patch Changes

- Updated dependencies [9edb1c4]
- Updated dependencies [6560f02]
  - @logosdx/utils@2.3.0

## 1.0.12

### Patch Changes

- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
  - @logosdx/utils@2.2.0

## 1.0.11

### Patch Changes

- Updated dependencies [9e6afcd]
  - @logosdx/utils@2.1.2

## 1.0.10

### Patch Changes

- Updated dependencies [2c6c8cc]
  - @logosdx/utils@2.1.1

## 1.0.9

### Patch Changes

- Updated dependencies [755e80d]
  - @logosdx/utils@2.1.0

## 1.0.8

### Patch Changes

- Updated dependencies [cbd0e23]
  - @logosdx/utils@2.0.3

## 1.0.7

### Patch Changes

- eecc5d4: Export type so they aren't compiled into ESM files
- Updated dependencies [eecc5d4]
  - @logosdx/utils@2.0.2

## 1.0.6

### Patch Changes

- 43b3457: ### Fixed

  - Export bug from utils.
  - Better naming for options

- Updated dependencies [43b3457]
  - @logosdx/utils@2.0.1

## 1.0.5

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
