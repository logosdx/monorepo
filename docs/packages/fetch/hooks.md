---
title: Hooks
description: Request lifecycle hooks for intercepting, modifying, and short-circuiting requests in FetchEngine.
---

# Hooks


FetchEngine uses a 3-phase hook pipeline powered by `@logosdx/hooks` to intercept every request. Hooks replace the legacy `modifyConfig` pattern with a more powerful, composable approach.

[[toc]]


## The Pipeline


Every request flows through three hook phases:

```
beforeRequest (run)     →  execute (pipe)           →  afterRequest (run)
Modify args,               Wrap the network call        Modify response,
short-circuit              (retry, dedupe, etc.)        store in cache
with cached response
```

1. **`beforeRequest`** — Linear hooks that can modify request args or return a cached response
2. **`execute`** — Onion-style middleware that wraps `fetch()` (retry wraps dedupe wraps the call)
3. **`afterRequest`** — Linear hooks that can modify or cache the response


## Adding Hooks


Access the hook engine via `api.hooks`:

```typescript
const api = new FetchEngine({ baseUrl: 'https://api.example.com' });

// Add a hook — returns a cleanup function
const cleanup = api.hooks.add('beforeRequest', (url, opts, ctx) => {

    ctx.args(url, {
        ...opts,
        headers: { ...opts.headers, Authorization: `Bearer ${getToken()}` }
    });
});

// Remove it later
cleanup();
```


### `hooks.add(name, callback, options?)`


```typescript
api.hooks.add(
    'beforeRequest',  // 'beforeRequest' | 'execute' | 'afterRequest'
    callback,
    {
        once: true,          // Auto-remove after first call
        times: 3,            // Auto-remove after N calls
        ignoreOnFail: true,  // Swallow errors, continue chain
        priority: 10,        // Lower numbers run first (default: 0)
    }
);
```

Returns a cleanup function that removes the hook.


### `hooks.clear()`


Remove all registered hooks:

```typescript
api.hooks.clear();
```

This is called automatically by `api.destroy()`.


## beforeRequest


Linear hooks that run sequentially before the network call. Use these for authentication, request modification, or returning cached responses.

**Signature:**

```typescript
(url: URL, opts: InternalReqOptions, ctx: HookContext) => void | Promise<void>
```

**Examples:**

```typescript
// Add auth header to every request
api.hooks.add('beforeRequest', (url, opts, ctx) => {

    ctx.args(url, {
        ...opts,
        headers: { ...opts.headers, Authorization: `Bearer ${opts.state.token}` }
    });
});

// Short-circuit with a cached response
api.hooks.add('beforeRequest', (url, opts, ctx) => {

    const cached = myCache.get(url.toString());

    if (cached) {
        return ctx.returns(cached);
    }
});

// Conditional logging
api.hooks.add('beforeRequest', (url, opts, ctx) => {

    if (opts.method === 'POST') {
        console.log('POST to', url.pathname, opts.body);
    }
});
```


## execute


Onion-style middleware that wraps the core `fetch()` call. Each handler receives `next` to call the next layer. The innermost layer is the actual network request.

**Signature:**

```typescript
(next: () => Promise<FetchResponse>, opts: InternalReqOptions, ctx: PipeContext) => Promise<FetchResponse>
```

**Examples:**

```typescript
// Timing middleware
api.hooks.add('execute', async (next, opts) => {

    const start = Date.now();
    const response = await next();
    console.log(`${opts.method} ${opts.path} took ${Date.now() - start}ms`);

    return response;
});

// Circuit breaker
api.hooks.add('execute', async (next, opts, ctx) => {

    if (circuitOpen) {
        throw new Error('Circuit breaker open');
    }

    return next();
});
```


## afterRequest


Linear hooks that run after a successful response. Use these for response transformation, caching, or logging.

**Signature:**

```typescript
(response: FetchResponse, url: URL, opts: InternalReqOptions, ctx: HookContext) => void | Promise<void>
```

**Examples:**

```typescript
// Cache successful responses
api.hooks.add('afterRequest', (response, url, opts, ctx) => {

    if (opts.method === 'GET' && response.status === 200) {
        myCache.set(url.toString(), response);
    }
});

// Replace the response
api.hooks.add('afterRequest', (response, url, opts, ctx) => {

    return ctx.returns({
        ...response,
        data: transformData(response.data)
    });
});
```


## HookContext


The context object provides flow control within `beforeRequest` and `afterRequest` hooks.

| Method | Description |
|--------|-------------|
| `ctx.args(...)` | Replace args for downstream hooks (continue chain) |
| `return ctx.args(...)` | Replace args AND stop the chain |
| `return ctx.returns(value)` | Inject a result and stop the chain |
| `ctx.fail(message)` | Abort with an error |
| `ctx.removeHook()` | Remove this callback from all future runs |
| `ctx.scope` | Shared state bag across all three phases (see HookScope) |


## PipeContext


The context object for `execute` hooks is simpler — flow control is managed by calling or skipping `next()`.

| Method | Description |
|--------|-------------|
| `ctx.args(...)` | Replace args for inner layers |
| `ctx.scope` | Shared state bag across all three phases |


## HookScope


A `Map`-backed state bag shared across all three hook phases within a single request. Use it to pass data between `beforeRequest` and `afterRequest` without polluting `opts`.

```typescript
const TRACE_KEY = Symbol('trace');

api.hooks.add('beforeRequest', (url, opts, ctx) => {

    ctx.scope.set(TRACE_KEY, { startedAt: Date.now() });
});

api.hooks.add('afterRequest', (response, url, opts, ctx) => {

    const trace = ctx.scope.get(TRACE_KEY);
    console.log(`Request took ${Date.now() - trace.startedAt}ms`);
});
```

**Convention:** Use `Symbol` keys for private plugin state, `string` keys for cross-plugin contracts.


## Per-Request Hooks


Add hooks to a single request via `CallConfig.hooks`. These run last (after all engine-level hooks) and are not registered permanently.

```typescript
await api.get('/users', {
    hooks: {
        beforeRequest: (url, opts, ctx) => {
            ctx.args(url, {
                ...opts,
                headers: { ...opts.headers, 'X-Custom': 'value' }
            });
        },
        afterRequest: (response, url, opts) => {
            console.log('Response status:', response.status);
        }
    }
});
```

Per-request hooks support `beforeRequest` and `afterRequest` only.


## Priority


Hooks run in priority order (lower numbers first). Built-in plugins use negative priorities so user hooks (default `0`) always run after them:

```
beforeRequest:
  -30  Cache plugin (return hit before consuming rate-limit tokens)
  -20  Rate limit plugin (gate on cache miss)
    0  Your hooks (default)
    ∞  Per-request hooks (always last)

execute:
  -30  Dedupe plugin (join in-flight requests)
  -20  Retry plugin (exponential backoff)
    0  Your hooks (default)

afterRequest:
  -10  Cache plugin (store fresh response)
    0  Your hooks (default)
```

Set priority explicitly when ordering matters:

```typescript
// Run before default hooks
api.hooks.add('beforeRequest', earlyHandler, { priority: -5 });

// Run after default hooks
api.hooks.add('beforeRequest', lateHandler, { priority: 10 });
```


## Common Patterns


### Authentication

```typescript
api.hooks.add('beforeRequest', (url, opts, ctx) => {

    const token = opts.state.authToken;

    if (token) {
        ctx.args(url, {
            ...opts,
            headers: { ...opts.headers, Authorization: `Bearer ${token}` }
        });
    }
});
```


### Request/Response Logging

```typescript
api.hooks.add('beforeRequest', (url, opts, ctx) => {

    console.log(`→ ${opts.method} ${url.pathname}`);
});

api.hooks.add('afterRequest', (response, url, opts) => {

    console.log(`← ${response.status} ${opts.method} ${url.pathname}`);
});
```


### Conditional Header Injection

```typescript
api.hooks.add('beforeRequest', (url, opts, ctx) => {

    if (/^\/admin/.test(url.pathname)) {
        ctx.args(url, {
            ...opts,
            headers: { ...opts.headers, 'X-Admin-Token': getAdminToken() }
        });
    }
});
```
