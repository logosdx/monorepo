---
type: Domain
---

# storage

## What it does

`@logosdx/storage` provides a type-safe, event-driven persistence layer wrapping browser storage (localStorage/sessionStorage) and custom drivers. It supports generic typing for storage schemas, prefixed key management, object merging, and change event notifications.

## Artifacts

- [`skills/logosdx/references/storage.md`](../../skills/logosdx/references/storage.md) — skill reference covering CRUD, key scoping, events, custom drivers

## CLI code

- [`packages/storage/src/adapter.ts`](../../packages/storage/src/adapter.ts) — `StorageAdapter` class (287 LOC); main persistence abstraction
- [`packages/storage/src/drivers/`](../../packages/storage/src/drivers) — driver implementations (4 files): localStorage, sessionStorage, custom driver support
- [`packages/storage/src/events.ts`](../../packages/storage/src/events.ts) — event type definitions (9 LOC)
- [`packages/storage/src/types.ts`](../../packages/storage/src/types.ts) — type definitions (33 LOC)
- [`packages/storage/src/index.ts`](../../packages/storage/src/index.ts) — barrel exports

## Docs

- [`docs/packages/storage/index.md`](../packages/storage/index.md) — overview
- [`docs/packages/storage/api.md`](../packages/storage/api.md) — API reference
- [`docs/packages/storage/drivers.md`](../packages/storage/drivers.md) — driver documentation
- [`docs/packages/storage/events.md`](../packages/storage/events.md) — change event reference

## Coupling

- Depends on `@logosdx/utils` for validation and flow control helpers.
- Emits change events; pattern follows `@logosdx/observer` conventions but does not import observer.
- `@logosdx/react` wraps `StorageAdapter` via `createStorageContext` in [`packages/react/src/storage.ts`](../../packages/react/src/storage.ts).
- Tests in [`tests/src/storage/`](../../tests/src/storage) cover adapter, drivers, and types.
- [`tests/src/smoke/storage.test.ts`](../../tests/src/smoke/storage.test.ts) runs browser smoke tests.

## Conventions worth knowing

- `StorageAdapter` is generic over the shape of stored data — keys and value types are fully typed.
- Prefixed key management prevents collisions when multiple adapter instances share the same storage backend.
- Object assignment and merging are supported natively without manual `JSON.parse`/`JSON.stringify`.
