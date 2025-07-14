# @logosdx/dom

## 2.0.4

### Patch Changes

- 1b815f4: Fix types for appendIn, appendAfter, and appendBefore

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

## 1.1.1

### Patch Changes

- f3b9c47: Remove global since it doesn't compile in newer vite versions

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
