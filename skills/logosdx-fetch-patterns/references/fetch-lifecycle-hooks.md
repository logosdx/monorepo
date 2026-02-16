# FetchEngine Lifecycle Events

## Event List

### Request Lifecycle

| Event | When | Key Fields |
|-------|------|------------|
| `before-request` | Before network call | `url`, `method`, `headers`, `params`, `requestId`, `requestStart` |
| `after-request` | After network call resolves | `url`, `method`, `response`, `requestId`, `requestStart` |
| `response` | Successful response parsed | `data`, `status`, `requestId`, `requestStart`, `requestEnd` |
| `error` | Request failed | `error`, `status`, `step`, `attempt`, `requestId`, `requestStart`, `requestEnd` |
| `retry` | Before retry attempt | `error`, `nextAttempt`, `delay`, `requestId` |
| `abort` | Request aborted | `aborted`, `requestId`, `requestStart`, `requestEnd` |

### Configuration Changes

| Event | When |
|-------|------|
| `header-add` | Header added or changed |
| `header-remove` | Header removed |
| `param-add` | Parameter added or changed |
| `param-remove` | Parameter removed |
| `state-set` | State updated |
| `state-reset` | State cleared |
| `url-change` | Base URL changed |
| `config-change` | Config value changed |
| `modify-config-change` | modifyConfig function changed |
| `modify-method-config-change` | modifyMethodConfig changed |

### Policy Events

| Event | When |
|-------|------|
| `dedupe-start` | New request tracked for dedup |
| `dedupe-join` | Caller joined an existing in-flight request |
| `cache-hit` | Fresh cache entry found |
| `cache-stale` | Stale cache entry found (SWR) |
| `cache-miss` | No cache entry |
| `cache-set` | New entry stored in cache |
| `cache-revalidate` | SWR background refresh started |
| `cache-revalidate-error` | SWR background refresh failed |
| `ratelimit-wait` | Waiting for rate limit token |
| `ratelimit-reject` | Rejected (waitForToken: false) |
| `ratelimit-acquire` | Rate limit token acquired |

## Event Data Shape

```typescript
interface EventData<S, H, P> {
    state: S
    url?: string | URL
    method?: HttpMethods
    headers?: H
    params?: P
    error?: Error | FetchError
    response?: Response
    data?: unknown
    payload?: unknown
    attempt?: number
    nextAttempt?: number
    delay?: number
    step?: 'fetch' | 'parse' | 'response'
    status?: number
    path?: string
    aborted?: boolean
    requestId?: string      // Unique ID, consistent across retries
    requestStart?: number   // Date.now() when request entered pipeline
    requestEnd?: number     // Date.now() when request resolved
}
```

## Subscribing to Events

```typescript
// Single event — returns cleanup function
const cleanup = api.on('error', (event) => {
    reportError(event.error, event.requestId)
})

// Regex matching — all events
api.on(/./, ({ event, data }) => {
    console.log(`[${event}]`, data)
})

// Remove listener
api.off('error', errorHandler)

// Cleanup approaches
cleanup()        // remove single listener
api.destroy()    // remove all listeners + prevent future requests
```

## Timing Example

```typescript
api.on('response', (event) => {

    const duration = event.requestEnd - event.requestStart
    console.log(`[${event.requestId}] ${event.method} ${event.path} → ${event.status} in ${duration}ms`)
})

api.on('error', (event) => {

    const duration = event.requestEnd - event.requestStart
    console.error(`[${event.requestId}] ${event.method} ${event.path} failed after ${duration}ms (attempt ${event.attempt})`)
})
```

## Listener Cleanup

```typescript
// Option 1: on() returns cleanup — auto-removed on destroy()
const cleanup1 = api.on('error', handler)
const cleanup2 = api.on('response', handler)
api.destroy()  // both removed automatically

// Option 2: Manual off()
api.on('error', errorHandler)
api.off('error', errorHandler)

// Option 3: AbortController for fine-grained control
const controller = new AbortController()
api.addEventListener('error', handler, { signal: controller.signal })
controller.abort()  // removes all listeners tied to this controller
```
