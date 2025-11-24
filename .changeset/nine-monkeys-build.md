---
"@logosdx/fetch": major
"@logosdx/utils": patch
---

## @logosdx/fetch

### Added

* `feat(fetch):` FetchEngine now extends ObserverEngine for unified event handling
* `feat(fetch):` Added `name` and `spy` options to FetchEngine constructor for debugging
* `feat(fetch):` Added `FetchEngine.EventData` and `FetchEngine.EventMap` type definitions

### Changed

* **Breaking:** `refactor!(fetch):` Event system migrated from EventTarget to ObserverEngine
  - `on('*', listener)` → `on(/fetch-.*/, listener)` for wildcard events
  - Non-regex listeners now receive `(data: EventData, info?: { event, listener })` instead of `FetchEvent`
  - Regex listeners receive `({ event: string, data: EventData })` as first argument
  - `on()` now returns a cleanup function (can also use inherited `off()` method)
* **Breaking:** `refactor!(fetch):` Removed `FetchEvent` class and `FetchEventNames` enum exports
* `refactor(fetch):` `destroy()` now automatically clears all event listeners via ObserverEngine's `clear()`

### Removed

* **Breaking:** `feat!(fetch):` Removed `FetchEvent` export - use `FetchEngine.EventData` type instead
* **Breaking:** `feat!(fetch):` Removed `FetchEventNames` export - event names are now string literals

## @logosdx/utils

### Changed

* `fix(utils):` Changed `Func` and `AsyncFunc` type generics from `unknown[]`/`unknown` to `any[]`/`any` for better variance compatibility
