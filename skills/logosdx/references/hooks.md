---
description: Usage patterns for the @logosdx/hooks package.
globs: '*.ts'
---

# @logosdx/hooks - LLM Helper

> **Error handling rule:** Use `attempt()`/`attemptSync()` from `@logosdx/utils` for ALL error-prone operations in hook callbacks, pipe functions, and any I/O. Never use try-catch.

A lightweight, type-safe lifecycle hook system for extending behavior without modifying code.


## Core Concept

Lifecycle hooks let you respond to named events with bidirectional communication. Unlike traditional events (fire-and-forget), hooks support arg modification, short-circuiting, and result injection via `HookContext`.

Distinct verbs from Observer: `add`/`run` (hooks) vs `on`/`emit` (observer).


## API Overview

```typescript
import { HookEngine, HookScope, HookError, isHookError } from '@logosdx/hooks';

interface Lifecycle {
    beforeFetch(url: string, options: RequestInit): Promise<Response>;
    afterFetch(result: Response, url: string): Promise<Response>;
}

const hooks = new HookEngine<Lifecycle>()
    .register('beforeFetch', 'afterFetch');

// Subscribe — callbacks receive spread args + ctx as last param
const cleanup = hooks.add('beforeFetch', (url, options, ctx) => {
    ctx.args(url, { ...options, cache: 'no-store' });
});

// Run
const result = await hooks.run('beforeFetch', url, options);
// result.args, result.result, result.returned, result.scope

// Wrap function with pre/post hooks
const wrapped = hooks.wrap(fn, { pre: 'beforeFetch', post: 'afterFetch' });

// Clear all
hooks.clear();

// Remove subscription
cleanup();
```


## HookEngine Methods

| Method | Description |
|--------|-------------|
| `register(...names)` | Register hooks for runtime validation. Returns `this`. |
| `add(name, callback, options?)` | Subscribe to hook. Returns cleanup function. |
| `run(name, ...args)` | Run hook async. Returns `Promise<RunResult>`. |
| `runSync(name, ...args)` | Run hook sync. Returns `RunResult`. |
| `pipe(name, coreFn, ...args)` | Pipe hook async (onion middleware). Returns `Promise<result>`. |
| `pipeSync(name, coreFn, ...args)` | Pipe hook sync. Returns result. |
| `wrap(fn, { pre?, post? })` | Wrap async function with pre/post hooks. |
| `wrapSync(fn, { pre?, post? })` | Wrap sync function with pre/post hooks. |
| `clear()` | Remove all hooks, reset to permissive mode. |


## HookContext Methods

Passed as the last argument to every callback:

| Method | Returns | Effect |
|--------|---------|--------|
| `ctx.args(...newArgs)` | `EarlyReturnSignal` | Replace args for downstream callbacks |
| `return ctx.args(...)` | — | Replace args **and** stop the chain |
| `ctx.returns(value)` | `EarlyReturnSignal` | Set result and stop (always use with `return`) |
| `ctx.fail(...args)` | `never` | Abort with error |
| `ctx.removeHook()` | `void` | Remove this callback from future runs |
| `ctx.scope` | `HookScope` | Request-scoped state bag |

**Short-circuit rules:**

| Code | Args changed | Chain stops |
|------|-------------|-------------|
| `ctx.args(...)` | yes | no |
| `return ctx.args(...)` | yes | yes |
| `return ctx.returns(value)` | n/a | yes |
| `ctx.fail(...)` | n/a | throws |


## RunResult

```typescript
interface RunResult<F> {
    args: Parameters<F>;      // Final args (possibly modified)
    result?: ReturnType<F>;   // Result if set via ctx.returns()
    returned: boolean;        // Whether chain was short-circuited
    scope: HookScope;         // Scope used during this run
}
```


## AddOptions

```typescript
hooks.add('name', callback, {
    once: true,           // Remove after first run (sugar for times: 1)
    times: 3,             // Run N times then auto-remove
    ignoreOnFail: true,   // Continue if callback throws
    priority: -10         // Lower runs first, default 0
});
```


## RunOptions

```typescript
await hooks.run('beforeRequest', url, opts, {
    append: (url, opts, ctx) => { /* ephemeral, runs last */ },
    scope: existingScope   // Share state across runs/engines
});
```


## pipe() — Middleware Composition

Onion/middleware pattern where each callback wraps the next. Used for cross-cutting concerns like retry, dedupe, caching execution.

```typescript
// Core function is the innermost call
const result = await hooks.pipe('execute',
    async (opts) => {
        const [res, err] = await attempt(() => fetch(opts.url, opts));
        if (err) throw err;
        return res;
    },
    opts
);

// Callbacks: (next, ...args, ctx) — call next() to proceed
hooks.add('execute', async (next, opts, ctx) => {
    const start = Date.now();
    const result = await next();
    console.log(`Took ${Date.now() - start}ms`);
    return result;
}, { priority: -10 });
```

**PipeContext** — simpler than HookContext:

| Method | Effect |
|--------|--------|
| `ctx.args(...newArgs)` | Replace args for downstream callbacks |
| `ctx.fail(...args)` | Abort with error |
| `ctx.removeHook()` | Remove this callback from future runs |
| `ctx.scope` | Request-scoped state bag |

Note: No `ctx.returns()` in pipe — return from callback directly.


## HookScope

Request-scoped state bag that flows across hook runs and engine instances.

```typescript
import { HookScope } from '@logosdx/hooks';

const scope = new HookScope();
scope.set(Symbol('private'), value);   // Symbol keys for private state
scope.set('shared', value);            // String keys for cross-plugin contracts
scope.get<T>(key);
scope.has(key);
scope.delete(key);
```

**Flowing across runs:**

```typescript
const scope = new HookScope();
const pre = await hooks.run('beforeRequest', url, opts, { scope });
const post = await hooks.run('afterRequest', res, url, opts, { scope });
// Both runs share the same scope
```

**Flowing across engine instances:**

```typescript
// Main engine hook calls a plugin's own engine with the same scope
mainEngine.add('process', async (data, ctx) => {
    await pluginEngine.run('validate', data, { scope: ctx.scope });
});
```


## Priority & Execution Order

Hooks execute in priority order (lower first). Built-in plugins use negative values, user hooks default to 0.

**FetchEngine hook priorities:**

```
beforeRequest (run):
  -30: cache plugin (return cached before consuming tokens)
  -20: rate-limit plugin (gate requests on cache miss)
    0: user hooks (default)
    ∞: per-request hook (via RunOptions.append)

execute (pipe):
  -30: dedupe plugin (join in-flight requests)
  -20: retry plugin (wrap with retry logic)
    0: user hooks (default)

afterRequest (run):
  -10: cache plugin (store response)
    0: user hooks (default)
```


## Library Integration

Use `run()` to provide extension points in your library:

```typescript
async function fetchWithHooks(url: string, options: RequestInit = {}) {

    const scope = new HookScope();

    const pre = await hooks.run('beforeFetch', url, options, { scope });
    if (pre.returned) return pre.result!;

    const [response, err] = await attempt(() => fetch(...pre.args));
    if (err) throw err;

    const post = await hooks.run('afterFetch', response, url, { scope });
    return post.returned ? post.result! : response;
}
```


## Registration

Catches typos at runtime:

```typescript
const hooks = new HookEngine<Lifecycle>()
    .register('beforeFetch', 'afterFetch');

hooks.add('beforeFecth', cb);
// Error: Hook "beforeFecth" is not registered.
// Registered hooks: beforeFetch, afterFetch
```


## Custom Error Handler

```typescript
// Error constructor
const hooks = new HookEngine<Lifecycle, [string, string, object?]>({
    handleFail: HttpsError
});

// Function that throws
const hooks = new HookEngine<Lifecycle, [string, object?]>({
    handleFail: (msg, data) => { throw Boom.badRequest(msg, data); }
});
```


## Common Patterns

### Caching with Early Return

```typescript
hooks.add('beforeGet', async (url, opts, ctx) => {
    const [cached, err] = await attempt(() => cache.get(url));
    if (err) return; // skip cache on error
    if (cached) return ctx.returns(cached);
});
```

### Validation

```typescript
hooks.add('validate', (user, ctx) => {
    if (!user.email) ctx.fail('Email required');
});
```

### Arg Modification

```typescript
hooks.add('beforeRequest', (url, opts, ctx) => {
    ctx.args(url, { ...opts, headers: { ...opts.headers, 'X-Trace': traceId } });
});
```

### Non-Critical Hooks

```typescript
hooks.add('analytics', async (event) => {
    const [, err] = await attempt(() => track(event));
    if (err) console.warn('Analytics failed:', err);
}, { ignoreOnFail: true });
```


## Type Parameters

```typescript
new HookEngine<Lifecycle, FailArgs>()
```

- `Lifecycle` — Interface defining hooks (default: permissive `Record<string, Func>`)
- `FailArgs` — Tuple for `ctx.fail()` args (default: `[string]`)

Only function properties are valid hook names:

```typescript
interface Doc {
    id: string;                // Excluded — data property
    save(): Promise<void>;     // Available as hook
}

hooks.add('save', cb);  // ✓ OK
hooks.add('id', cb);    // ✗ Type error
```
