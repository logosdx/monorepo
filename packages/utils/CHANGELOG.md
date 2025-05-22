# @logos-ui/utils

## 3.1.0

### Minor Changes

- 0110f9e: Go-style error monad

## 3.0.0

### Major Changes

- 637f320: **@logos-ui/dom:**

  - Detect and only run in browser

  **@logos-ui/utils (BREAKING):**

  - Browser detection
  - Only run browser specific code in browser

  **@logos-ui/kit (BREAKING):**

  - No longer comes with @logos-ui/dom

## 2.3.0

### Minor Changes

- e333da3: Added configurable retry mechanism to FetchEngine:

  - Added ability to configure an external abort controller per request

  - Added retry configuration with the following options:

    - `maxAttempts`: Maximum number of retry attempts (default: 3)
    - `baseDelay`: Base delay between retries in ms (default: 1000)
    - `maxDelay`: Maximum delay between retries in ms (default: 10000)
    - `useExponentialBackoff`: Whether to use exponential backoff (default: true)
    - `retryableStatusCodes`: Status codes that trigger a retry (default: [408, 429, 499, 500, 502, 503, 504])
    - `shouldRetry`: Custom function to determine if a request should be retried

  - Added retry-related features:

    - Exponential backoff with configurable delays
    - Per-request retry configuration override
    - New 'fetch-retry' event emitted before each retry attempt
    - Retry attempt count included in all fetch events
    - Enhanced error handling with attempt tracking

  - Enhanced error handling:

    - Added attempt count to FetchError
    - Added step tracking ('fetch', 'parse', 'response') to errors
    - Improved error classification and handling

  - Added utility improvements:
    - New attempt/attemptSync helpers for error handling
    - Enhanced error event data with more context

## 2.2.0

### Minor Changes

- 90b498a: Added new assertion utilities
- 89d795c: `assertObject(val, assertions)` - Asserts the values in an object based on the provided assertations. The assertations are a map of paths to functions that return a tuple of a boolean and a message. This is intended to be used for testing and validation when there is no schema validator available.

  `isOptional(val, check)` - Optional value check. If value is undefined or null, it is considered optional. If a function is provided, it is used to check the value. If a boolean is provided, it is used to check the value.

  `reach(obj, path)` - Reaches into an object and returns the value at the end of the path.

  `PathValue<T, P>` - A utility type that gets the value at a path in an object.

### Patch Changes

- 8859bc6: Prototype pollution protection
- e4e671a: Fix build script
- bd7c0e0: assertObj accept array of validators

## 2.2.0-next.4

### Patch Changes

- bd7c0e0: assertObj accept array of validators

## 2.2.0-next.3

### Patch Changes

- e4e671a: Fix build script

## 2.2.0-next.2

### Minor Changes

- 89d795c: `assertObject(val, assertions)` - Asserts the values in an object based on the provided assertations. The assertations are a map of paths to functions that return a tuple of a boolean and a message. This is intended to be used for testing and validation when there is no schema validator available.

  `isOptional(val, check)` - Optional value check. If value is undefined or null, it is considered optional. If a function is provided, it is used to check the value. If a boolean is provided, it is used to check the value.

  `reach(obj, path)` - Reaches into an object and returns the value at the end of the path.

  `PathValue<T, P>` - A utility type that gets the value at a path in an object.

## 2.2.0-next.1

### Patch Changes

- 8859bc6: Prototype pollution protection

## 2.2.0-next.0

### Minor Changes

- 90b498a: Added new assertion utilities

## 2.1.0

### Minor Changes

- dd1794f: ## @logos-ui/observer

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

## 2.0.5

### Patch Changes

- ca76a50: Bump again

## 2.0.4

### Patch Changes

- 0566a67: Bump all dependencies for cjs / esm build

## 2.0.3

### Patch Changes

- 176ed64: Export better utility typings for Kit

## 2.0.2

### Patch Changes

- c167f6b: Improved types for object path names

## 2.0.1

### Patch Changes

- c7051bb: Make modules CJS/ESM agnostic

## 2.0.0

### Major Changes

- 847eb42: Build for ESM and CJS. Modules should now work in both.

## 1.1.4

### Patch Changes

- 5ef68a9: Once again...

## 1.1.3

### Patch Changes

- 432396d: Check against global to detect NodeJS because of build time issues when `process` when not reading as `global.process`

## 1.1.2

### Patch Changes

- ba8b52d: Properly detect NodeJS so as to work with electron when stubbing window.

## 1.1.1

### Patch Changes

- e6e4d56: Added a window stub so packages can be used in NodeJS. Now, Observer, Localize, StateMachine, Storage, and whatever non-DOM related utility functions are usefule.

## 1.1.0

### Minor Changes

- e5d039d: Documentation for all packages is completed and can be found at [https://logosui.com](https://logosui.com). All packages are tested and ready for use. For bug reports, questions, and suggestions, please use [https://github.com/logos-ui/discuss](https://github.com/logos-ui/discuss).

## 1.0.0

### Major Changes

- 58c0208: Initial commit!

  These packages were made to simplify the development of web applications, and reduce the decisions we make when building apps. You don't always need all the things, but you always need some things. When you apps are simple, they should remain so. When they grow in complexity, they should do so with ease.

  [Discussions can be had here](https://github.com/logos-ui/discuss). This will also include a link to the documentation (which is a WIP at the current moment). Domain not included here because it will in the future change. Enjoy using this neat piece of software utility, and do not be afraid to provide feedback; it is welcome!
