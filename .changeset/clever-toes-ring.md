---
"@logos-ui/observer": major
"@logos-ui/utils": minor
"@logos-ui/fetch": minor
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

## @logos-ui/fetch

### New Features

- Added FetchOptions:
  - `methodHeaders` allows for the configuration of headers based on the HTTP method.
  - `modifyMethodOptions` allows for the modification of options based on the HTTP method.
  - `validate` allows for validation configuration for:
    - `headers(...httpHeaders)` - Validates headers.
    - `state(...instanceState)` - Validates the state of the instance.
    - `perRequest.headers: boolean` - Validates headers on a per-request basis.
  - `fetch.headers` returns the headers configuration.

### Improvements

- `fetch.addHeader()` can now be passed key, value arguments to add a single header: `fetch.addHeader('key', 'value')`.
- `fetch.setState()` can now be passed a key, value argument to set a single state: `fetch.setState('key', 'value')`.

### Fixes

- Headers typings allow configuration of headers as partials.
- `FetchError` correctly passes the HTTP body to the error message on `FetchError.data`, if available.

## @logos-ui/utils

### New Features

- `utils` now includes a `Deferred` class that can be used to create a promise that can be resolved or rejected externally.