# @logosdx/hooks Reference


## Overview

Type-safe lifecycle hook system. Callbacks receive spread args + ctx as last param. Supports priority ordering, short-circuit via `return`, sync/async, and plugin architecture.

**Distinct from Observer:** Hooks use `add`/`run` (bidirectional, can modify args/results). Observer uses `on`/`emit` (fire-and-forget notifications).


## Core API

```typescript
import { HookEngine, HookError, isHookError } from '@logosdx/hooks';

// Define lifecycle interface
interface Lifecycle {
    beforeRequest(url: string, opts: RequestInit): Promise<Response>;
    afterRequest(response: Response, url: string): Promise<Response>;
}

const hooks = new HookEngine<Lifecycle>()
    .register('beforeRequest', 'afterRequest');
```

### add(name, callback, options?)

```typescript
const unsub = hooks.add('beforeRequest', (url, opts, ctx) => {
    // ctx is always the last param
    ctx.args(url, { ...opts, cache: 'no-store' }); // replace args, continue
});

// With options
hooks.add('beforeRequest', cb, {
    once: true,           // remove after first run
    times: 3,             // run N times then auto-remove
    ignoreOnFail: true,   // swallow errors, continue chain
    priority: -10         // lower runs first, default 0
});
```

### run(name, ...args) / runSync(name, ...args)

```typescript
const pre = await hooks.run('beforeRequest', url, opts);
// pre.args — final args (possibly modified)
// pre.result — result if ctx.returns() was called
// pre.returned — true if chain was short-circuited

if (pre.returned) return pre.result;
const response = await fetch(...pre.args);

// Sync version
const result = hooks.runSync('validate', data);
```

### pipe(name, coreFn, ...args) / pipeSync(name, coreFn, ...args)

```typescript
// Onion/middleware composition — each callback wraps the next
const result = await hooks.pipe('execute',
    async (opts) => fetch(opts.url, opts),  // core function (innermost)
    opts                                      // spread args
);

// Callbacks receive (next, ...args, ctx)
hooks.add('execute', async (next, opts, ctx) => {
    console.log('before');
    const result = await next();  // call next middleware or core
    console.log('after');
    return result;
}, { priority: -10 });

// Sync version
const result = hooks.pipeSync('validate', (data) => validate(data), data);
```

### wrap(fn, { pre?, post? }) / wrapSync(fn, { pre?, post? })

```typescript
const wrappedFetch = hooks.wrap(
    async (url: string, opts: RequestInit) => fetch(url, opts),
    { pre: 'beforeRequest', post: 'afterRequest' }
);
// Pre receives (...args, ctx)
// Post receives (result, ...args, ctx)
```


## HookContext Methods

| Call | Args changed | Chain stops |
|------|-------------|-------------|
| `ctx.args(...)` | yes | no |
| `return ctx.args(...)` | yes | yes |
| `return ctx.returns(value)` | n/a | yes |
| `ctx.fail(...)` | n/a | throws |
| `ctx.removeHook()` | n/a | no (self-removes for future runs) |

In pipe callbacks, `ctx` is a `PipeContext` with `args()`, `fail()`, `removeHook()`, and `scope` (no `returns()`).


## Error Handling

```typescript
// Default: ctx.fail('message') throws HookError
hooks.add('validate', (data, ctx) => {
    if (!data.email) ctx.fail('Email required');
});

// Custom error type
const hooks = new HookEngine<Lifecycle, [string, string, object?]>({
    handleFail: HttpsError // or a function that throws
});

// Type guard
const [, err] = await attempt(() => hooks.run('validate', data));
if (isHookError(err)) console.log(err.hookName);
```


## Priority System

Lower priority runs first. Plugins use negative values.

```typescript
hooks.add('beforeRequest', authCb, { priority: -10 });   // runs first
hooks.add('beforeRequest', userCb);                       // priority 0
hooks.add('beforeRequest', logCb, { priority: 10 });      // runs last
```

**FetchEngine hook priorities:**

```
beforeRequest (run):
  -30: cache plugin (return cached before consuming tokens)
  -20: rate-limit plugin (gate requests on cache miss)
    0: user hooks (default)

execute (pipe):
  -30: dedupe plugin (join in-flight requests)
  -20: retry plugin (wrap with retry logic)
    0: user hooks (default)

afterRequest (run):
  -10: cache plugin (store response)
    0: user hooks (default)
```


## HookScope


Request-scoped state bag that flows across hook runs and engine instances.

```typescript
import { HookScope } from '@logosdx/hooks';

const scope = new HookScope();
scope.set(Symbol('private'), value);   // Symbol keys — private plugin state
scope.set('shared', value);            // String keys — cross-plugin contracts
scope.get<T>(key);
scope.has(key);
scope.delete(key);
```

### Flowing across runs

```typescript
const scope = new HookScope();
const pre = await hooks.run('beforeRequest', url, opts, { scope });
const post = await hooks.run('afterRequest', res, url, opts, { scope });
// Both runs share the same scope
```

### Flowing across engine instances

```typescript
mainEngine.add('process', async (data, ctx) => {
    await pluginEngine.run('validate', data, { scope: ctx.scope });
});
```

### RunResult includes scope

```typescript
const result = await hooks.run('beforeRequest', url, opts);
result.scope;  // HookScope used during this run
```


## Per-Request Hooks

```typescript
await hooks.run('beforeRequest', url, opts, {
    append: (url, opts, ctx) => { /* runs after all registered hooks */ },
    scope: existingScope   // optionally share state across runs
});
```


## Plugin Pattern

```typescript
function authPlugin(getToken: () => Promise<string>) {
    return {
        name: 'auth',
        install(engine) {
            return engine.hooks.add('beforeRequest', async (url, opts, ctx) => {
                const token = await getToken();
                ctx.args(url, {
                    ...opts,
                    headers: { ...opts.headers, Authorization: `Bearer ${token}` }
                });
            });
        }
    };
}
```


## Key Exports

| Export | Type | Purpose |
|--------|------|---------|
| `HookEngine` | class | Main engine |
| `HookContext` | class | Context passed to callbacks |
| `PipeContext` | class | Context passed to pipe callbacks |
| `HookScope` | class | Request-scoped state bag |
| `HookError` | class | Default error from `ctx.fail()` |
| `isHookError` | function | Type guard |
| `RunResult` | interface | Return type of `run()`/`runSync()` |
| `PipeResult` | interface | Return type of `pipe()`/`pipeSync()` |
| `HookCallback` | type | Callback signature |
| `HookName` | type | Valid hook name extractor |
| `HandleFail` | type | Custom error handler |
