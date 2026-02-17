# FetchEngine Plugin Architecture


## Goal

Replace the hardcoded request pipeline in `executor.ts` with a plugin architecture powered by `@logosdx/hooks`. FetchEngine becomes a thin shell. All resilience behavior (cache, dedupe, retry, rate-limit) is opt-in via plugins.


## What the User Sees

```typescript
import {
    FetchEngine,
    cachePlugin,
    dedupePlugin,
    retryPlugin,
    rateLimitPlugin
} from '@logosdx/fetch';

const cache = cachePlugin({
    ttl: 60_000,
    rules: [
        { startsWith: '/static', ttl: 3_600_000 },
        { startsWith: '/admin', enabled: false }
    ]
});

const retry = retryPlugin({
    count: 3,
    delay: 1000,
    rules: [
        { startsWith: '/payments', enabled: false },
        { startsWith: '/users', count: 5, delay: 500 }
    ]
});

const dedupe = dedupePlugin({ enabled: true });
const rateLimit = rateLimitPlugin({ maxConcurrent: 10 });

// Hook into plugin decisions (optional)
cache.hooks.add('shouldCache', (url, opts, ctx) => {
    if (url.pathname.includes('/live')) return ctx.returns(false);
});

retry.hooks.add('shouldRetry', (error, attempt, opts, ctx) => {
    if (error.status === 401) return ctx.returns(false);
});

// Pass plugins to engine
const api = new FetchEngine({
    baseUrl: '/api',
    plugins: [cache, dedupe, retry, rateLimit]
});

// Or install at runtime
const removeAuth = api.use(authPlugin(getToken));
removeAuth(); // uninstall later
```


## The Pipeline

Every request goes through three phases:

```
Phase 1: beforeRequest ──── run() (linear) ──── rate-limit, cache check, auth headers
Phase 2: execute ─────────── pipe() (onion) ──── dedupe( retry( makeCall() ) )
Phase 3: afterRequest ────── run() (linear) ──── cache store, response transform
```

A `HookScope` flows across all three phases so plugins can share state.


### `run()` vs `pipe()`

HookEngine has two ways to execute hooks:

**`run()`** executes hooks **linearly** — one after another. Each hook can modify args (`ctx.args()`), short-circuit (`return ctx.returns(value)`), or fail (`ctx.fail()`). This is for **interception**: checking cache, gating on rate-limit, adding headers.

**`pipe()`** executes hooks as **nested middleware** (onion model). Each hook receives a `next()` function that calls the next inner layer. The innermost layer is `coreFn`. This is for **wrapping**: dedupe needs to control _whether_ the inner function runs (join in-flight vs execute new). Retry needs to call it _multiple times_ (loop on failure). Neither of these is possible with linear hooks.

`pipe()` already exists in `@logosdx/hooks` — `packages/hooks/src/index.ts`.


### Phase 1: `beforeRequest` — linear via `run()`

Callbacks receive `(url, opts, ctx: HookContext)`.

| Priority | Plugin | Action |
|----------|--------|--------|
| `-30` | rate-limit | Check token bucket, wait or fail |
| `-20` | cache | Look up cache, `return ctx.returns(cached)` on hit |
| `0` | user hooks | Auth headers, logging, transforms |
| `∞` | per-request | One-off hook from `CallConfig.hooks.beforeRequest` |


### Phase 2: `execute` — onion via `pipe()`

Callbacks receive `(next, opts, ctx: PipeContext)`.

```
outermost → dedupe (priority -30)
               └── retry (priority -20)
                      └── user middleware (priority 0)
                             └── makeCall() (coreFn, innermost)
```

| Priority | Plugin | Action |
|----------|--------|--------|
| `-30` | dedupe | Check inflight map. Match → return existing promise. No match → call `next()`, store and share result. |
| `-20` | retry | Call `next()` in a loop. On failure: wait, retry. On max retries: throw. |
| `0` | user middleware | Custom wrapping (timeout, circuit breaker, etc.) |
| inner | `coreFn` | `() => this.makeCall(opts)` |


### Phase 3: `afterRequest` — linear via `run()`

Callbacks receive `(response, url, opts, ctx: HookContext)`.

| Priority | Plugin | Action |
|----------|--------|--------|
| `-10` | cache | Store response using key from scope |
| `0` | user hooks | Response transforms, logging |
| `∞` | per-request | One-off hook from `CallConfig.hooks.afterRequest` |


### The Executor

```typescript
async executeRequest(normalizedOpts, totalTimeout) {

    const scope = new HookScope();

    const pre = await this.engine.hooks.run('beforeRequest', url, normalizedOpts, {
        append: perRequestBeforeHook,
        scope
    });

    if (pre.returned) return pre.result;

    const response = await this.engine.hooks.pipe(
        'execute',
        () => this.makeCall(pre.args[1]),
        pre.args[1],
        { scope }
    );

    totalTimeout?.clear();

    const post = await this.engine.hooks.run('afterRequest', response, url, normalizedOpts, {
        append: perRequestAfterHook,
        scope
    });

    return post.returned ? post.result : response;
}
```

That's it. Everything else lives in plugins.


## Lifecycle Interface

```typescript
interface FetchLifecycle<H, P, S> {
    beforeRequest(url: URL, opts: InternalReqOptions<H, P, S>): FetchResponse;
    execute(opts: InternalReqOptions<H, P, S>): Promise<FetchResponse>;
    afterRequest(response: FetchResponse, url: URL, opts: InternalReqOptions<H, P, S>): FetchResponse;
}
```

Register all three: `.register('beforeRequest', 'execute', 'afterRequest')`.


## FetchPlugin Contract

```typescript
interface FetchPlugin<H = unknown, P = unknown, S = unknown> {
    name: string;
    hooks?: HookEngine<any>;
    install(engine: FetchEnginePublic<H, P, S>): () => void;
}
```

- `name` — for debugging/logging
- `hooks` — optional. Policy plugins expose their own `HookEngine` so users can hook into decisions. Simple plugins (auth, logging) don't need this.
- `install(engine)` — registers hooks on `engine.hooks`, returns unsubscribe
- Use `satisfies FetchPlugin` in factories to validate shape without widening the return type


## Plugin File Structure

```
packages/fetch/src/plugins/
├── base.ts               # ResiliencePolicy base class (shared)
├── helpers.ts            # Rule matching helpers (shared)
├── cache.ts              # CachePolicy, CacheLifecycle, cachePlugin(), types
├── dedupe.ts             # DedupePolicy, DedupeLifecycle, dedupePlugin(), types
├── retry.ts              # RetryPolicy, RetryLifecycle, retryPlugin(), types
└── rate-limit.ts         # RateLimitPolicy, RateLimitLifecycle, rateLimitPlugin(), types
```

One file per plugin. Each file contains everything for that plugin:

1. **Types** — config and rule interfaces extending `BasePolicyConfig`/`BasePolicyRule` (per-route rules, method filtering, serializers)
2. **Policy class** — extends `ResiliencePolicy`. Pure logic: config → rule resolution. Does NOT reference hooks, engine, or executor.
3. **Lifecycle interface** — hookable decisions (e.g., `shouldRetry`, `shouldCache`)
4. **Factory function** — `xxxPlugin(config)`. Creates policy + its own `HookEngine`, returns `{ name, hooks, policy, install() }` satisfying `FetchPlugin`.

The old `src/policies/` folder is deleted and replaced by `src/plugins/`.


## Plugin Implementations


### Retry — `src/plugins/retry.ts`

Retry is a full policy with per-route rules. You don't retry `/payments` but you retry `/users`.

Uses `pipe('execute', ...)` because retry needs to call `next()` multiple times.

```typescript
interface RetryRule extends BasePolicyRule {
    count?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
    retryOn?: number[];
}

interface RetryConfig extends BasePolicyConfig<any, any, any, RetryRule> {
    count?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
    retryOn?: number[];
}

interface RetryLifecycle {
    shouldRetry(error: Error, attempt: number, opts: InternalReqOptions): Promise<boolean>;
    onRetry(error: Error, attempt: number, delay: number, opts: InternalReqOptions): Promise<void>;
}

function retryPlugin(config: boolean | RetryConfig) {

    const policy = new RetryPolicy();
    const hooks = new HookEngine<RetryLifecycle>();

    policy.init(config);

    return {
        name: 'retry',
        hooks,
        policy,
        install(engine) {

            return engine.hooks.add('execute', async (next, opts, ctx) => {

                const rule = policy.resolve(opts.method, opts.path, opts);
                if (!rule) return next();

                let lastError: Error;

                for (let i = 0; i <= rule.count; i++) {

                    const [result, err] = await attempt(next);
                    if (!err) return result;

                    lastError = err;

                    const should = await hooks.run('shouldRetry', err, i + 1, opts);
                    if (should.returned && !should.result) throw err;

                    if (i < rule.count) {

                        const delay = computeDelay(rule, i);
                        await hooks.run('onRetry', err, i + 1, delay, opts);
                        engine.emit('retry', { attempt: i + 1, error: err, delay });
                        await wait(delay);
                    }
                }

                throw lastError;

            }, { priority: -20 });
        }
    } satisfies FetchPlugin;
}
```


### Dedupe — `src/plugins/dedupe.ts`

Uses `pipe('execute', ...)` because dedupe needs to control whether `next()` runs at all.

```typescript
interface DedupeLifecycle {
    shouldDedupe(url: URL, opts: InternalReqOptions): Promise<boolean>;
    onJoin(key: string, waitingCount: number): Promise<void>;
}

function dedupePlugin(config: boolean | DedupeConfig) {

    const policy = new DedupePolicy();
    const hooks = new HookEngine<DedupeLifecycle>();
    const inflightMap = new Map<string, Promise<FetchResponse>>();

    policy.init(config);

    return {
        name: 'dedupe',
        hooks,
        policy,
        install(engine) {

            return engine.hooks.add('execute', async (next, opts, ctx) => {

                const rule = policy.resolve(opts.method, opts.path, opts);
                if (!rule) return next();

                const key = rule.serializer(opts);
                const inflight = inflightMap.get(key);

                if (inflight) {

                    await hooks.run('onJoin', key, inflightMap.size);
                    engine.emit('dedupe-join', { key });
                    return inflight;
                }

                const promise = next();
                inflightMap.set(key, promise);

                const [result, err] = await attempt(() => promise);
                inflightMap.delete(key);

                if (err) throw err;
                return result;

            }, { priority: -30 });
        }
    } satisfies FetchPlugin;
}
```


### Cache — `src/plugins/cache.ts`

Uses `run('beforeRequest', ...)` to check cache and `run('afterRequest', ...)` to store. Cache is interception, not wrapping — it short-circuits with a cached value or stores the response after.

```typescript
interface CacheLifecycle {
    shouldCache(url: URL, opts: InternalReqOptions): Promise<boolean>;
    onHit(key: string, response: FetchResponse, isStale: boolean): Promise<void>;
    onMiss(key: string): Promise<void>;
    onSet(key: string, response: FetchResponse, ttl: number): Promise<void>;
}

function cachePlugin(config: boolean | CacheConfig) {

    const policy = new CachePolicy();
    const hooks = new HookEngine<CacheLifecycle>();

    policy.init(config);

    return {
        name: 'cache',
        hooks,
        policy,
        install(engine) {

            const CACHE_KEY = Symbol('cacheKey');
            const CACHE_RULE = Symbol('cacheRule');

            const removePre = engine.hooks.add('beforeRequest', async (url, opts, ctx) => {

                const rule = policy.resolve(opts.method, opts.path, opts);
                if (!rule) return;

                const should = await hooks.run('shouldCache', url, opts);
                if (should.returned && !should.result) return;

                const key = rule.serializer(opts);
                ctx.scope.set(CACHE_KEY, key);
                ctx.scope.set(CACHE_RULE, rule);

                const cached = await adapter.get(key);

                if (cached?.hit) {

                    await hooks.run('onHit', key, cached.value, cached.isStale);
                    engine.emit('cache-hit', { key, isStale: cached.isStale });

                    if (cached.isStale) {
                        triggerBackgroundRevalidation(engine, opts, key, rule);
                    }

                    return ctx.returns(cached.value);
                }

                await hooks.run('onMiss', key);
                engine.emit('cache-miss', { key });

            }, { priority: -20 });

            const removePost = engine.hooks.add('afterRequest', async (response, url, opts, ctx) => {

                const key = ctx.scope.get<string>(CACHE_KEY);
                const rule = ctx.scope.get<CacheRule>(CACHE_RULE);
                if (!key || !rule) return;

                await adapter.set(key, response, { ttl: rule.ttl });
                await hooks.run('onSet', key, response, rule.ttl);
                engine.emit('cache-set', { key, ttl: rule.ttl });

            }, { priority: -10 });

            return () => { removePre(); removePost(); };
        }
    } satisfies FetchPlugin;
}
```


### Rate-Limit — `src/plugins/rate-limit.ts`

Uses `run('beforeRequest', ...)` to gate requests. Rate-limiting is interception — it blocks or delays before any execution.

```typescript
interface RateLimitLifecycle {
    shouldLimit(url: URL, opts: InternalReqOptions): Promise<boolean>;
    onWait(waitTimeMs: number, opts: InternalReqOptions): Promise<void>;
    onReject(key: string, opts: InternalReqOptions): Promise<void>;
}

function rateLimitPlugin(config: boolean | RateLimitConfig) {

    const policy = new RateLimitPolicy();
    const hooks = new HookEngine<RateLimitLifecycle>();

    policy.init(config);

    return {
        name: 'rateLimit',
        hooks,
        policy,
        install(engine) {

            return engine.hooks.add('beforeRequest', async (url, opts, ctx) => {

                const rule = policy.resolve(opts.method, opts.path, opts);
                if (!rule) return;

                const allowed = policy.tryAcquire(rule);
                if (allowed) return;

                const should = await hooks.run('shouldLimit', url, opts);
                if (should.returned && !should.result) return;

                const waitTime = policy.getWaitTime(rule);
                await hooks.run('onWait', waitTime, opts);
                engine.emit('ratelimit-wait', { waitTime });
                await wait(waitTime);

            }, { priority: -30 });
        }
    } satisfies FetchPlugin;
}
```


## Exports — `src/index.ts`

```typescript
export { FetchEngine } from './engine/index.ts';
export type { FetchLifecycle, FetchPlugin, FetchEnginePublic } from './engine/types.ts';

export { cachePlugin } from './plugins/cache.ts';
export { dedupePlugin } from './plugins/dedupe.ts';
export { retryPlugin } from './plugins/retry.ts';
export { rateLimitPlugin } from './plugins/rate-limit.ts';

export { ResiliencePolicy } from './plugins/base.ts';

export type { CacheConfig, CacheRule } from './plugins/cache.ts';
export type { DedupeConfig, DedupeRule } from './plugins/dedupe.ts';
export type { RetryConfig, RetryRule } from './plugins/retry.ts';
export type { RateLimitConfig, RateLimitRule } from './plugins/rate-limit.ts';
```


## Files to Create/Modify


### New Files

| File | Purpose |
|------|---------|
| `src/plugins/base.ts` | `ResiliencePolicy` base class (from `src/policies/base.ts`) |
| `src/plugins/helpers.ts` | Rule matching helpers (from `src/policies/helpers.ts`) |
| `src/plugins/cache.ts` | Policy class + lifecycle + factory + types (from `src/policies/cache.ts`, decoupled from executor) |
| `src/plugins/dedupe.ts` | Policy class + lifecycle + factory + types (from `src/policies/dedupe.ts`, decoupled from executor) |
| `src/plugins/retry.ts` | Policy class + lifecycle + factory + types (NEW — retry extracted from executor into proper policy) |
| `src/plugins/rate-limit.ts` | Policy class + lifecycle + factory + types (from `src/policies/rate-limit.ts`, decoupled from executor) |


### Modified Files

| File | Change |
|------|--------|
| `src/engine/types.ts` | Add `execute` to `FetchLifecycle` |
| `src/engine/index.ts` | Accept `plugins` in config, call `use()` for each |
| `src/engine/executor.ts` | Gut to three-phase pipeline. Remove `attemptCall()`, `initPolicies()`, all direct policy calls. Keep `makeRequestOptions()` and `makeCall()`. |
| `src/options/types.ts` | Add `plugins?: FetchPlugin[]` to `EngineConfig`. Replace `onBeforeReq`/`onAfterReq` with `hooks` in `CallConfig`. |
| `src/index.ts` | Update exports |


### Deleted

| File | Reason |
|------|--------|
| `src/policies/` (entire folder) | Replaced by `src/plugins/` |


## Implementation Order

1. Create `src/plugins/` — move `base.ts` and `helpers.ts`
2. Move each policy to `src/plugins/<name>.ts` — decouple from executor (remove all `this.#executor` references, policy becomes pure logic)
3. Create `src/plugins/retry.ts` — new `RetryPolicy` with per-route rules
4. Add `execute` to `FetchLifecycle` in `src/engine/types.ts`
5. Wire `plugins` into `FetchEngine` constructor
6. Gut `executor.ts` to three-phase pipeline
7. Update `src/index.ts` exports, delete `src/policies/`
8. Update tests
9. Update changeset


## Verification

```bash
pnpm build
pnpm test fetch
pnpm test hooks
```
