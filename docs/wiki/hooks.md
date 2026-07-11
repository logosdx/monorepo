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
- `@logosdx/fetch` is the largest in-repo consumer: `FetchEngine` composes a `HookEngine<FetchLifecycle>` ([`packages/fetch/src/engine/index.ts`](../../packages/fetch/src/engine/index.ts)) and runs every request through a three-phase pipeline — `hooks.run('beforeRequest')` → `hooks.pipe('execute')` → `hooks.run('afterRequest')` ([`packages/fetch/src/engine/executor.ts`](../../packages/fetch/src/engine/executor.ts)). Every fetch policy plugin (retry, dedupe, cache, rate-limit, cookies) is a hook installation whose `install()` returns the hook cleanup; a `HookScope` carries per-request state between phases (e.g. the cache key set in `beforeRequest` and read in `afterRequest`). A behavior change to `run`/`pipe`/`HookScope` semantics is a behavior change to the entire fetch pipeline.
- Tests in [`tests/src/hooks.ts`](../../tests/src/hooks.ts) (1462 LOC, 43k chars).
- [`tests/src/smoke/hooks.test.ts`](../../tests/src/smoke/hooks.test.ts) runs browser smoke tests.

## Conventions worth knowing

- `HookEngine` runs hooks in priority order; lower numeric priority runs first. Fetch's built-in policies install at negative priorities so user hooks registered at the default priority run after them.
- `run` executes a hook chain where a hook may modify args or short-circuit with a result; `pipe` onion-wraps a core function middleware-style (in fetch: retry wraps dedupe wraps the network call).
- `ctx.fail(message)` within a hook handler halts the pipeline and throws `HookError` (or a custom error type if `handleFail` is overridden).
- `isHookError(err)` type guard identifies hook pipeline failures.
- The entire implementation lives in one 1252-line file rather than being split across modules.
