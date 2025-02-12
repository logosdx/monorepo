---
"@logos-ui/state-machine": major
"@logos-ui/observer": major
"@logos-ui/fetch": major
"@logos-ui/dom": major
"@logos-ui/kit": major
---

## All packages

- Stricter and more consistent TypeScript types
- Improved documentation
- Improved test coverage

## `@logos-ui/observer`

- Added `EventPromise` when calling `once` without a callback
- Added `EventGenerator` when calling `on` without a callback
- `on('*')` and `emit('*')` now work as expected
- Regex listeners now emit a `{ event, data }` object instead of just the data
- Added Emit validators to allow developers to validate the data being emitted
- Added `$facts()`, `$internals()`, and `$has(event)` meta helpers for debugging
- Removed `Component` as type and as a first argument when constructing an `ObserverEngine`. Only `observe(component)` is now available.
- Removed alternative methods for `on`, `once` and etc. The API is now decisively `on`, `once`, `off`, and `emit`.

## `@logos-ui/fetch`

- Added `params` to instance options and request options. You can now pass query parameters to the fetch request.
- `headers`, `params`, and `modifyOptions` now have an equivalent configuration option for each HTTP method.
    - `headers` -> `methodHeaders`
    - `params` -> `methodParams`
    - `modifyOptions` -> `modifyMethodOptions`
    - All follow a `{ method: option }` pattern
- Added `validate` options for header, state, and params. You can now also validate per-request if configured.
- `type` is no longer a required option. It is now inferred from the response headers.
- `defaultType` is used when the response headers do not contain a `Content-Type` header.
- The determination of how to parse response can be overridden by passing the `determineType(response)` option. The user can now determine how to parse the response based on the response headers.
- Empty responses are now properly handled and do not throw an error.
- Can now pass a `formatHeaders` function to format the headers before they are sent.
- Can modify params like headers using the `addParams(params)`, `removeParams(params)`, and `hasParams(params)` methods.
- Headers and params can be modified per http method by passing the last argument: `addParams(params, method)` and `addHeaders(headers, method)`.

## `@logos-ui/dom`

- For consistency, events now match the same API as `@logos-ui/observer`.
    - `on`, `once`, `off`, `emit`

## `@logos-ui/kit`

- Upgrading to breaking package versions
- Can now configure multiple API clients by passing the `apis` config, where each key is the API name and the value is the API configuration.
