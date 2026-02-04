---
title: Events
description: Event system and lifecycle management in FetchEngine.
---

# Events


FetchEngine extends ObserverEngine with comprehensive lifecycle events for monitoring requests, configuration changes, and policy activity.

[[toc]]


## Event Names


Events are organized into categories:

**Request Lifecycle:**
- `before-request` - Before each request attempt
- `after-request` - After response is parsed and ready (includes `data`)
- `response` - When raw response is received (before parsing)
- `error` - On request failure
- `retry` - Before retry attempt
- `abort` - When request is aborted

**Property Changes:**
- `header-add` - When header is added
- `header-remove` - When header is removed
- `param-add` - When param is added
- `param-remove` - When param is removed

**State Changes:**
- `state-set` - When state is updated
- `state-reset` - When state is reset

**Configuration Changes:**
- `config-change` - When config is modified
- `modify-config-change` - When modifyConfig function changes
- `modify-method-config-change` - When method-specific modifier changes
- `url-change` - When base URL changes

**Deduplication:**
- `dedupe-start` - New request starts tracking
- `dedupe-join` - Caller joins existing request

**Cache:**
- `cache-hit` - Fresh cache hit
- `cache-stale` - Stale cache hit (SWR)
- `cache-miss` - Cache miss
- `cache-set` - Entry cached
- `cache-revalidate` - SWR revalidation started
- `cache-revalidate-error` - SWR revalidation failed

**Rate Limiting:**
- `ratelimit-wait` - Waiting for token
- `ratelimit-reject` - Request rejected
- `ratelimit-acquire` - Token acquired


## Subscribing to Events


### `on(event, callback)`


Subscribe to events. Returns a cleanup function.

```typescript
// Subscribe to specific event
const cleanup = api.on('error', (data) => {
    console.error('Request failed:', data.error?.message);
});

// Later: cleanup();
```


### `on(/./, callback)`


Subscribe to all events using a regex pattern. Regex listeners receive `{ event, data }` as the first argument.

```typescript
api.on(/./, ({ event, data }) => {
    console.log('Event:', event, data);
});
```


### `once(event, callback)`


Subscribe to event once (auto-removes after first emission).

```typescript
api.once('after-request', (data) => {
    console.log('First request completed');
});
```


### `off(event, callback?)`


Unsubscribe from events.

```typescript
const handler = (data) => console.log(data);

api.on('error', handler);
api.off('error', handler);

// Remove all listeners for an event
api.off('error');
```


## Event Data Types


### Request Lifecycle Events


```typescript
interface EventData<S, H, P> {

    state: S;
    url?: string | URL;
    method?: HttpMethods;
    headers?: DictAndT<H>;
    params?: DictAndT<P>;
    error?: Error | FetchError;
    response?: Response;
    data?: unknown;
    payload?: unknown;
    attempt?: number;
    nextAttempt?: number;
    delay?: number;
    step?: 'fetch' | 'parse' | 'response';
    status?: number;
    path?: string;
    aborted?: boolean;
    requestId?: string;     // Unique ID for this request (consistent across retries)
    requestStart?: number;  // Timestamp (ms) when request entered pipeline
    requestEnd?: number;    // Timestamp (ms) when request resolved
}
```

**Timing fields:**

| Field | Present in | Description |
|-------|-----------|-------------|
| `requestStart` | All request events | `Date.now()` when the request entered the execution pipeline |
| `requestEnd` | `response`, `error`, `abort` | `Date.now()` when the request resolved (success, error, or abort) |

`requestStart` is set once at the beginning of execution and flows through all events via the normalized options. `requestEnd` is only added to terminal events where the request has completed.


### State Events


```typescript
interface StateEventData<S> {

    key?: keyof S;           // Key that was set (for single key updates)
    value?: S[keyof S] | Partial<S>;  // Value that was set
    previous?: S;            // Previous state
    current: S;              // Current state after change
}
```


### Property Events


```typescript
interface PropertyEventData<T> {

    key?: string | string[];  // Key(s) that were added/removed
    value?: string | Partial<T>;  // Value that was set
    method?: HttpMethods;     // HTTP method this applies to
}
```


### Config Events


```typescript
interface OptionsEventData {

    path?: string;    // Path that was changed
    value?: unknown;  // Value that was set
}
```


### Deduplication Events


```typescript
interface DedupeEventData<S, H, P> extends EventData<S, H, P> {

    key: string;           // Deduplication key
    waitingCount?: number; // Number of callers waiting (join events)
}
```


### Cache Events


```typescript
interface CacheEventData<S, H, P> extends EventData<S, H, P> {

    key: string;        // Cache key
    isStale?: boolean;  // Whether entry is stale (SWR)
    expiresIn?: number; // Time until expiration (ms)
}
```


### Rate Limit Events


```typescript
interface RateLimitEventData<S, H, P> extends EventData<S, H, P> {

    key: string;           // Rate limit bucket key
    currentTokens: number; // Current tokens in bucket
    capacity: number;      // Maximum capacity
    waitTimeMs: number;    // Time until next token (ms)
    nextAvailable: Date;   // When next token available
}
```


## Event Examples


### Request Logging


```typescript
api.on('before-request', (data) => {
    console.log(`→ ${data.method} ${data.path}`);
});

api.on('after-request', (data) => {
    console.log(`← ${data.status} ${data.path}`);
});

api.on('error', (data) => {
    console.error(`✗ ${data.status} ${data.path}: ${data.error?.message}`);
});
```


### Distributed Tracing


Use `requestIdHeader` to automatically send the request ID to the server, then use events to correlate client and server logs:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    requestIdHeader: 'X-Request-Id'
});

api.on('before-request', (data) => {
    console.log(`→ [${data.requestId}] ${data.method} ${data.path}`);
});

api.on('after-request', (data) => {
    console.log(`← [${data.requestId}] ${data.status} ${data.path}`);
});

api.on('error', (data) => {
    // Same requestId is available on the server via the X-Request-Id header
    errorReporting.captureException(data.error, {
        tags: { requestId: data.requestId }
    });
});

// Override the request ID per-request to propagate an upstream trace
await api.get('/orders', { requestId: incomingTraceId });
```


### Retry Monitoring


```typescript
api.on('retry', (data) => {
    console.log(`Retrying ${data.path}`);
    console.log(`Attempt ${data.attempt} of ${data.nextAttempt}`);
    console.log(`Waiting ${data.delay}ms`);
});
```


### State Change Tracking


```typescript
api.on('state-set', (data) => {
    console.log('State changed');
    console.log('Key:', data.key);
    console.log('Previous:', data.previous);
    console.log('Current:', data.current);
});
```


### Cache Monitoring


```typescript
api.on('cache-hit', (data) => {
    console.log('Cache hit:', data.key);
    console.log('Expires in:', data.expiresIn, 'ms');
});

api.on('cache-miss', (data) => {
    console.log('Cache miss:', data.key);
});

api.on('cache-stale', (data) => {
    console.log('Stale cache, revalidating:', data.key);
});
```


### Deduplication Monitoring


```typescript
api.on('dedupe-start', (data) => {
    console.log('New request:', data.key);
});

api.on('dedupe-join', (data) => {
    console.log('Joined existing request:', data.key);
    console.log('Waiters:', data.waitingCount);
});
```


### Rate Limit Monitoring


```typescript
api.on('ratelimit-wait', (data) => {
    console.log('Waiting for rate limit');
    console.log('Wait time:', data.waitTimeMs, 'ms');
    console.log('Tokens:', data.currentTokens, '/', data.capacity);
});

api.on('ratelimit-reject', (data) => {
    console.log('Rate limit exceeded');
    console.log('Would have waited:', data.waitTimeMs, 'ms');
});
```


## Lifecycle Management


### `destroy()`


Destroy the FetchEngine instance. Aborts all pending requests and cleans up resources.

```typescript
api.destroy();

// After destroy, requests throw an error
try {
    await api.get('/users');
}
catch (e) {
    console.log(e.message); // "Cannot make requests on destroyed FetchEngine instance"
}
```


### `isDestroyed()`


Check if the engine has been destroyed.

```typescript
if (!api.isDestroyed()) {
    await api.get('/users');
}
```


### React Integration


```typescript
import { useEffect, useRef } from 'react';
import { FetchEngine } from '@logosdx/fetch';

function useApi() {

    const apiRef = useRef<FetchEngine | null>(null);

    useEffect(() => {
        apiRef.current = new FetchEngine({
            baseUrl: '/api'
        });

        // Cleanup on unmount
        return () => {
            apiRef.current?.destroy();
            apiRef.current = null;
        };
    }, []);

    return apiRef;
}
```


## Production Monitoring


```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com'
});

// Error reporting
api.on('error', (data) => {
    errorReporting.captureException(data.error, {
        tags: {
            endpoint: data.path,
            method: data.method,
            status: data.status,
            requestId: data.requestId
        },
        extra: {
            attempt: data.attempt
        }
    });
});

// Metrics — use built-in requestStart/requestEnd timestamps
api.on('response', (data) => {
    metrics.timing('api.request.duration', data.requestEnd - data.requestStart, {
        endpoint: data.path,
        method: data.method,
        status: data.status
    });
});

// Cache metrics
api.on('cache-hit', () => metrics.increment('api.cache.hit'));
api.on('cache-miss', () => metrics.increment('api.cache.miss'));

// Dedupe metrics
api.on('dedupe-join', () => metrics.increment('api.dedupe.saved'));
```
