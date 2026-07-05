---
type: Domain
---

# state-machine

## What it does

`@logosdx/state-machine` provides reducer-based finite state machines with state history (time travel), async invoke support, guards, parent-child relationships, and bidirectional synchronization via `StateHub`.

## Artifacts

- [`skills/logosdx/references/state-machine.md`](../../skills/logosdx/references/state-machine.md) — skill reference covering FSM, guards, async invoke, StateHub coordination

## CLI code

- [`packages/state-machine/src/machine.ts`](../../packages/state-machine/src/machine.ts) — `StateMachine` class (381 LOC); reducer-based FSM with history
- [`packages/state-machine/src/hub.ts`](../../packages/state-machine/src/hub.ts) — `StateHub` class (59 LOC); coordinates multiple machines
- [`packages/state-machine/src/types.ts`](../../packages/state-machine/src/types.ts) — type definitions (146 LOC)
- [`packages/state-machine/src/index.ts`](../../packages/state-machine/src/index.ts) — barrel exports

## Docs

- [`docs/packages/state-machine/index.md`](../packages/state-machine/index.md) — overview
- [`docs/packages/state-machine/api.md`](../packages/state-machine/api.md) — API reference (529 LOC)
- [`docs/packages/state-machine/guide.md`](../packages/state-machine/guide.md) — usage guide (515 LOC, 18k+ chars)

## Coupling

- Depends on `@logosdx/utils` for flow control helpers and error tuples.
- Follows observer-like event emission pattern (state change events) but does not import `@logosdx/observer`.
- `@logosdx/react` wraps `StateMachine` via `createStateMachineContext` and `useStateMachine` in [`packages/react/src/state-machine.ts`](../../packages/react/src/state-machine.ts).
- Tests in [`tests/src/state-machine.ts`](../../tests/src/state-machine.ts) (1499 LOC, 46k+ chars).
- [`tests/src/smoke/state-machine.test.ts`](../../tests/src/smoke/state-machine.test.ts) runs browser smoke tests.

## Conventions worth knowing

- `StateMachine` is stream-based: state updates emit events that consumers subscribe to.
- `StateHub` enables parent-child coordination and bidirectional sync between machines.
- Time-travel debugging is built in via stored state history.
