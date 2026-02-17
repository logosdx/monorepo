# Hooks v2 — API Redesign Notes


## Design Principles

- Args are spread as callback params, ctx is always last
- `return` from callback = short-circuit the chain
- No ctx getters — params ARE your args
- Distinct verbs from Observer: `add`/`run` vs `on`/`emit`
- Sync and async as explicit separate methods
- Hooks ARE the plugin system — policies, middleware, interceptors are all hooks


## Core API

```typescript
class HookEngine<T, FailArgs extends any[] = [string]> {

    constructor(options?: HookEngine.Options<FailArgs>);

    register(...names: HookName<T>[]): this;

    add<K extends HookName<T>>(
        name: K,
        callback: HookCallback<T[K], FailArgs>,
        options?: HookEngine.AddOptions
    ): Unsubscribe;

    run<K extends HookName<T>>(
        name: K,
        ...args: Parameters<T[K]>
    ): Promise<RunResult<T[K]>>;

    run<K extends HookName<T>>(
        name: K,
        ...args: [...Parameters<T[K]>, HookEngine.RunOptions<T[K]>]
    ): Promise<RunResult<T[K]>>;

    runSync<K extends HookName<T>>(name: K, ...args: Parameters<T[K]>): RunResult<T[K]>;

    wrap(fn, hooks: { pre?: K; post?: K }): AsyncWrapped;
    wrapSync(fn, hooks: { pre?: K; post?: K }): SyncWrapped;

    clear(): void;
}
```


## HookContext

```typescript
class HookContext<Args, Result, FailArgs> {

    args(...args: Args): EarlyReturnSignal;
    returns(value: Result): EarlyReturnSignal;
    fail(...args: FailArgs): never;
    removeHook(): void;
}
```

- `ctx.args(...)` — replace args for downstream callbacks
- `return ctx.args(...)` — replace args AND stop the chain
- `ctx.returns(value)` — always used with return, sets result + stops chain
- `ctx.fail(...)` — throws, `return` optional (for TS control flow)
- `ctx.removeHook()` — self-remove this callback from future runs


## RunResult

```typescript
interface RunResult<F> {

    args: Parameters<F>;
    result: Awaited<ReturnType<F>> | undefined;
    returned: boolean;
}
```

Usage:

```typescript
const pre = await hooks.run('beforeRequest', url, options);
if (pre.returned) return pre.result;
const response = await fetch(...pre.args);
```


## AddOptions

```typescript
namespace HookEngine {

    interface Options<FailArgs extends any[]> {
        handleFail?: HandleFail<FailArgs>;
    }

    interface AddOptions {
        once?: true;
        times?: number;
        ignoreOnFail?: true;
        priority?: number;       // lower runs first, default 0
    }

    interface RunOptions<F> {
        append?: HookCallback<F>;  // ephemeral callback, runs last
    }
}
```

- `once: true` — remove after first run (sugar for `times: 1`)
- `times: N` — run N times then auto-remove (tracked via WeakMap)
- `ignoreOnFail: true` — swallow errors from this callback, continue chain
- `priority: N` — execution order, lower first. Default 0. Built-in plugins use negative values.


## Type Helpers

```typescript
// Only function properties are valid hook names
type HookName<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

// Callback: spread params + ctx as last arg
type HookCallback<F, FailArgs> = F extends (...args: infer A) => infer R
    ? (...args: [...A, HookContext<A, Awaited<R>, FailArgs>]) => void | EarlyReturnSignal | Promise<void | EarlyReturnSignal>
    : never;

// Custom fail handler
type HandleFail<Args extends any[]> =
    | (new (...args: Args) => Error)
    | ((...args: Args) => never);

type Unsubscribe = () => void;
```


## Short-Circuit Rules

| Code                          | Args changed | Chain stops |
|-------------------------------|-------------|-------------|
| `ctx.args(...)`               | yes         | no          |
| `return ctx.args(...)`        | yes         | yes         |
| `return ctx.returns(value)`   | n/a         | yes         |
| `ctx.fail(...)`               | n/a         | throws      |


## wrap() Internals

```typescript
wrap(fn, { pre, post }) {

    return async (...args) => {

        const before = await this.run(pre, ...args);
        if (before.returned) return before.result;

        const result = await fn(...before.args);

        if (!post) return result;

        const after = await this.run(post, result, ...args);
        return after.returned ? after.result : result;
    };
}
```

Post hooks receive `(result, ...originalArgs, ctx)` — defined by the lifecycle interface, no magic.


## Priority & Execution Order

Hooks execute in priority order (lower first). Insertion-sort on `add()`, iterate on `run()`.

Built-in plugins register at negative priorities. User hooks default to 0.

```
beforeRequest execution order:
  -30: rate-limit plugin
  -20: cache plugin
  -10: dedupe plugin
    0: user registered hooks
    ∞: per-request inline hook (via RunOptions.append)
```


## Plugin Architecture

### Plugin Contract

```typescript
interface FetchPlugin<H = unknown, P = unknown, S = unknown> {

    /** Human-readable name for debugging / logging */
    name: string;

    /** Plugin's own hook engine — typed per plugin. Optional for simple plugins. */
    hooks?: HookEngine<any>;

    /** Called by engine.use() — registers hooks, returns cleanup */
    install(engine: FetchEngine<H, P, S>): Unsubscribe;
}
```

The interface uses `HookEngine<any>` but concrete plugins return narrower types.
`satisfies FetchPlugin` validates the shape without widening the return type.

### Plugin Complexity Spectrum

| Plugin complexity | Has `hooks`? | Example |
|---|---|---|
| Simple middleware | No | logging, auth, headers |
| Configurable policy | Yes | cache, rate-limit, dedupe |

### Policy Plugin (with its own hooks)

```typescript
interface CacheLifecycle {
    shouldCache(url: URL, opts: RequestOpts): Promise<boolean>;
    onHit(key: string, value: FetchResponse): Promise<void>;
    onMiss(key: string): Promise<void>;
    onSet(key: string, value: FetchResponse, ttl: number): Promise<void>;
    onStale(key: string, value: FetchResponse): Promise<void>;
}

function cachePlugin(config: CacheConfig) {

    const hooks = new HookEngine<CacheLifecycle>();
    const flight = new SingleFlight();

    return {
        name: 'cache',
        hooks,  // HookEngine<CacheLifecycle> — narrow, fully typed
        install(engine) {

            const removePre = engine.hooks.add('beforeRequest', async (url, opts, ctx) => {

                // Consult plugin hooks: should we cache this?
                const should = await hooks.run('shouldCache', url, opts);
                if (should.returned && !should.result) return;

                const key = serialize(opts);
                const cached = flight.getCache(key);

                if (cached?.hit) {

                    await hooks.run('onHit', key, cached.value);
                    engine.emit('cache-hit', { key });
                    return ctx.returns(cached.value);
                }

                await hooks.run('onMiss', key);
                engine.emit('cache-miss', { key });

            }, { priority: -20 });

            const removePost = engine.hooks.add('afterRequest', async (response, url, opts, ctx) => {

                const key = serialize(opts);
                flight.setCache(key, response, { ttl: config.ttl });

                await hooks.run('onSet', key, response, config.ttl);
                engine.emit('cache-set', { key, expiresIn: config.ttl });

            }, { priority: -10 });

            return () => { removePre(); removePost(); };
        }
    } satisfies FetchPlugin;
}
```

### Simple Plugin (no own hooks)

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
    } satisfies FetchPlugin;
}
```

### Other Policy Lifecycles

```typescript
interface RateLimitLifecycle {
    shouldLimit(url: URL, opts: RequestOpts): Promise<boolean>;
    onWait(waitTimeMs: number): Promise<void>;
    onReject(key: string): Promise<void>;
    onAcquire(key: string, remainingTokens: number): Promise<void>;
}

interface DedupeLifecycle {
    shouldDedupe(url: URL, opts: RequestOpts): Promise<boolean>;
    onJoin(key: string, waitingCount: number): Promise<void>;
}
```

### Type Flow

```typescript
// Plugin factory returns narrow type (satisfies validates, doesn't widen)
const cache = cachePlugin({ ttl: 60000 });
//    ^{ name: string, hooks: HookEngine<CacheLifecycle>, install: ... }

// User gets full inference on plugin hooks
cache.hooks.add('onHit', (key, value, ctx) => {
//                         ^string ^FetchResponse ^HookContext
});

cache.hooks.add('onHitt', cb);
//               ^^^^^^^ TS error — not in CacheLifecycle

// Engine only sees FetchPlugin interface — doesn't know about plugin hooks
const api = new FetchEngine({
    baseUrl: '/api',
    plugins: [cache, rateLimit]  // FetchPlugin[]
});

// User talks to plugin instance directly for plugin-specific hooks
cache.hooks.add('shouldCache', (url, opts, ctx) => {
    if (url.pathname.startsWith('/admin')) return ctx.returns(false);
});
```

### Three-Level Architecture

```
FetchEngine.hooks          — beforeRequest / afterRequest (pipeline control)
  └── plugin.hooks         — shouldCache / onHit / shouldLimit (plugin decisions)
        └── observer.emit  — cache-hit / cache-miss (notifications)
```

| Level | System | Controls |
|-------|--------|----------|
| Pipeline | `engine.hooks` | Request flow — modify, short-circuit, transform |
| Plugin behavior | `plugin.hooks` | Plugin decisions — should I cache? should I limit? |
| Monitoring | `observer.emit` | Notifications — what happened, for logging/metrics |

### Registration

```typescript
// At construction
const api = new FetchEngine({
    baseUrl: '/api',
    plugins: [cache, rateLimit, dedupe]
});

// At runtime
const remove = api.use(loggingPlugin(logger));
remove(); // uninstall

// Engine.use() just calls install
class FetchEngine {

    use(plugin: FetchPlugin) {

        return plugin.install(this);
    }
}
```

### Everything is Opt-In

```typescript
// Minimal — no plugins
const bare = new FetchEngine({ baseUrl: '/api' });

// Full suite
const full = new FetchEngine({
    baseUrl: '/api',
    plugins: [cachePlugin(...), dedupePlugin(...), rateLimitPlugin(...)]
});

// Custom mix
const custom = new FetchEngine({
    baseUrl: '/api',
    plugins: [rateLimitPlugin(...), authPlugin(...), loggingPlugin(...)]
});
```


## Per-Request Hooks

One-off hooks scoped to a single request. Same callback signature as registered hooks.

```typescript
api.get('/users', {
    hooks: {
        beforeRequest: (url, opts, ctx) => {
            ctx.args(url, { ...opts, headers: { ...opts.headers, 'X-Trace': traceId } });
        },
        afterRequest: (response, url, opts, ctx) => {
            if (response.status === 404) return ctx.returns(fallbackResponse);
        }
    }
});
```

Internally passed to `run()` via `RunOptions.append` — always executes last, after all
registered hooks and plugins. Not visible to other requests.

Replaces current `onBeforeReq` / `onAfterReq` with the same `(url, opts, ctx)` signature.


## FetchEngine Integration: Two Systems

| Concern       | System   | Purpose                                |
|---------------|----------|----------------------------------------|
| Interception  | Hooks    | Modify args, short-circuit, transform  |
| Notification  | Observer | Fire-and-forget events for monitoring  |

Hooks run first (control flow), then Observer emits (notification):

```typescript
// Inside executor
const pre = await this.hooks.run('beforeRequest', url, opts);
if (pre.returned) return pre.result;

this.observer.emit('before-request', { ...pre.args });

const response = await fetch(...pre.args);

const post = await this.hooks.run('afterRequest', response, url, opts);
this.observer.emit('after-request', { response });

return post.returned ? post.result : response;
```

### What Stays as Observer Events

All notification-only events (no interception needed):
- `error`, `retry`, `abort`, `response`
- `cache-hit`, `cache-miss`, `cache-set`, `cache-stale`, `cache-revalidate`
- `dedupe-start`, `dedupe-join`
- `ratelimit-wait`, `ratelimit-reject`, `ratelimit-acquire`
- `header-add`, `header-remove`, `param-add`, `param-remove`
- `state-set`, `state-reset`, `config-change`

Plugins emit observer events internally for monitoring.

### Executor Simplification

```typescript
// Before: ~400 lines of hardcoded pipeline
// After:
async executeRequest(opts) {

    const pre = await this.hooks.run('beforeRequest', url, opts);
    if (pre.returned) return pre.result;

    const response = await this.attemptCall(pre.args);

    const post = await this.hooks.run('afterRequest', response, url, opts);
    return post.returned ? post.result : response;
}
```


## Decisions Log

- `add`/`run` instead of `on`/`emit` — distinct from Observer
- `RunResult` instead of `EmitResult` — matches `run` verb
- `returned` as predicate — reads naturally: `if (pre.returned)`
- Dropped `addOnce` — covered by `add(name, cb, { once: true })`
- `ctx.args()` not `ctx.arguments()` — shorter, avoids JS keyword baggage
- `removeHook()` not `remove()` — explicit about what's being removed
- `runSync`/`wrapSync` as separate methods — cleaner types than conditional inference
- `times` option with WeakMap tracking — generalizes `once`
- `priority` in AddOptions — insertion-sort on add, iterate on run. No priority queue needed.
- Users cannot remove built-in plugin hooks
- Per-request hooks via `CallOptions.hooks` + `RunOptions.append` — same signature everywhere
- Policies are plugins — all opt-in, composable, replaceable
- Hooks intercept, Observer notifies — clean separation of concerns
- Plugin contract: `{ name, hooks?, install() }` — `hooks` optional for simple plugins
- `satisfies FetchPlugin` — validates shape without widening return type, preserves narrow `hooks` type
- Three-level architecture: engine.hooks (pipeline) → plugin.hooks (decisions) → observer (notifications)
- Plugins own their own HookEngine with their own lifecycle interface — fully typed per plugin
- Engine sees `FetchPlugin` interface only — user interacts with concrete plugin instance for hooks
- `pipe()` for onion/middleware composition — dedupe and retry wrap execution, not before/after
- `PipeContext` is simpler than `HookContext` — no `returns()`, flow controlled by calling/not calling `next()`
- Retry becomes a plugin via `pipe()` — wraps `next()` in a retry loop, removed from executor


## pipe() — Onion/Middleware Composition


### The Problem

Some concerns don't fit the before/after hook model:
- **Dedupe**: needs to wrap the entire execution — check inflight, join or execute and share result
- **Retry**: needs to wrap execution in a loop — retry on failure with backoff

These are **wrappers**, not interceptors. They need to control whether the inner function runs at all,
and potentially run it multiple times.

### The Solution: `pipe()`

`pipe()` composes hooks as nested middleware (onion model). Each hook receives a `next` function
that calls the next layer. The innermost layer is `coreFn`.

```typescript
// Linear: run() executes hooks sequentially
hooks.run('beforeRequest', url, opts);

// Nested: pipe() composes hooks as onion layers
hooks.pipe('execute', () => makeCall(opts), opts);
//  dedupe( retry( makeCall() ) )
```

### API

```typescript
class HookEngine<Lifecycle, FailArgs> {

    async pipe<K extends HookName<Lifecycle>, R>(
        name: K,
        coreFn: () => Promise<R>,
        ...args: unknown[]
    ): Promise<R>;

    pipeSync<K extends HookName<Lifecycle>, R>(
        name: K,
        coreFn: () => R,
        ...args: unknown[]
    ): R;
}
```

- `name` — which hook point to pipe through
- `coreFn` — the innermost function (e.g., `makeCall()`)
- `...args` — arguments passed to each middleware layer
- Last arg can be `PipeOptions` (same as `RunOptions` — `{ scope?, append? }`)

### PipeContext

Simpler than `HookContext` — no `returns()` needed since flow is controlled by calling/not calling `next()`.

```typescript
class PipeContext<FailArgs> {

    readonly scope: HookScope;

    args(...args: unknown[]): void;   // replaces args for next() and downstream
    fail(...args: FailArgs): never;   // abort with error
    removeHook(): void;               // self-remove for future runs
}
```

| Feature | HookContext | PipeContext |
|---------|-------------|-------------|
| `args()` | Returns `EarlyReturnSignal` (for `return ctx.args()`) | Returns `void` (modifies what `next()` receives) |
| `returns()` | Yes — short-circuits chain | No — control flow via calling/not calling `next()` |
| `fail()` | Yes | Yes |
| `removeHook()` | Yes | Yes |
| `scope` | Yes | Yes |

### PipeCallback Type

```typescript
type PipeCallback<
    Args extends unknown[] = unknown[],
    R = unknown,
    FailArgs extends unknown[] = [string]
> = (
    next: () => R | Promise<R>,
    ...args: [...Args, PipeContext<FailArgs>]
) => R | Promise<R>;
```

### How It Works

Hooks are composed from outermost to innermost based on priority (lower = outermost):

```
pipe('execute', coreFn, opts)

Priority -30 (dedupe):   receives (next, opts, ctx)  →  next = retry layer
Priority -20 (retry):    receives (next, opts, ctx)  →  next = coreFn
coreFn:                  () => makeCall(opts)         →  innermost
```

Each middleware decides:
- **Call `next()`**: continue to the next layer
- **Don't call `next()`**: short-circuit (e.g., return cached/inflight result)
- **Call `next()` multiple times**: retry pattern
- **Wrap `next()` in try/catch**: error handling

### Dedupe as pipe() Middleware

```typescript
hooks.add('execute', async (next, opts, ctx) => {

    const key = serialize(opts);
    const inflight = inflightMap.get(key);

    if (inflight) {
        // Join existing request — don't call next()
        ctx.scope.set(DEDUPE_JOIN, true);
        return inflight;
    }

    // Execute and share the result
    const promise = next();
    inflightMap.set(key, promise);

    const [result, err] = await attempt(() => promise);
    inflightMap.delete(key);

    if (err) throw err;
    return result;

}, { priority: -30 });
```

### Retry as pipe() Middleware

```typescript
hooks.add('execute', async (next, opts, ctx) => {

    const maxRetries = opts.retry?.count ?? 3;

    for (let i = 0; i <= maxRetries; i++) {

        const [result, err] = await attempt(next);

        if (!err) return result;
        if (i === maxRetries) throw err;

        await wait(opts.retry?.delay ?? 1000 * (i + 1));
    }

}, { priority: -20 });
```

### Executor with pipe()

```typescript
async executeRequest(opts, totalTimeout) {

    const scope = new HookScope();

    // Linear hooks: modify args, short-circuit with cached response
    const pre = await this.engine.hooks.run('beforeRequest', url, opts, { scope });
    if (pre.returned) return pre.result;

    // Onion hooks: dedupe( retry( makeCall() ) )
    const response = await this.engine.hooks.pipe(
        'execute',
        () => this.makeCall(pre.args[1]),
        pre.args[1],
        { scope }
    );

    totalTimeout?.clear();

    // Linear hooks: transform response
    const post = await this.engine.hooks.run('afterRequest', response, url, opts, { scope });
    return post.returned ? post.result : response;
}
```

### Priority Order for pipe('execute', ...)

```
-30: dedupe  (outermost — joins or shares results)
-20: retry   (wraps next() in retry loop)
  0: user middleware
coreFn: makeCall()  (innermost)
```

### Key Insight: run() vs pipe()

| | `run()` (linear) | `pipe()` (onion) |
|---|---|---|
| Flow | Sequential — each hook runs after the previous | Nested — each hook wraps the next |
| Control | `return ctx.returns()` to short-circuit | Don't call `next()` to short-circuit |
| Use case | Before/after interception | Wrapping execution |
| Context | `HookContext` (args, returns, fail) | `PipeContext` (args, fail — no returns) |
| Examples | Auth headers, cache check, validation | Retry, dedupe, timeout, circuit breaker |

### Implementation Notes

- `pipe()` reuses the same `#hooks` Map as `run()` — callbacks stored as `HookEntry` with `any` cast
- `pipe()` builds the onion chain recursively via `buildChain(index)` — each layer returns `() => Promise<R>`
- `times` and `once` options work the same as in `run()`
- `ignoreOnFail` skips to `next()` on error (falls through to next layer)
- `PipeOptions` matches `RunOptions` structure — `{ append?, scope? }` — extracted by same `#extractRunOptions()`
