---
type: Domain
---

# react

## What it does

`@logosdx/react` provides React context factories and hooks for all other @logosdx packages. It exposes `createObserverContext`, `createFetchContext`, `createStorageContext`, `createLocalizeContext`, `createStateMachineContext`, and a data-fetching API layer (`useQuery`, `useMutation`, `useAsync`, `createApiHooks`).

## Artifacts

- [`skills/logosdx/references/react.md`](../../skills/logosdx/references/react.md) — skill reference (309 LOC) covering factories, hooks, provider composition, API hooks

## CLI code

- [`packages/react/src/observer.ts`](../../packages/react/src/observer.ts) — `createObserverContext` (165 LOC)
- [`packages/react/src/fetch.ts`](../../packages/react/src/fetch.ts) — `createFetchContext` (297 LOC)
- [`packages/react/src/storage.ts`](../../packages/react/src/storage.ts) — `createStorageContext` (123 LOC)
- [`packages/react/src/localize.ts`](../../packages/react/src/localize.ts) — `createLocalizeContext` (102 LOC)
- [`packages/react/src/state-machine.ts`](../../packages/react/src/state-machine.ts) — `createStateMachineContext`, `useStateMachine` (127 LOC)
- [`packages/react/src/api/`](../../packages/react/src/api) — `useQuery`, `useMutation`, `useAsync`, `createQuery`, `createMutation`, `createApiHooks` (8 files)
- [`packages/react/src/utils/compose.ts`](../../packages/react/src/utils/compose.ts) — `composeProviders` utility
- [`packages/react/src/types.ts`](../../packages/react/src/types.ts) — shared type exports (91 LOC)
- [`packages/react/src/index.ts`](../../packages/react/src/index.ts) — barrel exports

## Docs

- [`docs/packages/react.md`](../packages/react.md) — combined React bindings reference (790 LOC)

## Coupling

- Has optional peer dependencies on `@logosdx/observer`, `@logosdx/fetch`, `@logosdx/storage`, `@logosdx/localize`, `@logosdx/state-machine`.
- Depends on `@logosdx/utils` as a hard dependency.
- React itself is a peer dependency (not bundled).
- Tests in [`tests/src/react/`](../../tests/src/react) cover compose, fetch integration, fetch renders, fetch, localize, observer, state-machine, storage (10 files).
- [`tests/src/smoke/`](../../tests/src/smoke) does not include a react smoke test (react tests use jsdom only).

## Conventions worth knowing

- `composeProviders` composes multiple context providers into a single wrapper component, avoiding deep nesting.
- Each `create*Context` factory returns both a `Provider` component and `use*` hook specific to the engine instance.
- `createApiHooks` generates typed query/mutation hooks bound to a specific `FetchEngine` instance.
- All hooks must be called at the component top level per React rules.
