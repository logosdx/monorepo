# @logosdx/fetch

## 2.0.0

### Major Changes

- fdec519: ## Breaking Changes to Retry Configuration

  ### Simplified `retryConfig` API

  - **`retryConfig` can now be set to `false`** to disable retries entirely (previously required `maxAttempts: 0`)
  - **`baseDelay` is now only a `number`** - removed function signature `(error: FetchError, attempt: number) => number`
    - Custom delay logic should now be handled through the `shouldRetry` function
    - `baseDelay` is used for exponential backoff calculations when `shouldRetry` returns `true`

  ### Enhanced `shouldRetry` Behavior

  The `shouldRetry` function now has full control over retry delays:

  - Return `true` to retry with default exponential backoff (using `baseDelay`)
  - Return `false` to stop retrying
  - Return a `number` (milliseconds) to specify an exact delay, overriding exponential backoff

  ### Migration Guide

  **Before:**

  ```typescript
  // Disable retries
  new FetchEngine({
    retryConfig: { maxAttempts: 0 },
  });

  // Custom delay function
  new FetchEngine({
    retryConfig: {
      baseDelay: (error, attempt) => attempt * 1000,
    },
  });
  ```

  **After:**

  ```typescript
  // Disable retries
  new FetchEngine({
    retryConfig: false,
  });

  // Custom delay through shouldRetry
  new FetchEngine({
    retryConfig: {
      baseDelay: 1000,
      shouldRetry: (error, attempt) => attempt * 1000,
    },
  });
  ```

## 1.2.0

### Minor Changes

- cd91503: feat(fetch): add global instance and dynamic request modifiers

  - Add default global fetch instance for simplified usage without creating custom instances
  - Export individual methods (get, post, put, etc.) for convenient destructuring
  - Add smart URL handling - absolute URLs now bypass base URL configuration
  - Add `changeModifyOptions()` method to dynamically update global request modifiers at runtime
  - Add `changeModifyMethodOptions()` method to set method-specific modifiers dynamically
  - Add new events: `fetch-modify-options-change` and `fetch-modify-method-options-change`
  - Change default state type from `{}` to `FetchEngine.InstanceState` for better TypeScript support
  - Global instance automatically uses current domain as base URL (or fallback to logosdx.dev)

## 1.1.5

### Patch Changes

- Updated dependencies [2c6c8cc]
  - @logosdx/utils@2.1.1

## 1.1.4

### Patch Changes

- 755e80d: ## Flow Control Utilities and Engine Improvements

  ### Added Flow Control Utilities

  - **runInSeries/makeInSeries**: Execute functions sequentially
  - **nextLoop**: Promise that resolves after next event loop
  - **nTimes**: Utility to repeat operations N times
  - **setImmediate polyfill**: Cross-platform immediate execution

  ### Batch Processing Enhancement

  - Added `nextLoop()` call in batch processing to prevent blocking
  - Improves performance for large batch operations

  ### Fetch Engine Improvements

  - Fixed status code handling in error parsing (status fallback)
  - Fixed `addEventListener` now returns cleanup function for better resource management

- Updated dependencies [755e80d]
  - @logosdx/utils@2.1.0

## 1.1.3

### Patch Changes

- Updated dependencies [cbd0e23]
  - @logosdx/utils@2.0.3

## 1.1.2

### Patch Changes

- eecc5d4: Export type so they aren't compiled into ESM files
- Updated dependencies [eecc5d4]
  - @logosdx/utils@2.0.2

## 1.1.1

### Patch Changes

- 43b3457: ### Fixed

  - Export bug from utils.
  - Better naming for options

- Updated dependencies [43b3457]
  - @logosdx/utils@2.0.1

## 1.1.0

### Minor Changes

- 68b2d8b: ## Major Release: Unified Queue System, API Simplification, and Reliability Improvements

  - **New Feature: Queue System**
    Introduced a modular, observable queue system with priority queue support, improved rate limiting (token-based), and enhanced lifecycle management. Queue logic is now organized for clarity and extensibility.

  - **API Simplification & Consistency**
    Core data utilities have been renamed for clarity (`deepClone` → `clone`, `deepEqual` → `equals`, `deepMerge`/`applyDefaults` → `merge`). Type and pattern consistency improved across all packages.

  - **Breaking Changes**

    - `destroy` methods are now `cleanup` throughout the codebase.
    - Wildcard event listeners (`*`) replaced with regex pattern support.
    - Utility function renames require import updates.

  - **Reliability & Developer Experience**
    - Expanded test coverage for new queue and priority queue features.
    - Improved error handling and type safety.
    - Enhanced documentation with real-world examples.
    - Performance optimizations for queue operations.

  **Migration:**
  Update imports to use new utility names and replace any `destroy()` calls with `cleanup()`. Update event listeners to use regex patterns instead of wildcards (`*`).

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
