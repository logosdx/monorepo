---
"@logosdx/observer": patch
---

## Fixed

* `fix(generator):` Reject pending promises on EventGenerator cancellation instead of resolving with last value

  Previously, calling `.cleanup()` or aborting via `AbortSignal` would resolve pending `.next()` promises with the last known value, making cancellation indistinguishable from a real event. Now rejects with `EventError('Aborted')`, matching the pattern used by `once()` promise abort handling.
