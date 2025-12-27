---
"@logosdx/observer": minor
---

### Added

* `feat(queue):` Export `InternalQueueEvent` class for detecting queue-emitted events. Regex listeners can use `instanceof InternalQueueEvent` to identify and skip queue internal events.

### Fixed

* `fix(queue):` Prevent infinite recursion when using broad regex patterns (`/./`, `/.+/`, `/.*/`) as queue event listeners. Queue now wraps internal event payloads in `InternalQueueEvent` to distinguish them from user events.

### Changed

* `refactor(queue):` Queue `.on()` and `.once()` listener callbacks now receive `InternalQueueEvent<T>` wrapper. Access payload via `.data` property.
