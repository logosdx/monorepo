# @logosdx/kit

## 4.0.3

### Patch Changes

- Updated dependencies [08cffe5]
  - @logosdx/utils@3.2.0
  - @logosdx/fetch@4.1.4
  - @logosdx/localize@3.0.5
  - @logosdx/observer@4.0.5
  - @logosdx/state-machine@3.0.5
  - @logosdx/storage@3.0.5

## 4.0.2

### Patch Changes

- Updated dependencies [b85f688]
  - @logosdx/utils@3.1.1
  - @logosdx/fetch@4.1.3
  - @logosdx/localize@3.0.4
  - @logosdx/observer@4.0.4
  - @logosdx/state-machine@3.0.4
  - @logosdx/storage@3.0.4

## 4.0.1

### Patch Changes

- Updated dependencies [0110f9e]
  - @logosdx/utils@3.1.0
  - @logosdx/fetch@4.1.2
  - @logosdx/localize@3.0.3
  - @logosdx/observer@4.0.3
  - @logosdx/state-machine@3.0.3
  - @logosdx/storage@3.0.3

## 4.0.0

### Major Changes

- 637f320: **@logosdx/dom:**

  - Detect and only run in browser

  **@logosdx/utils (BREAKING):**

  - Browser detection
  - Only run browser specific code in browser

  **@logosdx/kit (BREAKING):**

  - No longer comes with @logosdx/dom

### Patch Changes

- Updated dependencies [637f320]
  - @logosdx/utils@3.0.0
  - @logosdx/fetch@4.1.1
  - @logosdx/localize@3.0.2
  - @logosdx/observer@4.0.2
  - @logosdx/state-machine@3.0.2
  - @logosdx/storage@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [e333da3]
  - @logosdx/fetch@4.1.0
  - @logosdx/utils@2.3.0
  - @logosdx/dom@3.0.1
  - @logosdx/localize@3.0.1
  - @logosdx/observer@4.0.1
  - @logosdx/state-machine@3.0.1
  - @logosdx/storage@3.0.1

## 3.0.0

### Major Changes

- f870720: # Better semantics

  Rename classes to use more precise and semantic names.

  - `FetchFactory` -> `FetchEngine`
  - `ObserverFactory` -> `ObserverEngine`
  - `LocaleFactory` -> `LocaleManager`
  - `StorageFactory` -> `StorageAdapter`

  Why? Because these abstractions aren't factories, they are engines or adapters. They provide a way to interact with a specific system in a highly configurable way. It's more accurate to call them engines or adapters or managers.

- 9bae275: ## All packages

  - Stricter and more consistent TypeScript types
  - Improved documentation
  - Improved test coverage

  ## `@logosdx/observer`

  - Added `EventPromise` when calling `once` without a callback
  - Added `EventGenerator` when calling `on` without a callback
  - `on('*')` and `emit('*')` now work as expected
  - Regex listeners now emit a `{ event, data }` object instead of just the data
  - Added Emit validators to allow developers to validate the data being emitted
  - Added `$facts()`, `$internals()`, and `$has(event)` meta helpers for debugging
  - Removed `Component` as type and as a first argument when constructing an `ObserverEngine`. Only `observe(component)` is now available.
  - Removed alternative methods for `on`, `once` and etc. The API is now decisively `on`, `once`, `off`, and `emit`.

  ## `@logosdx/fetch`

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

  ## `@logosdx/dom`

  - For consistency, events now match the same API as `@logosdx/observer`.
    - `on`, `once`, `off`, `emit`

  ## `@logosdx/kit`

  - Upgrading to breaking package versions
  - Can now configure multiple API clients by passing the `apis` config, where each key is the API name and the value is the API configuration.

### Patch Changes

- e4e671a: Fix build script
- Updated dependencies [f870720]
- Updated dependencies [9bae275]
- Updated dependencies [8859bc6]
- Updated dependencies [a05786d]
- Updated dependencies [57a4d89]
- Updated dependencies [82b7d41]
- Updated dependencies [90b498a]
- Updated dependencies [e4e671a]
- Updated dependencies [d670c56]
- Updated dependencies [bd7c0e0]
- Updated dependencies [89d795c]
  - @logosdx/state-machine@3.0.0
  - @logosdx/localize@3.0.0
  - @logosdx/observer@4.0.0
  - @logosdx/storage@3.0.0
  - @logosdx/fetch@4.0.0
  - @logosdx/dom@3.0.0
  - @logosdx/utils@2.2.0

## 3.0.0-next.9

### Patch Changes

- Updated dependencies [a05786d]
  - @logosdx/state-machine@3.0.0-next.6
  - @logosdx/observer@4.0.0-next.8
  - @logosdx/storage@2.0.8-next.5
  - @logosdx/fetch@4.0.0-next.6

## 3.0.0-next.8

### Patch Changes

- Updated dependencies [bd7c0e0]
  - @logosdx/utils@2.2.0-next.4
  - @logosdx/dom@3.0.0-next.5
  - @logosdx/fetch@4.0.0-next.5
  - @logosdx/localize@3.0.0-next.5
  - @logosdx/observer@4.0.0-next.7
  - @logosdx/state-machine@3.0.0-next.5
  - @logosdx/storage@2.0.8-next.4

## 3.0.0-next.7

### Patch Changes

- e4e671a: Fix build script
- Updated dependencies [e4e671a]
  - @logosdx/dom@3.0.0-next.4
  - @logosdx/fetch@4.0.0-next.4
  - @logosdx/localize@3.0.0-next.4
  - @logosdx/observer@4.0.0-next.6
  - @logosdx/state-machine@3.0.0-next.4
  - @logosdx/storage@2.0.8-next.3
  - @logosdx/utils@2.2.0-next.3

## 3.0.0-next.6

### Patch Changes

- Updated dependencies [89d795c]
  - @logosdx/utils@2.2.0-next.2
  - @logosdx/dom@3.0.0-next.3
  - @logosdx/fetch@4.0.0-next.3
  - @logosdx/localize@3.0.0-next.3
  - @logosdx/observer@4.0.0-next.5
  - @logosdx/state-machine@3.0.0-next.3
  - @logosdx/storage@2.0.8-next.2

## 3.0.0-next.5

### Patch Changes

- Updated dependencies [57a4d89]
  - @logosdx/localize@3.0.0-next.2

## 3.0.0-next.4

### Patch Changes

- Updated dependencies [8859bc6]
  - @logosdx/utils@2.2.0-next.1
  - @logosdx/dom@3.0.0-next.2
  - @logosdx/fetch@4.0.0-next.2
  - @logosdx/localize@2.0.8-next.1
  - @logosdx/observer@4.0.0-next.4
  - @logosdx/state-machine@3.0.0-next.2
  - @logosdx/storage@2.0.8-next.1

## 3.0.0-next.3

### Patch Changes

- Updated dependencies [d670c56]
  - @logosdx/observer@4.0.0-next.3

## 3.0.0-next.2

### Patch Changes

- Updated dependencies [82b7d41]
  - @logosdx/observer@4.0.0-next.2

## 3.0.0-next.1

### Patch Changes

- Updated dependencies [90b498a]
  - @logosdx/utils@2.2.0-next.0
  - @logosdx/dom@3.0.0-next.1
  - @logosdx/fetch@4.0.0-next.1
  - @logosdx/localize@2.0.8-next.0
  - @logosdx/observer@4.0.0-next.1
  - @logosdx/state-machine@3.0.0-next.1
  - @logosdx/storage@2.0.8-next.0

## 3.0.0-next.0

### Major Changes

- 9bae275: ## All packages

  - Stricter and more consistent TypeScript types
  - Improved documentation
  - Improved test coverage

  ## `@logosdx/observer`

  - Added `EventPromise` when calling `once` without a callback
  - Added `EventGenerator` when calling `on` without a callback
  - `on('*')` and `emit('*')` now work as expected
  - Regex listeners now emit a `{ event, data }` object instead of just the data
  - Added Emit validators to allow developers to validate the data being emitted
  - Added `$facts()`, `$internals()`, and `$has(event)` meta helpers for debugging
  - Removed `Component` as type and as a first argument when constructing an `ObserverEngine`. Only `observe(component)` is now available.
  - Removed alternative methods for `on`, `once` and etc. The API is now decisively `on`, `once`, `off`, and `emit`.

  ## `@logosdx/fetch`

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

  ## `@logosdx/dom`

  - For consistency, events now match the same API as `@logosdx/observer`.
    - `on`, `once`, `off`, `emit`

  ## `@logosdx/kit`

  - Upgrading to breaking package versions
  - Can now configure multiple API clients by passing the `apis` config, where each key is the API name and the value is the API configuration.

### Patch Changes

- Updated dependencies [9bae275]
  - @logosdx/state-machine@3.0.0-next.0
  - @logosdx/observer@4.0.0-next.0
  - @logosdx/fetch@4.0.0-next.0
  - @logosdx/dom@3.0.0-next.0

## 2.0.10

### Patch Changes

- Updated dependencies [dd1794f]
  - @logosdx/observer@3.0.0
  - @logosdx/utils@2.1.0
  - @logosdx/fetch@3.2.0
  - @logosdx/dom@2.0.7
  - @logosdx/localize@2.0.7
  - @logosdx/state-machine@2.0.7
  - @logosdx/storage@2.0.7

## 2.0.9

### Patch Changes

- Updated dependencies [5ee6904]
  - @logosdx/fetch@3.1.0

## 2.0.8

### Patch Changes

- Updated dependencies [2b64cfa]
  - @logosdx/fetch@3.0.0

## 2.0.7

### Patch Changes

- ca76a50: Bump again
- Updated dependencies [ca76a50]
  - @logosdx/dom@2.0.6
  - @logosdx/fetch@2.0.6
  - @logosdx/localize@2.0.6
  - @logosdx/observer@2.0.6
  - @logosdx/state-machine@2.0.6
  - @logosdx/storage@2.0.6
  - @logosdx/utils@2.0.5

## 2.0.6

### Patch Changes

- 0566a67: Bump all dependencies for cjs / esm build
- Updated dependencies [0566a67]
  - @logosdx/dom@2.0.5
  - @logosdx/fetch@2.0.5
  - @logosdx/localize@2.0.5
  - @logosdx/observer@2.0.5
  - @logosdx/state-machine@2.0.5
  - @logosdx/storage@2.0.5
  - @logosdx/utils@2.0.4

## 2.0.5

### Patch Changes

- 489c5d5: Fix typo on typing from refactor

## 2.0.4

### Patch Changes

- 176ed64: Export better utility typings for Kit
- Updated dependencies [176ed64]
  - @logosdx/utils@2.0.3
  - @logosdx/dom@2.0.4
  - @logosdx/fetch@2.0.4
  - @logosdx/localize@2.0.4
  - @logosdx/observer@2.0.4
  - @logosdx/state-machine@2.0.4
  - @logosdx/storage@2.0.4

## 2.0.3

### Patch Changes

- Updated dependencies [c167f6b]
  - @logosdx/localize@2.0.3
  - @logosdx/utils@2.0.2
  - @logosdx/dom@2.0.3
  - @logosdx/fetch@2.0.3
  - @logosdx/observer@2.0.3
  - @logosdx/state-machine@2.0.3
  - @logosdx/storage@2.0.3

## 2.0.2

### Patch Changes

- c7051bb: Make modules CJS/ESM agnostic
- Updated dependencies [c7051bb]
  - @logosdx/state-machine@2.0.2
  - @logosdx/localize@2.0.2
  - @logosdx/observer@2.0.2
  - @logosdx/storage@2.0.2
  - @logosdx/fetch@2.0.2
  - @logosdx/utils@2.0.1
  - @logosdx/dom@2.0.2

## 2.0.1

### Patch Changes

- 9de5826: Export correctly for esm / cjs
- Updated dependencies [9de5826]
  - @logosdx/state-machine@2.0.1
  - @logosdx/localize@2.0.1
  - @logosdx/observer@2.0.1
  - @logosdx/storage@2.0.1
  - @logosdx/fetch@2.0.1
  - @logosdx/dom@2.0.1

## 2.0.0

### Major Changes

- 847eb42: Build for ESM and CJS. Modules should now work in both.

### Patch Changes

- Updated dependencies [847eb42]
  - @logosdx/state-machine@2.0.0
  - @logosdx/localize@2.0.0
  - @logosdx/observer@2.0.0
  - @logosdx/storage@2.0.0
  - @logosdx/fetch@2.0.0
  - @logosdx/utils@2.0.0
  - @logosdx/dom@2.0.0

## 1.2.0

### Minor Changes

- 14e5699: Fallback when changing to undefined, reacher prioritize keyname.

  - When change to a language that does not exist, lib was throwing undefined errors.
  - It should fallback.
  - - Language object reacher should also prioritize key names over iteration if they exist

### Patch Changes

- Updated dependencies [14e5699]
  - @logosdx/localize@1.3.0

## 1.1.7

### Patch Changes

- 2d7ac0d: **LocaleManager**

  - Fixed need to filter out values that cannot be converted into a string.
  - Added ability to search and replace from nested objects or arrays when passed into replace values.

- Updated dependencies [2d7ac0d]
  - @logosdx/localize@1.2.0

## 1.1.6

### Patch Changes

- Updated dependencies [6f60306]
  - @logosdx/dom@1.3.0

## 1.1.5

### Patch Changes

- Updated dependencies [07dcb99]
  - @logosdx/dom@1.2.0

## 1.1.4

### Patch Changes

- 5ef68a9: Once again...
- Updated dependencies [5ef68a9]
  - @logosdx/utils@1.1.4
  - @logosdx/dom@1.1.4
  - @logosdx/fetch@1.1.4
  - @logosdx/localize@1.1.4
  - @logosdx/observer@1.1.4
  - @logosdx/state-machine@1.1.4
  - @logosdx/storage@1.1.4

## 1.1.3

### Patch Changes

- 432396d: Check against global to detect NodeJS because of build time issues when `process` when not reading as `global.process`
- Updated dependencies [432396d]
  - @logosdx/utils@1.1.3
  - @logosdx/dom@1.1.3
  - @logosdx/fetch@1.1.3
  - @logosdx/localize@1.1.3
  - @logosdx/observer@1.1.3
  - @logosdx/state-machine@1.1.3
  - @logosdx/storage@1.1.3

## 1.1.2

### Patch Changes

- ba8b52d: Properly detect NodeJS so as to work with electron when stubbing window.
- Updated dependencies [ba8b52d]
  - @logosdx/utils@1.1.2
  - @logosdx/dom@1.1.2
  - @logosdx/fetch@1.1.2
  - @logosdx/localize@1.1.2
  - @logosdx/observer@1.1.2
  - @logosdx/state-machine@1.1.2
  - @logosdx/storage@1.1.2

## 1.1.1

### Patch Changes

- e6e4d56: Added a window stub so packages can be used in NodeJS. Now, Observer, Localize, StateMachine, Storage, and whatever non-DOM related utility functions are usefule.
- Updated dependencies [e6e4d56]
  - @logosdx/state-machine@1.1.1
  - @logosdx/localize@1.1.1
  - @logosdx/observer@1.1.1
  - @logosdx/storage@1.1.1
  - @logosdx/fetch@1.1.1
  - @logosdx/utils@1.1.1
  - @logosdx/dom@1.1.1

## 1.1.0

### Minor Changes

- e5d039d: Documentation for all packages is completed and can be found at [https://logosdx.dev](https://logosdx.dev). All packages are tested and ready for use. For bug reports, questions, and suggestions, please use [https://github.com/logosdx/discuss](https://github.com/logosdx/discuss).

### Patch Changes

- Updated dependencies [e5d039d]
  - @logosdx/state-machine@1.1.0
  - @logosdx/localize@1.1.0
  - @logosdx/observer@1.1.0
  - @logosdx/storage@1.1.0
  - @logosdx/fetch@1.1.0
  - @logosdx/utils@1.1.0
  - @logosdx/dom@1.1.0

## 1.0.0

### Major Changes

- 58c0208: Initial commit!

  These packages were made to simplify the development of web applications, and reduce the decisions we make when building apps. You don't always need all the things, but you always need some things. When you apps are simple, they should remain so. When they grow in complexity, they should do so with ease.

  [Discussions can be had here](https://github.com/logosdx/discuss). This will also include a link to the documentation (which is a WIP at the current moment). Domain not included here because it will in the future change. Enjoy using this neat piece of software utility, and do not be afraid to provide feedback; it is welcome!

### Patch Changes

- Updated dependencies [58c0208]
  - @logosdx/state-machine@1.0.0
  - @logosdx/localize@1.0.0
  - @logosdx/observer@1.0.0
  - @logosdx/storage@1.0.0
  - @logosdx/fetch@1.0.0
  - @logosdx/utils@1.0.0
  - @logosdx/dom@1.0.0
