# @logosdx/hooks - LLM Helper

A lightweight, type-safe lifecycle hook system for extending behavior without modifying code.

## Core Concept

Lifecycle hooks let you respond to named events with bidirectional communication. Unlike traditional events (fire-and-forget), hooks return `EmitResult` so callers know what happened.

## API Overview

```typescript
import { HookEngine, HookError, isHookError } from '@logosdx/hooks';

interface Lifecycle {
    beforeFetch(url: string): Promise<Response>;
    afterFetch(result: Response, url: string): Promise<Response>;
    rateLimit(retryAfter: number, attempt: number): Promise<void>;
}

const hooks = new HookEngine<Lifecycle>()
    .register('beforeFetch', 'afterFetch', 'rateLimit');

// Subscribe
hooks.on('beforeFetch', async (ctx) => { /* ... */ });
hooks.once('init', async (ctx) => { /* one-time */ });

// Emit
const result = await hooks.emit('beforeFetch', url);
// result.args, result.result, result.earlyReturn

// Wrap function with pre/post hooks
const wrapped = hooks.wrap(fn, { pre: 'beforeFetch', post: 'afterFetch' });

// Clear all
hooks.clear();
```

## HookEngine Methods

| Method | Description |
|--------|-------------|
| `register(...names)` | Register hooks for runtime validation. Returns `this`. |
| `on(name, cbOrOpts)` | Subscribe to hook. Returns cleanup function. |
| `once(name, cb)` | Subscribe once. Sugar for `on(name, { callback, once: true })`. |
| `emit(name, ...args)` | Emit hook. Returns `EmitResult`. |
| `wrap(fn, { pre?, post? })` | Wrap function with pre/post hooks. |
| `clear()` | Remove all hooks, reset to permissive mode. |

## HookContext Methods

Passed to every callback:

| Method | Description |
|--------|-------------|
| `ctx.args` | Current arguments |
| `ctx.result` | Current result (if set) |
| `ctx.setArgs(next)` | Replace args for subsequent callbacks |
| `ctx.setResult(next)` | Set result value |
| `ctx.returnEarly()` | Stop processing, signal early return |
| `ctx.fail(...args)` | Abort with error |
| `ctx.removeHook()` | Remove this callback from future emissions |

## EmitResult

```typescript
interface EmitResult<F> {
    args: Parameters<F>;        // Final args (possibly modified)
    result?: ReturnType<F>;     // Result (if set)
    earlyReturn: boolean;       // Whether returnEarly() was called
}
```

## Library Integration

Use `emit()` to provide extension points in your library:

```typescript
async function fetchWithHooks(url: string, options: RequestInit = {}) {

    const before = await hooks.emit('beforeFetch', url, options);
    if (before.earlyReturn) return before.result!;

    const response = await fetch(...before.args);

    const after = await hooks.emit('afterFetch', response, url);
    return after.result ?? response;
}
```

Expose hooks via instance or export:

```typescript
// Via instance
export class MySdk {
    hooks = new HookEngine<Lifecycle>();
}

// Via export
export const hooks = new HookEngine<Lifecycle>();
```

## Hook Options

```typescript
hooks.on('name', {
    callback: async (ctx) => { /* ... */ },
    once: true,           // Remove after first run
    ignoreOnFail: true    // Continue if callback throws
});
```

## Registration System

Once `register()` is called, ALL hooks must be registered:

```typescript
const hooks = new HookEngine<Lifecycle>()
    .register('beforeFetch', 'afterFetch');

hooks.on('beforeFecth', cb);
// Error: Hook "beforeFecth" is not registered.
// Registered hooks: beforeFetch, afterFetch
```

## Custom Error Handler

```typescript
// Firebase HttpsError
const hooks = new HookEngine<Lifecycle, [string, string, object?]>({
    handleFail: HttpsError
});

hooks.on('validate', async (ctx) => {
    ctx.fail('invalid-argument', 'Email invalid', { field: 'email' });
});

// Custom function
const hooks = new HookEngine<Lifecycle, [string, object?]>({
    handleFail: (msg, data) => { throw Boom.badRequest(msg, data); }
});
```

## Common Patterns

### Caching with Early Return

```typescript
hooks.on('beforeGet', async (ctx) => {
    const cached = cache.get(ctx.args[0]);
    if (cached) {
        ctx.setResult(cached);
        ctx.returnEarly();
    }
});
```

### Validation

```typescript
hooks.on('validate', async (ctx) => {
    const [data] = ctx.args;
    if (!data.email) ctx.fail('Email required');
});
```

### Non-Critical Hooks

```typescript
hooks.on('analytics', {
    callback: async (ctx) => { await track(ctx.args); },
    ignoreOnFail: true
});
```

## Type Parameters

```typescript
new HookEngine<Lifecycle, FailArgs>()
```

- `Lifecycle` - Interface defining hooks (default: permissive `Record<string, AsyncFunc>`)
- `FailArgs` - Tuple for `ctx.fail()` args (default: `[string]`)

**Only function properties are valid hook names:**

```typescript
interface Doc {
    id: string;                // Excluded - data property
    save(): Promise<void>;     // Available as hook
}

hooks.on('save', cb);  // ✓ OK
hooks.on('id', cb);    // ✗ Type error
```
