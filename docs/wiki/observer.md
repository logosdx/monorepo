---
type: Domain
---

# observer

## What it does

`@logosdx/observer` is the event system layer. It provides typed event emission and subscription with regex pattern matching, async generators over event streams, priority-based queues with concurrency and rate-limiting, and relay bridges between observer instances.

## Artifacts

- [`skills/logosdx/references/observer.md`](../../skills/logosdx/references/observer.md) — skill reference for typed events, async generators, queues, observation, relay

## CLI code

- [`packages/observer/src/engine.ts`](../../packages/observer/src/engine.ts) — `ObserverEngine` class (1138 LOC); core event bus with regex matching
- [`packages/observer/src/generator.ts`](../../packages/observer/src/generator.ts) — `EventGenerator`, `DeferredEvent`; async iteration over events
- [`packages/observer/src/relay.ts`](../../packages/observer/src/relay.ts) — `ObserverRelay`; bridges two observer instances
- [`packages/observer/src/helpers.ts`](../../packages/observer/src/helpers.ts) — `makeEventTracer`, `EventError`, `EventPromise`, `isEventError`
- [`packages/observer/src/queue/`](../../packages/observer/src/queue) — `EventQueue`, `InternalQueueEvent`; priority queue with concurrency, rate-limiting
- [`packages/observer/src/types.ts`](../../packages/observer/src/types.ts) — `Events` type
- [`packages/observer/src/index.ts`](../../packages/observer/src/index.ts) — barrel exports

## Docs

- [`docs/packages/observer/index.md`](../packages/observer/index.md) — overview
- [`docs/packages/observer/advanced.md`](../packages/observer/advanced.md) — advanced patterns
- [`docs/packages/observer/events.md`](../packages/observer/events.md) — event system reference
- [`docs/packages/observer/generators.md`](../packages/observer/generators.md) — async generator usage
- [`docs/packages/observer/queues.md`](../packages/observer/queues.md) — queue configuration and usage
- [`docs/packages/observer/relay.md`](../packages/observer/relay.md) — relay bridge docs

## Coupling

- Depends on `@logosdx/utils` (imports `PriorityQueue`, flow control helpers).
- `@logosdx/fetch` uses observer event emission for lifecycle hooks (`request.success`, etc.).
- `@logosdx/storage` emits change events through its own internal mechanism, documented as following observer-like patterns.
- `@logosdx/state-machine` emits state change events following observer-like patterns.
- `@logosdx/react` wraps `ObserverEngine` via `createObserverContext` in [`packages/react/src/observer.ts`](../../packages/react/src/observer.ts).
- Tests live in [`tests/src/observable/`](../../tests/src/observable) (engine, queue, relay).

## Conventions worth knowing

- Event names support regex patterns; `observer.on('user\\..*', handler)` matches any `user.*` event.
- `ObserverEngine` subscriptions return an unsubscribe function — callers must store and call it on cleanup.
- `EventQueue` supports `priority`, concurrency limits, and rate-limiting configuration.
