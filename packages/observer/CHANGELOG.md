# @logosdx/observer

## 2.1.1

### Patch Changes

- Updated dependencies [582644e]
- Updated dependencies [e4e4f43]
  - @logosdx/utils@5.0.0

## 2.1.0

### Minor Changes

- 931a1e5: feat(observer): add AbortSignal support for automatic listener cleanup

  Adds `signal` option to `ObserverEngine`, `on()`, `once()`, and `observe()` for automatic cleanup when signals abort.

  ```ts
  const controller = new AbortController();

  // Instance-level: clears all listeners when aborted
  const observer = new ObserverEngine({ signal: controller.signal });

  // Per-listener: removes specific listener when aborted
  observer.on("event", handler, { signal: controller.signal });

  // Promise-based: rejects with AbortError when aborted
  const data = await observer.once("event", { signal: controller.signal });

  // Observed components: cleanup when aborted
  observer.observe(component, { signal: controller.signal });
  ```

  Also fixes missing `clear` method in `ObserverEngine.Child` type definition.

### Patch Changes

- Updated dependencies [567ed1f]
- Updated dependencies [204dd76]
  - @logosdx/utils@4.0.0

## 2.0.13

### Patch Changes

- Updated dependencies [e6b07d8]
  - @logosdx/utils@3.0.1

## 2.0.12

### Patch Changes

- Updated dependencies [96fe247]
  - @logosdx/utils@3.0.0

## 2.0.11

### Patch Changes

- Updated dependencies [6416ac4]
  - @logosdx/utils@2.5.0

## 2.0.10

### Patch Changes

- Updated dependencies [8fda604]
  - @logosdx/utils@2.4.0

## 2.0.9

### Patch Changes

- 9edb1c4: Fix memory leaks in observer and flow control utilities

  ## Utils

  ### Fixed

  - `fix(flow-control/misc)`: Prevent timeout reference retention in wait() by nulling after completion
  - `fix(flow-control/memo)`: Clear losing timeout promise in stale-while-revalidate race condition
  - `refactor(flow-control/memo)`: Restructure control flow with early returns for better readability

  ### Changed

  - `perf(flow-control/misc)`: Add guard check to wait().clear() for safer timeout cleanup

  ***

  ## Observer

  ### Fixed

  - `fix(engine)`: Eliminate circular reference in once() runOnce closure preventing garbage collection
  - `fix(engine)`: Remove empty Sets from listener Maps to prevent memory bloat

  ### Changed

  - `refactor(engine)`: Move #eventInfo call after early return check for better performance

- Updated dependencies [9edb1c4]
- Updated dependencies [6560f02]
  - @logosdx/utils@2.3.0

## 2.0.8

### Patch Changes

- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
- Updated dependencies [0cf6edd]
  - @logosdx/utils@2.2.0

## 2.0.7

### Patch Changes

- Updated dependencies [9e6afcd]
  - @logosdx/utils@2.1.2

## 2.0.6

### Patch Changes

- c6a8fd2: Expose the ability to overwrite the spy function

## 2.0.5

### Patch Changes

- Updated dependencies [2c6c8cc]
  - @logosdx/utils@2.1.1

## 2.0.4

### Patch Changes

- Updated dependencies [755e80d]
  - @logosdx/utils@2.1.0

## 2.0.3

### Patch Changes

- Updated dependencies [cbd0e23]
  - @logosdx/utils@2.0.3

## 2.0.2

### Patch Changes

- eecc5d4: Export type so they aren't compiled into ESM files
- Updated dependencies [eecc5d4]
  - @logosdx/utils@2.0.2

## 2.0.1

### Patch Changes

- 43b3457: ### Fixed

  - Export bug from utils.
  - Better naming for options

- Updated dependencies [43b3457]
  - @logosdx/utils@2.0.1

## 2.0.0

### Major Changes

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
