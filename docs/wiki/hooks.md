---
type: Domain
---

# hooks

## What it does

`@logosdx/hooks` provides a lifecycle hook engine with middleware-style pipeline execution, priority chains, async/sync hooks, context passing, and a `ctx.fail()` mechanism that emits typed `HookError` instances.

## Artifacts

- [`skills/logosdx/references/hooks.md`](../../skills/logosdx/references/hooks.md) — skill reference (326 LOC) covering lifecycle hooks, middleware, plugins, priority chains

## CLI code

- [`packages/hooks/src/index.ts`](../../packages/hooks/src/index.ts) — all hook engine implementation in a single file (1252 LOC, 36k chars); exports `HookError`, `isHookError`, and the `HookEngine` class
- [`packages/hooks/notes.md`](../../packages/hooks/notes.md) — internal design notes (700 LOC)

## Docs

- [`docs/packages/hooks.md`](../packages/hooks.md) — combined hooks reference (523 LOC)

## Coupling

- Depends on `@logosdx/utils` for `attempt`, `attemptSync`, `assert`, `isFunction`, `isObject`, and `FunctionProps`.
- No dependency on `@logosdx/observer`.
- Tests in [`tests/src/hooks.ts`](../../tests/src/hooks.ts) (1462 LOC, 43k chars).
- [`tests/src/smoke/hooks.test.ts`](../../tests/src/smoke/hooks.test.ts) runs browser smoke tests.

## Conventions worth knowing

- `HookEngine` runs hooks in priority order; lower numeric priority runs first.
- `ctx.fail(message)` within a hook handler halts the pipeline and throws `HookError` (or a custom error type if `handleFail` is overridden).
- `isHookError(err)` type guard identifies hook pipeline failures.
- The entire implementation lives in one 1252-line file rather than being split across modules.
