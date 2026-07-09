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
- `after-request` - After the raw response is received, for every completed exchange (any status)
- `response` - Fires for every completed exchange, any status — parsed `data` is attached
- `response-4xx` - Fires alongside `response` when `status` is 400-499
- `response-5xx` - Fires alongside `response` when `status` is 500-599
- `error` - Transport failure, parse failure on an `ok: true` body, or client-side rate-limit reject. **Never** a non-2xx status — that resolves instead.
- `retry` - Before a retried attempt; carries the `outcome` (`FetchResponse | FetchError`) that triggered it
- `abort` - When request is aborted

All of these fire **per attempt**. Every event for the same logical request — across every retry attempt — carries the same `requestId`, so a retried request's attempts are traceable as one exchange.

### Event Taxonomy

| Event | Fires when |
|-------|------------|
| `response` | Every completed exchange resolves, any status (2xx, 4xx, 5xx, etc.) |
| `response-4xx` | Alongside `response`, when `status` is in `[400, 500)` |
| `response-5xx` | Alongside `response`, when `status` is in `[500, 600)` |
| `error` | Transport failure (abort, timeout, connection lost), a parse failure on an `ok: true` body, or a client-side rate-limit reject |
| `retry` | Scheduled before a retried attempt — `outcome` is whichever `FetchResponse \| FetchError` triggered it |
| `before-request` / `after-request` | Every attempt, regardless of outcome |

A non-2xx response is not an error under this model — it's a completed exchange. `error` and `response`/`response-4xx`/`response-5xx` are mutually exclusive per attempt: a request either fails to produce a response at all (`error`), or it resolves (`response`, plus the matching status-range event).

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
    error?: Error | FetchError;  // Only set on `error`/`abort` — transport only
    response?: Response;
    data?: unknown;
    payload?: unknown;
    attempt?: number;
    nextAttempt?: number;
    delay?: number;
    step?: 'fetch' | 'parse';
    status?: number;
    path?: string;
    aborted?: boolean;
    requestId?: string;     // Unique ID for this request (consistent across retries)
    requestStart?: number;  // Timestamp (ms) when request entered pipeline
    requestEnd?: number;    // Timestamp (ms) when request resolved
}

// `retry` events extend EventData with the outcome that triggered them
interface RetryEventData<S, H, P> extends EventData<S, H, P> {

    /** The response or error that triggered this retry attempt. */
    outcome: FetchResponse<unknown, DictAndT<H>, DictAndT<P>> | FetchError<DictAndT<H>>;
}
```

**Timing fields:**

| Field | Present in | Description |
|-------|-----------|-------------|
| `requestStart` | All request events | `Date.now()` when the request entered the execution pipeline |
| `requestEnd` | `response`, `response-4xx`, `response-5xx`, `error`, `abort` | `Date.now()` when the request resolved (success, failure, or abort) |

`requestStart` is set once at the beginning of execution and flows through all events via the normalized options. `requestEnd` is only added to terminal events where the request has completed. Every event for a given `requestId` — across every retry attempt of that request — shares the same ID, so log aggregation can reconstruct the full attempt sequence.


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

    /**
     * The cause of a `cache-revalidate-error`: either a transport
     * `FetchError` or a resolved `ok: false` `FetchResponse` — a non-2xx
     * revalidation never throws under resolve-on-response, so the cause
     * isn't always an `Error`. Narrow with `isFetchError(outcome)`.
     */
    outcome?: FetchResponse<unknown, DictAndT<H>, DictAndT<P>> | FetchError<DictAndT<H>>;
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

// `response` fires for every completed exchange, any status
api.on('response', (data) => {
    console.log(`← ${data.status} ${data.path}`);
});

// `error` is transport only — no status to log, the exchange never completed
api.on('error', (data) => {
    console.error(`✗ ${data.path}: ${data.error?.message}`);
});

// Split diagnostics for client vs server errors
api.on('response-4xx', (data) => console.warn(`Client error: ${data.status} ${data.path}`));
api.on('response-5xx', (data) => console.error(`Server error: ${data.status} ${data.path}`));
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

    // `outcome` is whichever FetchResponse | FetchError triggered this retry
    if (isFetchError(data.outcome)) {
        console.log('Triggered by transport failure:', data.outcome.message);
    }
    else {
        console.log('Triggered by status:', data.outcome.status);
    }
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

// SWR revalidation resolved `ok: false` (or the fetch itself failed) —
// the existing stale entry is kept, never overwritten
api.on('cache-revalidate-error', (data) => {
    if (isFetchError(data.outcome)) {
        console.error('Revalidation transport failure:', data.key, data.outcome.message);
        return;
    }
    console.warn('Revalidation got a non-2xx status:', data.key, data.outcome?.status);
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

// Transport failure reporting — abort, timeout, connection lost, parse-on-ok
api.on('error', (data) => {
    errorReporting.captureException(data.error, {
        tags: {
            endpoint: data.path,
            method: data.method,
            step: data.step,
            requestId: data.requestId
        },
        extra: {
            attempt: data.attempt
        }
    });
});

// Server-error reporting — a resolved 5xx is not a thrown error, so it's
// reported off `response-5xx`, not `error`
api.on('response-5xx', (data) => {
    errorReporting.captureMessage(`Server error: ${data.status} ${data.path}`, {
        tags: { endpoint: data.path, method: data.method, status: data.status, requestId: data.requestId }
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
