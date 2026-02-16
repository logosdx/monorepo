---
name: logosdx-fetch-patterns
description: "Use when building HTTP clients with @logosdx/fetch. Covers FetchEngine setup, retry/timeout, request deduplication, caching with SWR, rate limiting, lifecycle events, and AbortablePromise."
license: MIT
metadata:
  author: logosdx
  version: "1.0"
---

## Quick Start

```typescript
import { FetchEngine, isFetchError } from '@logosdx/fetch'
import { attempt } from '@logosdx/utils'

const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    totalTimeout: 5000,
    retry: { maxAttempts: 3, baseDelay: 1000 },
})

// Typed GET with error handling
const [response, err] = await attempt(() => api.get<User[]>('/users'))
if (err) {

    if (isFetchError(err)) console.error(err.status, err.path)
    throw err
}

const users = response.data     // User[]
const limit = response.headers  // typed response headers
```

## Critical Rules

1. **Always wrap requests in `attempt()`.** FetchEngine throws `FetchError` on failure — never use try-catch.
2. **Use `totalTimeout`, not `timeout`.** `totalTimeout` caps the entire operation including retries. `attemptTimeout` is per-attempt. The deprecated `timeout` alias maps to `totalTimeout`.
3. **Use `isFetchError()` for type-safe error handling.** Gives access to `.status`, `.method`, `.path`, `.data`, `.requestId`, and convenience methods like `.isCancelled()`, `.isTimeout()`, `.isConnectionLost()`.
4. **Call `destroy()` on teardown.** Cleans up all listeners and prevents further requests. Check with `api.isDestroyed()`.
5. **Absolute URLs bypass `baseUrl`.** Passing `https://other.com/path` to `api.get()` skips the base URL entirely.

## Core Features

| Feature | Config Key | Default |
|---------|-----------|---------|
| Retry with backoff | `retry: { maxAttempts, baseDelay, useExponentialBackoff }` | 3 attempts, 1s delay, exponential on |
| Request deduplication | `dedupePolicy: true \| { ... }` | Off (enable with `true`) |
| Response caching | `cachePolicy: true \| { ttl, staleIn, ... }` | Off (enable with `true` for 60s TTL) |
| Rate limiting | `rateLimitPolicy: true \| { maxCalls, windowMs, ... }` | Off (enable with `true` for 100/min) |
| Timeouts | `totalTimeout` / `attemptTimeout` | No timeout |

## Setup Workflow

```typescript
// 1. Create engine with policies
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    defaultType: 'json',
    totalTimeout: 10000,
    dedupePolicy: true,
    cachePolicy: { ttl: 60000, staleIn: 30000 },
    retry: { maxAttempts: 3, baseDelay: 1000 },
})

// 2. Set headers/params
api.headers.set('Authorization', 'Bearer token')
api.params.set('version', 'v2')

// 3. Configure dynamic auth
api.config.set('modifyConfig', (opts, state) => {

    if (state.authToken) opts.headers.Authorization = `Bearer ${state.authToken}`
    return opts
})

// 4. Set state
api.state.set({ authToken: 'token-123', userId: '42' })

// 5. Make requests
const [{ data }, err] = await attempt(() => api.get<User>('/me'))
```

## AbortablePromise

```typescript
const request = api.get('/slow-endpoint')

// Check status
request.isFinished  // boolean
request.isAborted   // boolean

// Cancel
request.abort('User navigated away')

// Error distinguishing for 499s
const [, err] = await attempt(() => request)

if (isFetchError(err)) {

    if (err.isCancelled()) { /* user/app aborted */ }
    if (err.isTimeout()) { /* timeout fired */ }
    if (err.isConnectionLost()) { /* network dropped */ }
}
```

## Lifecycle Events

```typescript
api.on('before-request', (e) => console.log('Starting:', e.method, e.path))
api.on('response', (e) => console.log(`${e.method} ${e.path} in ${e.requestEnd - e.requestStart}ms`))
api.on('error', (e) => reportError(e.error))
api.on('retry', (e) => console.log(`Retry ${e.nextAttempt} after ${e.delay}ms`))
api.on('cache-hit', (e) => console.log('Cache hit:', e.key))
```

See full event list and deep-dive configuration in the references below.

## References

- [fetch-config-options.md](references/fetch-config-options.md) — All constructor options, header/param/state management
- [fetch-lifecycle-hooks.md](references/fetch-lifecycle-hooks.md) — Complete event list, event data fields, timing
- [fetch-caching-strategies.md](references/fetch-caching-strategies.md) — Dedup, cache, rate limit policies and recipes
- [fetch-typescript-patterns.md](references/fetch-typescript-patterns.md) — Module augmentation, typed headers/state, response typing
