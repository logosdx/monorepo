---
"@logosdx/storage": major
---

## Breaking Changes

### Driver-based async architecture

`StorageAdapter` has been rewritten from the ground up. It no longer extends `EventTarget` and all operations are now `async`. You must provide a `StorageDriver` via the new config object.

**Before:**

    const storage = new StorageAdapter(localStorage, 'app');

**After:**

    const storage = new StorageAdapter({
        driver: new LocalStorageDriver(),
        prefix: 'app',
    });

### All methods are now async

Every read and write operation returns a `Promise`. Synchronous usage no longer works.

### Event system replaced

`StorageEventNames` enum and `StorageEvent` class have been removed. Events now use `@logosdx/observer` with plain string literals and deliver a `StorageEventPayload` object.

| Before | After |
|--------|-------|
| `storage-before-set` | `before-set` |
| `storage-after-set` | `after-set` |
| `storage-before-unset` | `before-remove` |
| `storage-after-unset` | `after-remove` |
| `storage-reset` | `clear` |

`on()` now returns a cleanup function.

### `wrap()` renamed to `scope()`

**Before:**

    const theme = storage.wrap('theme');

**After:**

    const theme = storage.scope('theme');

## Added

* `feat(storage):` `FileSystemDriver` — JSON file persistence for Node.js
* `feat(storage):` `IndexedDBDriver` — structured browser storage via IndexedDB
* `feat(storage):` `WebStorageDriver` base class with `LocalStorageDriver` and `SessionStorageDriver` subclasses
* `feat(storage):` `structured` config option — disables JSON serialization for drivers that natively handle objects
* `feat(storage):` `scope(key)` — scoped accessor replacing `wrap()`
