---
"@logosdx/observer": patch
"@logosdx/utils": patch
---

Fix memory leaks in observer and flow control utilities

## Utils

### Fixed

* `fix(flow-control/misc)`: Prevent timeout reference retention in wait() by nulling after completion
* `fix(flow-control/memo)`: Clear losing timeout promise in stale-while-revalidate race condition
* `refactor(flow-control/memo)`: Restructure control flow with early returns for better readability

### Changed

* `perf(flow-control/misc)`: Add guard check to wait().clear() for safer timeout cleanup

---

## Observer

### Fixed

* `fix(engine)`: Eliminate circular reference in once() runOnce closure preventing garbage collection
* `fix(engine)`: Remove empty Sets from listener Maps to prevent memory bloat

### Changed

* `refactor(engine)`: Move #eventInfo call after early return check for better performance
