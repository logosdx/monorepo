---
title: Hooks
description: A lightweight, type-safe lifecycle hook system for extending behavior without modifying code.
---

# Hooks


Lifecycle hooks let you respond to events without coupling your code. Unlike traditional events (fire-and-forget), hooks support bidirectional communication — callbacks can modify arguments, set results, short-circuit execution, or abort with errors.

[[toc]]

## Installation


::: code-group

```bash [npm]
npm install @logosdx/hooks
```

```bash [yarn]
yarn add @logosdx/hooks
```

```bash [pnpm]
pnpm add @logosdx/hooks
```

:::


## Quick Start

```typescript
import { HookEngine } from '@logosdx/hooks';

interface FetchLifecycle {
    beforeFetch(url: string, options: RequestInit): Promise<Response>;
    afterFetch(response: Response, url: string): Promise<Response>;
}

const hooks = new HookEngine<FetchLifecycle>()
    .register('beforeFetch', 'afterFetch');

// Callbacks receive spread args + ctx as last param
hooks.add('beforeFetch', (url, options, ctx) => {
    ctx.args(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` }
    });
});

// In your library code
async function fetchWithHooks(url: string, options: RequestInit = {}) {

    const pre = await hooks.run('beforeFetch', url, options);
    if (pre.returned) return pre.result!;

    const response = await fetch(...pre.args);

    const post = await hooks.run('afterFetch', response, url);
    return post.returned ? post.result! : response;
}
```

## Library Integration


The real power of hooks is giving library users extension points. Use `run()` at key moments:

```typescript
export class DataService {

    #hooks = new HookEngine<DataLifecycle>()
        .register('beforeSave', 'afterSave', 'beforeDelete');

    get hooks() { return this.#hooks; }

    async save(record: Record) {

        const before = await this.#hooks.run('beforeSave', record);
        if (before.returned) return before.result!;

        const saved = await this.#db.insert(...before.args);
        await this.#hooks.run('afterSave', saved);

        return saved;
    }
}
```

### Exposing Hooks

Two patterns for giving consumers access:

```typescript
// Option 1: Export hooks directly
export const hooks = new HookEngine<Lifecycle>();
export function doWork() { /* uses hooks */ }

// Option 2: Expose via instance property
export class MySdk {
    hooks = new HookEngine<Lifecycle>();
    doWork() { /* uses this.hooks */ }
}

// Consumer usage (either pattern)
import { MySdk } from 'your-library';

const sdk = new MySdk();
sdk.hooks.add('beforeSave', (record, ctx) => {
    console.log('Saving:', record);
});
```

## API Reference


### HookEngine

```typescript
new HookEngine<Lifecycle, FailArgs>(options?)
```

| Method | Description |
|--------|-------------|
| `register(...names)` | Enable strict mode. Returns `this` for chaining. |
| `add(name, callback, options?)` | Subscribe. Returns cleanup function. |
| `run(name, ...args)` | Run hook async. Returns `Promise<RunResult>`. |
| `runSync(name, ...args)` | Run hook sync. Returns `RunResult`. |
| `wrap(fn, { pre?, post? })` | Wrap async function with pre/post hooks. |
| `wrapSync(fn, { pre?, post? })` | Wrap sync function with pre/post hooks. |
| `clear()` | Remove all hooks, reset to permissive mode. |

**Constructor Options:**

```typescript
// Custom error type for ctx.fail()
import { HttpsError } from 'firebase-functions/v2/https';

const hooks = new HookEngine<Lifecycle, [string, string, object?]>({
    handleFail: HttpsError
});

hooks.add('validate', (data, ctx) => {
    ctx.fail('invalid-argument', 'Email invalid', { field: 'email' });
});
```

### HookContext

Passed as the last argument to every callback:

| Method | Returns | Effect |
|--------|---------|--------|
| `ctx.args(...newArgs)` | `EarlyReturnSignal` | Replace args for downstream callbacks |
| `return ctx.args(...)` | — | Replace args **and** stop the chain |
| `ctx.returns(value)` | `EarlyReturnSignal` | Set result and stop the chain (always use with `return`) |
| `ctx.fail(...args)` | `never` | Abort with error |
| `ctx.removeHook()` | `void` | Remove this callback from future runs |

**Short-circuit rules:**

| Code | Args changed | Chain stops |
|------|-------------|-------------|
| `ctx.args(...)` | yes | no |
| `return ctx.args(...)` | yes | yes |
| `return ctx.returns(value)` | n/a | yes |
| `ctx.fail(...)` | n/a | throws |

### RunResult

```typescript
interface RunResult<F> {
    args: Parameters<F>;      // Final args (possibly modified)
    result?: ReturnType<F>;   // Result if set via ctx.returns()
    returned: boolean;        // Whether chain was short-circuited
}
```

Usage pattern:

```typescript
const { args, result, returned } = await hooks.run('beforeProcess', data);

if (returned) return result;

// Continue with (possibly modified) args
const actualResult = await doWork(...args);
```

### AddOptions

```typescript
hooks.add('name', callback, {
    once: true,           // Remove after first run (sugar for times: 1)
    times: 3,             // Run N times then auto-remove
    ignoreOnFail: true,   // Continue if callback throws
    priority: -10         // Lower runs first, default 0
});
```

### Priority & Execution Order

Hooks execute in priority order (lower first). Built-in plugins use negative values, user hooks default to 0.

```
Execution order for 'beforeRequest':
  -30: rate-limit plugin
  -20: cache plugin
  -10: dedupe plugin
    0: user hooks (default)
   10: logging hooks
    ∞: per-request hook (via RunOptions.append)
```

### Registration

Catches typos at runtime:

```typescript
const hooks = new HookEngine<Lifecycle>()
    .register('beforeFetch', 'afterFetch');

hooks.add('beforeFecth', cb);
// Error: Hook "beforeFecth" is not registered.
// Registered hooks: beforeFetch, afterFetch
```

### wrap() / wrapSync()

Shorthand for the pre/post pattern:

```typescript
// Async
const wrappedFetch = hooks.wrap(
    async (url: string) => fetch(url),
    { pre: 'beforeFetch', post: 'afterFetch' }
);

// Sync
const wrappedValidate = hooks.wrapSync(
    (data: UserData) => validate(data),
    { pre: 'beforeValidate' }
);

// Pre: receives (...args, ctx) — can modify args or return early
// Post: receives (result, ...args, ctx) — can transform result
```

## Patterns


### Caching with Early Return

```typescript
hooks.add('beforeGet', (url, opts, ctx) => {
    const cached = cache.get(url);
    if (cached) return ctx.returns(cached);
});

hooks.add('afterGet', (response, url, opts, ctx) => {
    cache.set(url, response);
});
```

### Validation

```typescript
hooks.add('validate', (user, ctx) => {
    if (!user.email) ctx.fail('Email required');
    if (!user.password) ctx.fail('Password required');
});
```

### Arg Modification

```typescript
hooks.add('beforeRequest', (url, opts, ctx) => {
    // Replace args, continue chain
    ctx.args(url, {
        ...opts,
        headers: { ...opts.headers, 'X-Trace': traceId }
    });
});
```

### Non-Critical Hooks

```typescript
hooks.add('analytics', (event) => {
    track(event);
}, { ignoreOnFail: true }); // Don't fail if analytics fails
```

### Composable Middleware

```typescript
// Auth runs first (low priority)
hooks.add('beforeRequest', (url, opts, ctx) => {
    ctx.args(url, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } });
}, { priority: -10 });

// Logging runs last (high priority)
hooks.add('beforeRequest', (url, opts) => {
    console.log('Request:', url);
}, { priority: 10 });
```

### Per-Request Hooks

One-off hooks scoped to a single request via `RunOptions.append`:

```typescript
await hooks.run('beforeRequest', url, opts, {
    append: (url, opts, ctx) => {
        ctx.args(url, { ...opts, headers: { ...opts.headers, 'X-Trace': traceId } });
    }
});
```

## Error Handling


### HookError

Default error from `ctx.fail()`:

```typescript
class HookError extends Error {
    hookName?: string;
    originalError?: Error;
}

// Type guard
import { isHookError } from '@logosdx/hooks';

if (isHookError(err)) {
    console.log(`Hook "${err.hookName}" failed: ${err.message}`);
}
```

### Custom Errors

```typescript
// Firebase
const hooks = new HookEngine<Lifecycle, [string, string, object?]>({
    handleFail: HttpsError
});

// Boom
const hooks = new HookEngine<Lifecycle, [string, object?]>({
    handleFail: (msg, data) => { throw Boom.badRequest(msg, data); }
});
```

## Type Definitions


```typescript
// Only function properties are valid hook names
type HookName<T> = FunctionProps<T>;

// Callback: spread params + ctx as last arg
type HookCallback<F, FailArgs> = F extends (...args: infer A) => infer R
    ? (...args: [...A, HookContext<A, Awaited<R>, FailArgs>]) => void | EarlyReturnSignal | Promise<void | EarlyReturnSignal>
    : never;

// Custom fail handler
type HandleFail<Args> =
    | (new (...args: Args) => Error)
    | ((...args: Args) => never);
```

### Function Properties Only

Only function properties are available as hook names. Data properties are excluded:

```typescript
interface Doc {
    id: string;                      // Data property — excluded
    save(): Promise<void>;           // Function — available as hook
    delete(): Promise<void>;         // Function — available as hook
}

const hooks = new HookEngine<Doc>();
hooks.add('save', cb);    // ✓ OK
hooks.add('delete', cb);  // ✓ OK
hooks.add('id', cb);      // ✗ Type error — 'id' is not a function
```
