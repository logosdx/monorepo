# @logosdx/utils

## 2.3.0

### Minor Changes

- 6560f02: ## @logosdx/utils

  ### Added

  - `feat(misc):` Add `setDeep()` for setting values deep within nested objects using dot notation paths
  - `feat(misc):` Add `setDeepMany()` for batch setting multiple nested values with fail-fast validation

  ### Changed

  - `refactor(flow-control):` Optimize imports in `retry.ts` - import from specific modules instead of index
  - `refactor(flow-control):` Reorganize export order in index - move foundational exports first
  - `docs(validation):` Fix typo "assertations" → "assertions" in documentation and error messages
  - `refactor(validation):` Add explicit assertion for tuple return format in `assertObject()`

  ### Fixed

  - `fix(priority-queue):` Fix maxHeap option causing infinite recursion by storing original compare function before negation

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

## 2.2.0

### Minor Changes

- 0cf6edd: feat(flow-control): enhance memoization with pluggable adapters and stale-while-revalidate

  ## Memoization System

  ### Added

  - `feat(memo):` Built-in inflight deduplication for async memoization - concurrent calls with identical arguments share the same promise _(closes #78)_
  - `feat(memo):` Stale-while-revalidate pattern with `staleIn` and `staleTimeout` options - return stale data instantly while fetching fresh data in background _(closes #77)_
  - `feat(memo):` Pluggable cache adapters via `CacheAdapter` interface - support for Redis, Memcached, or custom backends
  - `feat(memo):` `MapCacheAdapter` with LRU eviction using sequence tracking for deterministic eviction
  - `feat(memo):` Background cleanup with configurable `cleanupInterval` option
  - `feat(memo):` Enhanced cache statistics with hits, misses, evictions, and hit rate tracking
  - `feat(memo):` Cache management API - `clear()`, `delete()`, `has()`, `size`, `keys()`, `entries()`, `stats()`

  ### Changed

  - `refactor(memo):` Modularize memoization system into dedicated files - `adapter.ts`, `helpers.ts`, `memoize.ts`, `memoizeSync.ts`, `types.ts`
  - `refactor(memo):` Extract cache operations into reusable helper functions - `unwrapValue`, `createCacheItem`, `isExpired`, `isStale`, `evictLRU`
  - `refactor(memo):` Improve type safety with dedicated `CacheItem` and `CacheStats` interfaces

  ### Fixed

  - `fix(memo):` LRU eviction now uses sequence numbers for deterministic eviction when timestamps are identical
  - `docs(memo):` Comprehensive documentation updates with distributed caching examples and SWR pattern usage
  - `docs(memo):` Update llm-helpers/utils.md with memoize vs memoizeSync comparison table

  ## Flow Control

  ### Added

  - `feat(inflight):` Add `withInflightDedup()` utility for concurrent promise deduplication - shares in-flight promises across concurrent calls with identical arguments, with no post-settlement caching
  - `feat(inflight):` Add lifecycle hooks (onStart, onJoin, onResolve, onReject) for observability and monitoring
  - `feat(inflight):` Add custom `keyFn` option for performance-critical hot paths and extracting discriminating fields
  - `feat(compose):` Integrate `withInflightDedup` into `composeFlow` as fifth flow control primitive alongside retry, timeout, rate-limit, and circuit-breaker

  ### Fixed

  - `fix(serializer):` Consistent object key ordering for stable cache keys
  - `fix(serializer):` Proper WeakSet cleanup and circular reference handling
  - `fix(serializer):` Add comprehensive type support - BigInt, Symbol, Error, WeakMap/WeakSet, -0 distinction, NaN, Infinity

  ## Testing

  ### Added

  - `test(memo):` 32 new memoization tests covering inflight dedup, stale-while-revalidate, adapters, and LRU eviction
  - `test(inflight):` 21 new serializer tests for edge cases and type coverage
  - `test(integration):` 5 new integration tests for composeFlow with inflight deduplication

  ## Documentation

  ### Changed

  - `docs(utils):` Update memoization documentation with SWR pattern examples and distributed caching guide
  - `docs(utils):` Add comparison table for `memoize` vs `memoizeSync` capabilities
  - `docs(cursor):` Improve TypeScript patterns documentation with clearer 4-block structure examples

- 0cf6edd: feat(memo): implement stale-while-revalidate pattern for memoization

  - Add `staleIn` option to define when cached data becomes stale
  - Add `staleTimeout` option to control maximum wait time for fresh data
  - Implement stale-while-revalidate behavior: return cached data immediately while fetching fresh data in background
  - Fix caching issues with null/undefined/false return values using Symbol-based timeout detection
  - Fix key generation for functions with no arguments
  - Enhance cache handling to distinguish garbage-collected WeakRefs from legitimate undefined values
  - Update comprehensive documentation across helper files, package docs, and cheat sheet

- 0cf6edd: Enhanced debounce and throttle functions with improved interfaces

  - **debounce**: Added `flush()` method to execute immediately and return result, `cancel()` method to stop pending execution, and `maxWait` option to prevent indefinite hanging
  - **throttle**: Added `cancel()` method to clear throttle state and allow immediate re-execution
  - Both functions now support async operations and maintain proper error handling
  - Breaking change: Return types changed from simple functions to enhanced interfaces with additional methods

## 2.1.2

### Patch Changes

- 9e6afcd: Export EnhancedMemoizedFunction

## 2.1.1

### Patch Changes

- 2c6c8cc: ## Summary

  fix(utils): resolve retry falsy value bug and optimize clone performance

  - Fix critical retry logic bug where falsy return values (null, undefined, false, 0, '')
    triggered unnecessary retries by checking error === null instead of result truthiness
  - Optimize clone function by consolidating Error handlers and introducing useRawHandler
    set for types that don't need circular reference placeholders
  - Leverage native structuredClone API for Error objects when available
  - Add comprehensive test coverage for falsy value retry behavior and Error/Date cloning

  Closes #73

## 2.1.0

### Minor Changes

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

## 2.0.3

### Patch Changes

- cbd0e23: Fix MergeTypes type export

## 2.0.2

### Patch Changes

- eecc5d4: Export type so they aren't compiled into ESM files

## 2.0.1

### Patch Changes

- 43b3457: ### Fixed

  - Export bug from utils.
  - Better naming for options

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

## 1.1.0

### Minor Changes

- 1dcc2d1: ### DOM Package

  #### Add new `behaviors.ts` module for encapsulating DOM behaviors

  **Core Concept:**

  - **Behavior Binding** - Safely attach JavaScript behaviors to DOM elements with duplicate prevention
  - **Event-Driven Architecture** - Uses `prepare:${feature}` events to trigger behavior initialization
  - **Automatic Discovery** - Watches for new DOM elements and auto-binds behaviors via MutationObserver

  **Key Features:**

  **Binding Management:**

  - `isBound()` / `markBound()` - Prevent duplicate behavior attachment using Symbol-based metadata
  - `bindBehavior()` - Safely bind with error handling and duplicate checks

  **Event System:**

  - `registerPrepare()` - Listen for `prepare:${feature}` events to initialize behaviors
  - `dispatchPrepare()` - Trigger behavior initialization for specific features
  - `createBehaviorRegistry()` - Bulk register multiple behaviors with cleanup

  **DOM Observation:**

  - `observePrepare()` - Automatically watch for new elements matching selectors
  - Shared MutationObserver per root for performance with multiple features
  - Built-in debouncing to prevent excessive event firing

  **Lifecycle Management:**

  - `setupLifecycle()` / `teardownFeature()` - Manage behavior cleanup when elements are removed
  - `queryLive()` - Smart element selection that ignores hidden/template elements

  #### Added viewport utilities to `viewport.ts` module

  **Measurement Functions:**

  - `viewportHeight()` - Gets current viewport height, accounting for browser UI elements
  - `devicePixelRatio()` - Returns pixel ratio for high-DPI display support

  **Scroll Progress Tracking:**

  - `scrollProgress()` - Vertical scroll progress as percentage (0-100%)
  - `horizontalScrollProgress()` - Horizontal scroll progress as percentage
  - `isAtBottom()` / `isAtTop()` - Check if page is scrolled to extremes (with configurable thresholds)

  **Element Visibility Detection:**

  - `elementVisibility()` - Returns percentage of element visible in viewport (0-100%)
  - `isPartiallyVisible()` - Checks if element meets minimum visibility threshold
  - `elementViewportDistances()` - Gets distances from element to all viewport edges

  **Smooth Scrolling:**

  - `scrollToElement()` - Smoothly scrolls to an element with optional offset
  - `scrollToPosition()` - Smoothly scrolls to specific x,y coordinates

  ### Other Packages

  - Improved documentation and jsdocs

### Patch Changes

- a84138b: Force release due to bad build

## 1.0.2

### Patch Changes

- 0704421: publish .d.ts files

## 1.0.0

### Major Changes

- b051504: Re-release as LogosDX
