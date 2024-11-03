---
"@logos-ui/observer": major
"@logos-ui/utils": minor
---

## @logos-ui/observer

### Breaking Changes

- `observer.on` and `observer.one` return a function that can be used to remove the listener. This is a breaking change since before it would return an object with a `cleanup` method.
- Alignments with traditional event emitter patterns:
  - `observer.one` is now an alias, and `observer.once` is the primary method.
  - `observer.trigger` is now an alias, and `observer.emit` is the primary method.

### New Features

- `observer.on` returns an event generator when no callback is provided.
  - Event generators listen for the next event using `next()` method, which returns a promise that resolves with data. Once resolved, a new promise is generated to await the next event.
  - Event generators can also `.emit(...)` events to the generator.
  - Event generators can be `destroy()`ed and will no longer listen for events or allow the emission of events.

### Fixes and Improvements

- Observer functions are now validated to ensure runtime safety.


## @logos-ui/utils

### New Features

- `utils` now includes a `Deferred` class that can be used to create a promise that can be resolved or rejected externally.