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

The config options `retry`, `cachePolicy`, `dedupePolicy`, `rateLimitPolicy`, and `cookies` are shorthand that internally create and install the corresponding plugins:

```typescript
// These two are equivalent:
const api1 = new FetchEngine({
    baseUrl: '...',
    cachePolicy: { ttl: 60000 },
    dedupePolicy: true,
    cookies: true,
});

const api2 = new FetchEngine({
    baseUrl: '...',
    plugins: [
        cachePlugin({ ttl: 60000 }),
        dedupePlugin(true),
        cookiePlugin(),
    ]
});
```

For full cookie control (adapter `init()`/`flush()`, direct jar access), use the explicit `plugins` form and hold a reference to the plugin instance.


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
| `cookiePlugin` | `cookies` | `beforeRequest` + `afterRequest` | -25 / -5 | RFC 6265 cookie jar |

See [Policies](./policies) for detailed configuration of each built-in plugin.


### Plugin Execution Order

```
beforeRequest (run):
  -30  cachePlugin     → return cached hit
  -25  cookiePlugin    → inject Cookie header
  -20  rateLimitPlugin → wait or reject
    0  user hooks

execute (pipe):
  -30  dedupePlugin    → join in-flight request
  -20  retryPlugin     → retry with backoff
  core fetch()

afterRequest (run):
  -10  cachePlugin     → store response
   -5  cookiePlugin    → capture Set-Cookie
    0  user hooks
```

Cache checks run first so cached responses skip rate limiting entirely. Dedupe wraps retry so duplicate callers share the retried result.


## Cookie Plugin


The `cookiePlugin` implements a full RFC 6265-compliant cookie jar for `FetchEngine`. It is primarily useful in **Node.js** environments where the native `fetch` has no cookie jar — but it also works in browsers alongside the native jar.


### Basic Usage

The fastest way to enable cookies is the config shorthand:

```typescript
import { FetchEngine } from '@logosdx/fetch';

const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cookies: true,
});

// FetchEngine now automatically captures Set-Cookie response headers
// and sends Cookie request headers on subsequent requests.
await api.post('/auth/login', { email, password });
const { data: profile } = await api.get('/me'); // Cookie header included
```

When you need adapter lifecycle control (`init()`, `flush()`) or direct jar access, use the explicit plugin form:

```typescript
import { FetchEngine, cookiePlugin } from '@logosdx/fetch';

const cookies = cookiePlugin({ adapter: myRedisAdapter });
await cookies.init();

const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    plugins: [cookies],
});

// cookies.jar, cookies.flush() available
```


### Persistence Adapter

Provide a `CookieAdapter` to persist cookies across process restarts, or share them across multiple `FetchEngine` instances (horizontal scaling):

```typescript
import { cookiePlugin } from '@logosdx/fetch';

// Redis example (horizontal scaling)
const cookies = cookiePlugin({
    syncOnRequest: true,  // re-load from Redis before every request
    adapter: {
        async load() {
            const raw = await redis.get('fetch:cookies');
            return raw ? JSON.parse(raw) : [];
        },
        async save(cookies) {
            await redis.set('fetch:cookies', JSON.stringify(cookies));
        }
    }
});

await cookies.init(); // loads from adapter before first request
```

`adapter.save()` is **microtask-coalesced**. Any burst of jar mutations (e.g., a response with multiple `Set-Cookie` headers, or a `jar.load()` call) fires exactly one `adapter.save(jar.all())` per tick. A persistence failure is silently swallowed so it cannot break the request pipeline — if you need error visibility during graceful shutdown, call `await cookies.flush()` which surfaces adapter rejections to the caller.


### Pre-Seeding the Jar

Restore a session without a full adapter — pass cookies directly at construction:

```typescript
const cookies = cookiePlugin({
    cookies: storedSession, // Cookie[] from your own storage
});
```


### Session Cleanup

Session cookies (no `Expires` or `Max-Age`) are cleared on `jar.clearSession()`. Call this on logout:

```typescript
cookies.jar.clearSession();
```


### Graceful Shutdown

Persistence is microtask-coalesced so bursts of mutations only hit your adapter once per tick. On process exit or logout, call `flush()` to force a final save and surface any adapter failures to the caller:

```typescript
process.on('SIGTERM', async () => {

    const [, err] = await attempt(() => cookies.flush());
    if (err) logger.error('cookie flush failed', err);
    process.exit(0);
});
```

Without `flush()`, a mutation that happens in the last tick before exit may be lost because the microtask never runs.


### Excluding Domains

Prevent cookies from being sent or captured for specific hosts (e.g., third-party CDNs):

```typescript
const cookies = cookiePlugin({
    exclude: ['cdn.example.com', /\.cloudfront\.net$/],
});
```


### Direct Jar Access

```typescript
cookies.jar.all()                        // all stored cookies (no access-time update)
cookies.jar.get(new URL('https://...'))  // matching cookies for a URL (bumps lastAccessTime)
cookies.jar.clear()                      // remove all cookies
cookies.jar.clear('example.com')         // remove cookies for a domain
cookies.jar.clearSession()               // remove session (non-persistent) cookies
cookies.jar.delete('example.com', '/', 'session') // remove specific cookie

await cookies.flush()                    // force pending coalesced save (graceful shutdown)
```


### Configuration

```typescript
interface CookieConfig {
    cookies?: Cookie[];              // pre-seed the jar
    adapter?: CookieAdapter;         // persistence adapter
    syncOnRequest?: boolean;         // re-load adapter before every request (default: false)
    exclude?: (string | RegExp)[];   // domains to skip
    maxCookieSize?: number;          // bytes per cookie (default: 4096)
    maxCookiesPerDomain?: number;    // cookies per domain (default: 50)
    maxCookies?: number;             // total cookies (default: 3000)
    httpApi?: boolean;               // false = non-HTTP client, skip httpOnly (default: true)
}
```


### RFC 6265 Compliance

The plugin implements the full RFC 6265 specification:

- Date parsing algorithm (§5.1.1) — lenient tokenizing, not `Date.parse()`
- Domain matching (§5.1.3) — subdomain inclusion, IP address exclusion
- Path matching (§5.1.4) — prefix rules with slash boundaries
- `Set-Cookie` processing (§5.2) — all attributes, `Max-Age` over `Expires` precedence
- Storage model (§5.3) — all 11 fields, duplicate handling, eviction
- `Cookie` header construction (§5.4) — sort by path length, then creation time


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
