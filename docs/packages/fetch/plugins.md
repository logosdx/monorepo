---
title: Plugins
description: Extend FetchEngine with reusable plugins that hook into the request lifecycle.
---

# Plugins


Plugins are reusable units of behavior that hook into FetchEngine's request lifecycle. Each plugin registers hooks and returns a cleanup function. FetchEngine ships with four built-in plugins (retry, dedupe, cache, rate-limit) and supports custom plugins.

[[toc]]


## The FetchPlugin Interface


```typescript
interface FetchPlugin<H = unknown, P = unknown, S = unknown> {

    name: string;
    install(engine: FetchEnginePublic<H, P, S>): () => void;
}
```

| Property | Description |
|----------|-------------|
| `name` | String identifier for the plugin |
| `install(engine)` | Receives the engine, registers hooks, returns a cleanup function |

The `engine` parameter exposes `engine.hooks` (to register hooks) and the observer API (to emit events).


## Installing Plugins


### At Construction Time

```typescript
import { FetchEngine, retryPlugin, cachePlugin, dedupePlugin, rateLimitPlugin } from '@logosdx/fetch';

const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    plugins: [
        retryPlugin({ maxAttempts: 3, baseDelay: 1000 }),
        cachePlugin({ ttl: 60000, staleIn: 30000 }),
        dedupePlugin(true),
        rateLimitPlugin({ maxCalls: 100, windowMs: 60000 }),
    ]
});
```


### At Runtime

```typescript
const uninstall = api.use(myPlugin);

// Later, remove the plugin's hooks
uninstall();
```


### Config Shorthand

The config options `retry`, `cachePolicy`, `dedupePolicy`, and `rateLimitPolicy` are shorthand that internally create and install the corresponding plugins:

```typescript
// These two are equivalent:
const api1 = new FetchEngine({
    baseUrl: '...',
    cachePolicy: { ttl: 60000 },
    dedupePolicy: true,
});

const api2 = new FetchEngine({
    baseUrl: '...',
    plugins: [
        cachePlugin({ ttl: 60000 }),
        dedupePlugin(true),
    ]
});
```


## Writing a Custom Plugin


A plugin registers hooks in `install()` and returns a cleanup function.


### Simple Plugin

```typescript
function authPlugin(getToken: () => string): FetchPlugin {

    return {
        name: 'auth',
        install(engine) {

            return engine.hooks.add('beforeRequest', (url, opts, ctx) => {

                const token = getToken();

                ctx.args(url, {
                    ...opts,
                    headers: { ...opts.headers, Authorization: `Bearer ${token}` }
                });
            });
        }
    };
}

// Usage
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    plugins: [authPlugin(() => localStorage.getItem('token')!)]
});
```


### Multi-Hook Plugin

When a plugin registers multiple hooks, return a composite cleanup:

```typescript
function loggingPlugin(): FetchPlugin {

    return {
        name: 'logging',
        install(engine) {

            const cleanups: (() => void)[] = [];

            cleanups.push(
                engine.hooks.add('beforeRequest', (url, opts) => {
                    console.log(`→ ${opts.method} ${url.pathname}`);
                })
            );

            cleanups.push(
                engine.hooks.add('afterRequest', (response, url, opts) => {
                    console.log(`← ${response.status} ${opts.method} ${url.pathname}`);
                })
            );

            return () => {
                for (const cleanup of cleanups) cleanup();
            };
        }
    };
}
```


### Plugin with Priority

Use negative priority to run before user hooks:

```typescript
function corsPlugin(origin: string): FetchPlugin {

    return {
        name: 'cors',
        install(engine) {

            return engine.hooks.add('beforeRequest', (url, opts, ctx) => {

                ctx.args(url, {
                    ...opts,
                    headers: { ...opts.headers, Origin: origin }
                });
            }, { priority: -10 });
        }
    };
}
```


### Plugin with Shared State (HookScope)

Use `ctx.scope` to pass data between `beforeRequest` and `afterRequest`:

```typescript
function timingPlugin(onComplete: (ms: number, path: string) => void): FetchPlugin {

    const START_TIME = Symbol('startTime');

    return {
        name: 'timing',
        install(engine) {

            const cleanups: (() => void)[] = [];

            cleanups.push(
                engine.hooks.add('beforeRequest', (url, opts, ctx) => {
                    ctx.scope.set(START_TIME, Date.now());
                }, { priority: -50 })
            );

            cleanups.push(
                engine.hooks.add('afterRequest', (response, url, opts, ctx) => {

                    const start = ctx.scope.get<number>(START_TIME);

                    if (start) {
                        onComplete(Date.now() - start, opts.path);
                    }
                }, { priority: 50 })
            );

            return () => {
                for (const cleanup of cleanups) cleanup();
            };
        }
    };
}
```


### Execute Middleware Plugin

Wrap the core `fetch()` call using the `execute` pipe hook:

```typescript
function circuitBreakerPlugin(threshold: number): FetchPlugin {

    let failures = 0;
    let circuitOpen = false;

    return {
        name: 'circuit-breaker',
        install(engine) {

            return engine.hooks.add('execute', async (next, opts) => {

                if (circuitOpen) {
                    throw new Error('Circuit breaker is open');
                }

                try {
                    const response = await next();
                    failures = 0;
                    return response;
                }
                catch (err) {
                    failures++;

                    if (failures >= threshold) {
                        circuitOpen = true;
                        setTimeout(() => { circuitOpen = false; failures = 0; }, 30000);
                    }

                    throw err;
                }
            }, { priority: -40 });
        }
    };
}
```


## Built-in Plugins


FetchEngine ships four plugins. Each can be used via config shorthand or imported directly.

| Plugin | Config Shorthand | Hook Phase | Priority | Purpose |
|--------|-----------------|------------|----------|---------|
| `retryPlugin` | `retry` | `execute` (pipe) | -20 | Exponential backoff retry |
| `dedupePlugin` | `dedupePolicy` | `execute` (pipe) | -30 | Deduplicate in-flight requests |
| `cachePlugin` | `cachePolicy` | `beforeRequest` + `afterRequest` | -30 / -10 | Response caching with SWR |
| `rateLimitPlugin` | `rateLimitPolicy` | `beforeRequest` | -20 | Token bucket rate limiting |

See [Policies](./policies) for detailed configuration of each built-in plugin.


### Plugin Execution Order

```
beforeRequest (run):
  -30  cachePlugin     → return cached hit
  -20  rateLimitPlugin → wait or reject
    0  user hooks

execute (pipe):
  -30  dedupePlugin    → join in-flight request
  -20  retryPlugin     → retry with backoff
  core fetch()

afterRequest (run):
  -10  cachePlugin     → store response
    0  user hooks
```

Cache checks run first so cached responses skip rate limiting entirely. Dedupe wraps retry so duplicate callers share the retried result.


## Plugin Lifecycle


Plugins are cleaned up when:

- You call the cleanup function returned by `api.use(plugin)`
- `api.destroy()` is called (cleans up all plugins)

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    plugins: [authPlugin(getToken), loggingPlugin()]
});

// All plugin hooks are removed
api.destroy();
```
