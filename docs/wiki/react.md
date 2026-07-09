---
type: Domain
description: React context factories and hooks for @logosdx packages, including a discriminated failure-union data-fetching API.
---

# react

## What it does

`@logosdx/react` provides React context factories and hooks for all other @logosdx packages. It exposes `createObserverContext`, `createFetchContext`, `createStorageContext`, `createLocalizeContext`, `createStateMachineContext`, and a data-fetching API layer (`useQuery`, `useMutation`, `useAsync`, `createApiHooks`).

## Artifacts

- [`skills/logosdx/references/react.md`](../../skills/logosdx/references/react.md) — skill reference (371 LOC) covering factories, hooks, provider composition, API hooks, and the failure-union contract

## CLI code

- [`packages/react/src/observer.ts`](../../packages/react/src/observer.ts) — `createObserverContext` (165 LOC)
- [`packages/react/src/fetch.ts`](../../packages/react/src/fetch.ts) — `createFetchContext` (327 LOC)
- [`packages/react/src/storage.ts`](../../packages/react/src/storage.ts) — `createStorageContext` (123 LOC)
- [`packages/react/src/localize.ts`](../../packages/react/src/localize.ts) — `createLocalizeContext` (102 LOC)
- [`packages/react/src/state-machine.ts`](../../packages/react/src/state-machine.ts) — `createStateMachineContext`, `useStateMachine` (127 LOC)
- [`packages/react/src/api/`](../../packages/react/src/api) — `useQuery`, `useMutation`, `useAsync`, `createQuery`, `createMutation`, `createApiHooks` (8 files)
- [`packages/react/src/utils/compose.ts`](../../packages/react/src/utils/compose.ts) — `composeProviders` utility
- [`packages/react/src/types.ts`](../../packages/react/src/types.ts) — shared type exports, including the `FetchFailure` discriminated union (111 LOC)
- [`packages/react/src/index.ts`](../../packages/react/src/index.ts) — barrel exports

## Docs

- [`docs/packages/react.md`](../packages/react.md) — combined React bindings reference (829 LOC)

## Coupling

- Has optional peer dependencies on `@logosdx/observer`, `@logosdx/fetch`, `@logosdx/storage`, `@logosdx/localize`, `@logosdx/state-machine`.
- Depends on `@logosdx/utils` as a hard dependency.
- React itself is a peer dependency (not bundled).
- `createFetchContext`, `useQuery`, and `useMutation` mirror `@logosdx/fetch`'s `FetchResponse`/`FetchError` split — a change to `FetchResponse` in [`packages/fetch/src/types.ts`](../../packages/fetch/src/types.ts) or to the `FetchError` class in [`packages/fetch/src/helpers/fetch-error.ts`](../../packages/fetch/src/helpers/fetch-error.ts) forces a matching change to `FetchFailure` in [`packages/react/src/types.ts`](../../packages/react/src/types.ts).
- Tests in [`tests/src/react/`](../../tests/src/react) cover compose, fetch integration, fetch renders, fetch, localize, observer, state-machine, storage (8 top-level files) plus [`tests/src/react/api/`](../../tests/src/react/api) covering `createApiHooks`, factories, features, `useAsync`, `useMutation`, `useQuery` (6 files) — 14 test files total.
- [`tests/src/smoke/`](../../tests/src/smoke) does not include a react smoke test (react tests use jsdom only).

## Conventions worth knowing

- `composeProviders` composes multiple context providers into a single wrapper component, avoiding deep nesting.
- Each `create*Context` factory returns both a `Provider` component and `use*` hook specific to the engine instance.
- `createApiHooks` generates typed query/mutation hooks bound to a specific `FetchEngine` instance.
- All hooks must be called at the component top level per React rules.
- `useQuery`, `useMutation`, and `createFetchContext` expose one `failure: FetchFailure<T> | null` field instead of separate `error`/`response` state. `kind: 'transport'` (no response exists — abort, timeout, connection lost) carries `error: FetchError`; `kind: 'http'` (server answered outside 2xx) carries `response`, the resolved `ok: false` `FetchResponse`. `FetchFailure` is defined in [`packages/react/src/types.ts`](../../packages/react/src/types.ts).
- `useMutation.mutate()` and `createFetchContext`'s mutation `mutate()` never reject — they resolve `Promise<T | undefined>`, `undefined` on any failure (transport or HTTP); callers read `failure` for why.
- `useAsync` wraps an arbitrary async function, so unlike `FetchFailure` it can't promise a `FetchError` on rejection — its `AsyncFailure` union (in [`packages/react/src/api/types.ts`](../../packages/react/src/api/types.ts)) sets `{ kind: 'rejected'; error: unknown }` for any promise rejection with no runtime check on `error`'s type, or `{ kind: 'http'; response: ResponseLike }` when the *resolved* value structurally looks like a non-2xx response — checked via `ResponseLike` (`{ ok, status, data, request }`), without importing `@logosdx/fetch`.
