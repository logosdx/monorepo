---
"@logosdx/dom": major
"@logosdx/observer": major
"@logosdx/utils": major
"@logosdx/fetch": minor
---

## Major Release: Unified Queue System, API Simplification, and Reliability Improvements

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
