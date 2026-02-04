---
"@logosdx/observer": patch
---

### Fixed

- **EventGenerator buffering**: Fixed a race condition where events emitted faster than the async iterator could consume them were silently dropped. Replaced single Deferred pattern with a PriorityQueue buffer, ensuring no events are lost under burst conditions. All existing consumer code continues to work unchanged.
