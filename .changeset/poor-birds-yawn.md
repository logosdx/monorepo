---
"@logosdx/utils": minor
---

## @logosdx/utils


### Added

* `feat(misc):` Add `setDeep()` for setting values deep within nested objects using dot notation paths
* `feat(misc):` Add `setDeepMany()` for batch setting multiple nested values with fail-fast validation

### Changed

* `refactor(flow-control):` Optimize imports in `retry.ts` - import from specific modules instead of index
* `refactor(flow-control):` Reorganize export order in index - move foundational exports first
* `docs(validation):` Fix typo "assertations" → "assertions" in documentation and error messages
* `refactor(validation):` Add explicit assertion for tuple return format in `assertObject()`

### Fixed

* `fix(priority-queue):` Fix maxHeap option causing infinite recursion by storing original compare function before negation
