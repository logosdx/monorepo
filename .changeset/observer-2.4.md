---
"@logosdx/observer": minor
---

## Added

* `feat(observer):` `ObserverEngine.transfer()` static method to move listeners between observer instances
* `feat(observer):` `ObserverEngine.copy()` static method to duplicate listeners across observer instances
* `feat(observer):` `TransferOptions` type with `filter` and `exclude` for selective listener transfer

## Fixed

* `fix(generator):` Fixed race condition where events emitted faster than async iterator consumption were silently dropped — replaced single Deferred with PriorityQueue buffer
* `fix(generator):` Reject pending promises on `EventGenerator` cancellation instead of resolving with last value — now rejects with `EventError('Aborted')`
