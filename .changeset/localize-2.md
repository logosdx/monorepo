---
"@logosdx/localize": major
---

## Breaking Changes

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

* `feat(localize):` `register(code, { text, loader })` — lazy-loaded locales with dynamic import loaders
* `feat(localize):` `isLoaded(code): boolean` — check whether a locale's labels have been fetched
* `feat(localize):` `manager.intl` getter — `IntlFormatters` with cached `number()`, `date()`, `relative()` helpers
* `feat(localize):` ICU-lite pluralization — `{count, plural, one {# item} other {# items}}` via `Intl.PluralRules`
* `feat(localize):` `ScopedLocale` class via `manager.ns(prefix)` — namespace-scoped translator, chainable
* `feat(localize):` `createIntlFormatters(locale)` and `parsePlural(str, values, locale)` exported for standalone use
* `feat(localize):` `on()` returns an unsubscribe cleanup function
* `feat(localize):` `once()` method for one-time event listeners
* `feat(localize):` `'loading'` and `'error'` events for async locale loading lifecycle
* `feat(localize):` Type extractor CLI — `npx logosdx-locale extract --dir ./i18n --out ./src/locale-keys.ts` generates TypeScript interfaces and `LocaleCodes` union from JSON locale files
* `feat(localize):` `--watch` mode for CLI — auto-regenerates types on file changes
* `feat(localize):` Programmatic API via `@logosdx/localize/extractor` — `scanDirectory()`, `generateOutput()`, `jsonToInterface()`

## Fixed

* `fix(localize):` `format()` filter used `||` instead of `&&`, never filtering null/undefined values
* `fix(localize):` `format()` empty-check failed for plain object values (no `.length` property)
* `fix(localize):` `reachIn` returned parent object instead of `defValue` when path segment was missing
* `fix(localize):` Concurrent `changeTo()` calls for the same unloaded locale now deduplicate (race guard)


## Changed

* `perf(localize):` Cache compiled `RegExp` instances in `format()` across calls
* `perf(localize):` Optimize `#merge()` — single clone + merge instead of double
* `perf(localize):` Cache `Intl.*Format` instances keyed by locale + options
* `perf(localize):` Cache `intl` getter result, invalidated on locale change
