---
title: Hooks
description: A lightweight, type-safe lifecycle hook system for extending behavior without modifying code.
---

# Hooks

Lifecycle hooks let you respond to events without coupling your code. Unlike traditional events (fire-and-forget), hooks support bidirectional communication - callbacks can modify arguments, set results, return early, or abort execution.

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
    rateLimit(retryAfter: number, attempt: number): Promise<void>;
}

const hooks = new HookEngine<FetchLifecycle>()
    .register('beforeFetch', 'afterFetch', 'rateLimit');

// Subscribe to events
hooks.on('beforeFetch', async (ctx) => {
    const [url, options] = ctx.args;
    ctx.setArgs([url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` }
    }]);
});

// Emit in your library code
async function fetchWithHooks(url: string, options: RequestInit = {}) {

    const before = await hooks.emit('beforeFetch', url, options);
    if (before.earlyReturn) return before.result!;

    const response = await fetch(...before.args);

    const after = await hooks.emit('afterFetch', response, url);
    return after.result ?? response;
}
```

## Library Integration

The real power of hooks is giving library users extension points. Use `emit()` at key moments:

```typescript
export class DataService {

    #hooks = new HookEngine<DataLifecycle>()
        .register('beforeSave', 'afterSave', 'beforeDelete');

    get hooks() { return this.#hooks; }

    async save(record: Record) {

        const before = await this.#hooks.emit('beforeSave', record);
        if (before.earlyReturn) return before.result!;

        const saved = await this.#db.insert(before.args[0]);
        await this.#hooks.emit('afterSave', saved);

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
sdk.hooks.on('beforeSave', async (ctx) => {
    console.log('Saving:', ctx.args[0]);
});
```

### Standalone Events

Not all hooks need pre/post patterns. Emit events for moments users care about:

```typescript
// In your library
await this.hooks.emit('rateLimit', retryAfter, attempt);
await this.hooks.emit('retry', error, attempt);
await this.hooks.emit('cacheHit', key, value);

// Consumer subscribes
sdk.hooks.on('rateLimit', async (ctx) => {
    const [retryAfter] = ctx.args;
    await sleep(retryAfter);
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
| `on(name, cbOrOpts)` | Subscribe. Returns cleanup function. |
| `once(name, cb)` | Subscribe once. Sugar for `{ callback, once: true }`. |
| `emit(name, ...args)` | Emit hook. Returns `EmitResult`. |
| `wrap(fn, { pre?, post? })` | Wrap function with pre/post hooks. |
| `clear()` | Remove all hooks, reset to permissive mode. |

**Constructor Options:**

```typescript
// Custom error type for ctx.fail()
import { HttpsError } from 'firebase-functions/v2/https';

const hooks = new HookEngine<Lifecycle, [string, string, object?]>({
    handleFail: HttpsError
});

hooks.on('validate', async (ctx) => {
    ctx.fail('invalid-argument', 'Email invalid', { field: 'email' });
});
```

### HookContext

Passed to every callback:

| Property/Method | Description |
|-----------------|-------------|
| `ctx.args` | Current arguments (readonly) |
| `ctx.result` | Current result if set (readonly) |
| `ctx.setArgs(next)` | Replace args for subsequent callbacks |
| `ctx.setResult(next)` | Set result value |
| `ctx.returnEarly()` | Stop processing, signal early return |
| `ctx.fail(...args)` | Abort with error |
| `ctx.removeHook()` | Remove this callback from future emissions |

### EmitResult

```typescript
interface EmitResult<F> {
    args: Parameters<F>;      // Final args (possibly modified)
    result?: ReturnType<F>;   // Result if set
    earlyReturn: boolean;     // Whether returnEarly() was called
}
```

Usage pattern:

```typescript
const { args, result, earlyReturn } = await hooks.emit('beforeProcess', data);

if (earlyReturn) return result;

// Continue with (possibly modified) args
const actualResult = await doWork(...args);
```

### Hook Options

```typescript
hooks.on('name', {
    callback: async (ctx) => { /* ... */ },
    once: true,           // Remove after first run
    ignoreOnFail: true    // Continue if callback throws
});
```

### Registration

Catches typos at runtime:

```typescript
const hooks = new HookEngine<Lifecycle>()
    .register('beforeFetch', 'afterFetch');

hooks.on('beforeFecth', cb);
// Error: Hook "beforeFecth" is not registered.
// Registered hooks: beforeFetch, afterFetch
```

### wrap()

Shorthand for the pre/post pattern:

```typescript
const wrappedFetch = hooks.wrap(
    async (url: string) => fetch(url),
    { pre: 'beforeFetch', post: 'afterFetch' }
);

// Pre: receives args, can modify or returnEarly
// Post: receives [result, ...args], can modify result
```

## Patterns

### Caching with Early Return

```typescript
hooks.on('beforeGet', async (ctx) => {
    const cached = cache.get(ctx.args[0]);
    if (cached) {
        ctx.setResult(cached);
        ctx.returnEarly();
    }
});

hooks.on('afterGet', async (ctx) => {
    const [result, key] = ctx.args;
    cache.set(key, result);
});
```

### Validation

```typescript
hooks.on('validate', async (ctx) => {
    const [user] = ctx.args;
    if (!user.email) ctx.fail('Email required');
    if (!user.password) ctx.fail('Password required');
});
```

### Non-Critical Hooks

```typescript
hooks.on('analytics', {
    callback: async (ctx) => await track(ctx.args),
    ignoreOnFail: true  // Don't fail if analytics fails
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
type AsyncFunc = (...args: any[]) => Promise<any>;

// Only function properties are valid hook names
type HookName<T> = FunctionProps<T>;

type HookFn<F, FailArgs> = (ctx: HookContext<F, FailArgs>) => Promise<void>;

interface HookOptions<F, FailArgs> {
    callback: HookFn<F, FailArgs>;
    once?: true;
    ignoreOnFail?: true;
}

type HandleFail<Args> =
    | (new (...args: Args) => Error)
    | ((...args: Args) => never);
```

### Function Properties Only

Only function properties are available as hook names. Data properties are excluded:

```typescript
interface Doc {
    id: string;                      // Data property - excluded
    save(): Promise<void>;           // Function - available as hook
    delete(): Promise<void>;         // Function - available as hook
}

const hooks = new HookEngine<Doc>();
hooks.on('save', cb);    // ✓ OK
hooks.on('delete', cb);  // ✓ OK
hooks.on('id', cb);      // ✗ Type error - 'id' is not a function
```
