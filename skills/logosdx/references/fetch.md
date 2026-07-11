---
description: Usage patterns for the @logosdx/fetch package.
globs: '*.ts'
---

# @logosdx/fetch

HTTP client with retry logic, request/response interception, and comprehensive error handling for production applications.

## Table of Contents

- [Core API](#core-api) — Setup, error handling, global instance
- [Built-in Resilience Policies](#built-in-resilience-policies) — Retry, dedupe, cache, rate-limit are config keys — do not reinvent
- [HTTP Methods](#http-methods) — GET/POST/PUT/PATCH/DELETE, FetchPromise, FetchResponse
- [Configuration](#configuration) — Config interface, timeout, retry, validation, policies
- [Error Handling](#error-handling) — FetchError, isFetchError, lifecycle events
- [Headers & Parameters Management](#headers--parameters-management) — set/remove/resolve
- [State Management](#state-management) — Internal state for auth, sessions
- [Event System](#event-system) — All FetchEventNames, event data fields
- [Request Deduplication](#request-deduplication) — Prevent duplicate concurrent requests
- [Response Caching](#response-caching) — TTL and stale-while-revalidate
- [Rate Limiting](#rate-limiting) — Token bucket per-endpoint throttling
- [Timeout Options](#timeout-options) — totalTimeout vs attemptTimeout
- [Response Chaining](#response-chaining) — .json(), .text(), .blob(), .stream()
- [Stream Mode](#stream-mode) — Async iteration over response chunks
- [Advanced Features](#advanced-features) — Custom retry, type determination
- [TypeScript Patterns](#typescript-patterns) — Module augmentation, typed instances
- [Lifecycle Management](#lifecycle-management) — destroy(), cleanup
- [Request Serializers](#request-serializers) — Built-in and custom key generators
- [Policy Architecture](#policy-architecture) — Hook pipeline execution order
- [Plugin Architecture](#plugin-architecture) — Plugin factories, engine.use()

## Core API

```typescript
import { FetchEngine, FetchError, FetchEvent, FetchEventNames, FetchResponse, isFetchError } from '@logosdx/fetch';
import { attempt } from '@logosdx/utils';

// Basic setup
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    defaultType: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData',
    headers: { Authorization: 'Bearer token' },
    totalTimeout: 5000,  // Total timeout for entire operation (including retries)
    attemptTimeout: 2000 // Per-attempt timeout (allows retries on timeout)
});

// Three-channel error handling — every completed exchange (any status)
// resolves. `err` means no response exists at all.
const [res, err] = await attempt(() => api.get<User>('/users/123'));

if (err) {
    // Transport only — attempt()'s tuple types the rejection as a generic
    // Error; FetchEngine only ever rejects with FetchError.
    if (isFetchError(err)) {
        if (err.isCancelled())      return;              // user/app aborted
        if (err.isTimeout())        return retryLater();  // attemptTimeout/totalTimeout
        if (err.isConnectionLost()) return goOffline();    // network/server dropped us
    }
    return badPayload(err); // parse failure on an ok:true body
}

if (!res.ok) {
    // Exchange completed; the server said no. Full response available —
    // status, headers, and data are never destroyed on a non-2xx answer.
    if (res.status === 404) return notFound();
    if (res.status >= 500)  return serverError(res.headers['x-request-id']);
    return;
}

console.log('User:', res.data);  // narrowed to User by the ok check
console.log('Rate limit:', res.headers['x-rate-limit-remaining']);

// Global instance (simplified usage)
import fetch, { get, post, headers, params, state, config, on, off } from '@logosdx/fetch';

// Global instance auto-uses current domain as base URL
const [usersRes, usersErr] = await attempt(() => fetch.get<User[]>('/api/users'));
if (usersErr) return; // transport only
if (!usersRes.ok) { console.error('Status:', usersRes.status); return; }
console.log('Users:', usersRes.data);

// Or use destructured methods
headers.set('Authorization', 'Bearer token');
state.set('userId', '123');
const [userRes, userErr] = await attempt(() => get<User>('/api/users/123'));
if (userErr) return;
if (!userRes.ok) { if (userRes.status === 404) console.warn('User not found'); return; }
```

## Built-in Resilience Policies

**Do not reinvent these.** Retry, request deduplication, response caching, and rate limiting are built into FetchEngine as config keys. Writing a retry loop, an in-flight promise map, a response cache, or a token bucket around a FetchEngine — or importing p-retry, p-queue, or lru-cache to do it — duplicates a one-line config.

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',

    // Retry with exponential backoff (installed by default; tune, don't rewrite)
    retry: { maxAttempts: 3, baseDelay: 150 },

    // Identical concurrent requests share one in-flight promise
    dedupePolicy: true,

    // Response cache: TTL + stale-while-revalidate
    cachePolicy: { ttl: 30000, staleIn: 10000 },

    // Token-bucket rate limiting, per endpoint by default.
    // waitForToken: true parks requests until a token frees; the wait
    // observes totalTimeout/abort and rejects promptly when the caller dies.
    rateLimitPolicy: { maxCalls: 60, windowMs: 60000, waitForToken: true },
});
```

| About to write... | Use instead |
|---|---|
| retry loop / p-retry | `retry` config ([Configuration](#configuration), [Advanced Features](#advanced-features)) |
| in-flight promise map | `dedupePolicy` ([Request Deduplication](#request-deduplication)) |
| response cache / lru-cache / SWR wrapper | `cachePolicy` ([Response Caching](#response-caching)) |
| token bucket / setTimeout throttle / p-queue | `rateLimitPolicy` ([Rate Limiting](#rate-limiting)) |
| a second FetchEngine so endpoints get different limits | `rules` on ONE policy — each matched rule gets its own isolated bucket ([Route Matching](#route-matching)) |
| per-endpoint variants of the above | `rules` on each policy ([Route Matching](#route-matching)) |
| bespoke cross-cutting behavior | a plugin via `engine.use()` ([Plugin Architecture](#plugin-architecture)) |

One engine, many budgets — never instantiate a second FetchEngine just to give an endpoint its own rate limit:

```typescript
// ❌ Two clients to get two limits
const embedApi = new FetchEngine({ baseUrl, rateLimitPolicy: { maxCalls: 10, windowMs: 60000 } });
const queryApi = new FetchEngine({ baseUrl, rateLimitPolicy: { maxCalls: 100, windowMs: 60000 } });

// ✅ One client; rules give each endpoint an isolated bucket and budget
const api = new FetchEngine({
    baseUrl,
    rateLimitPolicy: {
        maxCalls: 100, windowMs: 60000,                        // default budget
        rules: [
            { is: '/v1/embed', maxCalls: 10 },                 // own bucket, own budget
            { is: '/v1/query', maxCalls: 60, waitForToken: false },
            // serializer can split buckets even within one path,
            // e.g. by payload field or user header:
            { is: '/v1/embeddings', serializer: (ctx) => ctx.payload?.input_type ?? 'default' },
        ],
    },
});
```

`rules` is not a rate-limit feature — it is the shared route-matching layer of all three policies. Every rule uses the same matchers (`is` exact-match, `startsWith`, `endsWith`, `includes`, `match` RegExp; AND-combined, except `is` which stands alone) and overrides that policy's own knobs per route: cache TTLs per path, dedupe on/off per path, budgets per path. Serializers are shared the same way ([Request Serializers](#request-serializers)).

Per-call escape hatches (call options, no engine changes needed): `retry: false` disables retries for one request and a per-call `retry` config wins even over an engine-level `retry: false`; `skipCache: true` bypasses the cache in both directions (no lookup, no store); `totalTimeout` / `attemptTimeout` / `abortController` bound any single request. Dedupe and rate-limit have no per-call bypass by design — use their config-level `shouldDedupe(ctx)` / `shouldRateLimit(ctx)` callbacks.

Every policy accepts `boolean | config`, supports per-route `rules`, and exists as a standalone plugin factory (`retryPlugin`, `dedupePlugin`, `cachePlugin`, `rateLimitPlugin`, `cookiePlugin`). Config keys and `plugins: [...]` compose: config keys always apply, and the plugins array adds custom plugins alongside them. A policy can only exist once — passing both a truthy policy config key and its plugin (or the same policy plugin twice) throws at construction. A falsy key (`dedupePolicy: false`) + the same-name plugin warns and installs the plugin. A `retryPlugin(...)` in the array with no explicit `retry` key replaces the auto-installed default retry.

Policies reconfigure at runtime: `api.config.set('retry.maxAttempts', 5)` (or whole-key / merge forms) takes effect on the next request. Validation is pre-mutation — a rejected set (plugins:-owned key, or a `cachePolicy.adapter` change, which is construction-only) leaves the store unchanged. Rate-limit buckets rebuild on reconfigure; the cache store and cookie jar survive. `retry: false` disables retrying but keeps per-attempt timeout machinery: `attemptTimeout` still fires and stamps `timedOut`.

## HTTP Methods

```typescript
// All methods return FetchPromise<FetchResponse<T>>
interface FetchPromise<T, H, P, RH> extends Promise<FetchResponse<T, H, P, RH>> {
    isFinished: boolean;
    isAborted: boolean;
    abort(reason?: string): void;

    // Response chaining — declare expected response type before awaiting
    json(): FetchPromise<T, H, P, RH>;
    text(): FetchPromise<string, H, P, RH>;
    blob(): FetchPromise<Blob, H, P, RH>;
    arrayBuffer(): FetchPromise<ArrayBuffer, H, P, RH>;
    formData(): FetchPromise<FormData, H, P, RH>;
    raw(): FetchPromise<Response, H, P, RH>;
    stream(): FetchStreamPromise<H, P, RH>;
}

// Stream promise supports async iteration over chunks
interface FetchStreamPromise<H, P, RH>
    extends FetchPromise<Response, H, P, RH>, AsyncIterable<Uint8Array> {}

// Discriminated union on `ok` — every completed exchange resolves this way,
// including non-2xx. `data` only types as `T` on the `ok: true` branch; the
// compiler forces a `res.ok` check before `data` can be trusted as `T`.
type FetchResponse<T = any, H = FetchEngine.InstanceHeaders, P = FetchEngine.InstanceParams, RH = FetchEngine.InstanceResponseHeaders> =
    | { ok: true; data: T; headers: Partial<RH>; status: number; request: Request; config: FetchConfig<H, P> }
    | { ok: false; data: unknown; headers: Partial<RH>; status: number; request: Request; config: FetchConfig<H, P> };

// Configuration object with typed headers and params
interface FetchConfig<H = FetchEngine.InstanceHeaders, P = FetchEngine.InstanceParams> {
    baseUrl?: string;
    timeout?: number;
    headers?: H;            // Typed headers from your custom interface
    params?: P;             // Typed params from your custom interface
    retry?: RetryConfig | false;
    method?: string;
    determineType?: any;
}

// HTTP convenience methods - all return FetchPromise (chainable)
api.get<User, RH>(path, options?): FetchPromise<User, H, P, RH>
api.post<User, CreateUserData, RH>(path, payload?, options?): FetchPromise<User, H, P, RH>
api.put<User, UpdateUserData, RH>(path, payload?, options?): FetchPromise<User, H, P, RH>
api.patch<User, Partial<User>, RH>(path, payload?, options?): FetchPromise<User, H, P, RH>
api.delete<void, any, RH>(path, payload?, options?): FetchPromise<void, H, P, RH>
api.options<any, RH>(path, options?): FetchPromise<any, H, P, RH>

// Generic request method
api.request<Response, RequestData, RH>(method, path, options & { payload?: RequestData }): FetchPromise<Response, H, P, RH>

// Request cancellation
const request = api.get('/users');
setTimeout(() => request.abort('User cancelled'), 2000);
```

## Configuration

```typescript
interface FetchEngine.Config<H, P, S> {
    baseUrl: string;
    defaultType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData';

    // Timeout options
    totalTimeout?: number;    // Total timeout for entire request lifecycle (ms)
    attemptTimeout?: number;  // Per-attempt timeout (ms) - allows retries on timeout

    // Headers - global and method-specific
    headers?: Headers<H>;
    methodHeaders?: {
        GET?: Headers<H>;
        POST?: Headers<H>;
        // ... other methods
    };

    // URL parameters - global and method-specific
    params?: Params<P>;
    methodParams?: {
        GET?: Params<P>;
        // ... other methods
    };

    // Retry configuration (set to false to disable retries)
    retry?: {
        maxAttempts?: number; // default: 3
        baseDelay?: number; // default: 1000 (in milliseconds)
        maxDelay?: number; // default: 10000
        useExponentialBackoff?: boolean; // default: true
        retryableStatusCodes?: number[]; // default: [408, 429, 499, 500, 502, 503, 504]
        // Receives a resolved `ok: false` FetchResponse for an HTTP-status
        // retry, or a rejected FetchError for a transport retry — narrow
        // with isFetchError(). Exhausted attempts resolve, never throw.
        shouldRetry?: (outcome: FetchResponse<unknown> | FetchError, attempt: number) => boolean | number;
    } | false;

    // Validation
    validate?: {
        headers?: (headers: Headers<H>, method?: HttpMethods) => void;
        params?: (params: Params<P>, method?: HttpMethods) => void;
        state?: (state: S) => void;
        perRequest?: {
            headers?: boolean;
            params?: boolean;
        };
    };

    // Request ID tracing
    generateRequestId?: () => string;          // Custom ID generator (default: generateId from utils)
    requestIdHeader?: string;                  // Header name for sending requestId to server

    // Response type determination
    determineType?: (response: Response) => 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' | Symbol;

    // Deduplication policy (prevents duplicate concurrent requests)
    dedupePolicy?: boolean | DeduplicationConfig<S, H, P>;

    // Cache policy (caches responses with TTL and SWR support)
    cachePolicy?: boolean | CacheConfig<S, H, P>;

    // Rate limit policy (controls outgoing request rate with token bucket)
    rateLimitPolicy?: boolean | RateLimitConfig<S, H, P>;
}
```

## Error Handling

> **A `FetchError` is thrown/rejected iff no usable response exists** — abort, timeout, connection lost, or a parse failure on an `ok: true` body. Every other completed exchange, including every non-2xx status, **resolves** as a `FetchResponse` with `ok: false`. Narrow transport errors with `isFetchError(err)`; narrow HTTP outcomes with `res.ok`.

```typescript
// Transport-only — no `data`/`T` generic. A completed non-2xx exchange
// never lands here; it resolves as a FetchResponse instead.
interface FetchError<H = FetchEngine.Headers> extends Error {
    status: number;       // 499 for aborts/connection-loss, 999 for parse errors without a status
    method: HttpMethods;
    path: string;
    aborted?: boolean;    // True if request was aborted (any cause)
    timedOut?: boolean;   // True if aborted due to timeout (attemptTimeout or totalTimeout)
    requestId?: string;   // Unique request ID for tracing (consistent across retries)
    attempt?: number;
    step?: 'fetch' | 'parse';
    url?: string;
    headers?: H;          // REQUEST headers, not response headers

    // Convenience methods for distinguishing 499 errors
    isCancelled(): boolean;     // status === 499 && aborted && !timedOut
    isTimeout(): boolean;       // status === 499 && timedOut
    isConnectionLost(): boolean; // status === 499 && step === 'fetch' && !aborted
}

// Three honest channels — err (transport), !res.ok (server said no), res.ok (data)
const [res, err] = await attempt(() => api.get<Products>('/products').json());

if (err) {
    // Transport only — no response exists
    if (isFetchError(err)) {
        if (err.isCancelled())      return; // request was aborted
        if (err.isTimeout())        return retry(); // timed out
        if (err.isConnectionLost()) return offline(); // network down
    }
    return badPayload(err); // parse contract broken on a 2xx
}

if (!res.ok) {
    // Exchange succeeded; the answer was "no" — full response available
    res.headers['retry-after'];    // present — these are RESPONSE headers
    if (res.status === 401) return refreshToken();
    if (res.status === 404) return notFound();
    if (res.status >= 500)  return serverError(res.headers['x-request-id'], res.status);
    return;
}

res.data; // narrowed to Products by the ok check

// Wrapper function pattern — log the outcome for diagnostics either way
async function safeGet<T>(path: string): Promise<T | null> {

    const [res, err] = await attempt(() => api.get(path).json<T>());

    if (err) {
        console.error(`Transport failure on ${path}:`, {
            timedOut: isFetchError(err) && err.isTimeout(),
            cancelled: isFetchError(err) && err.isCancelled(),
            step: isFetchError(err) ? err.step : undefined,
        });
        return null;
    }

    if (!res.ok) {
        console.error(`[${res.status}] ${path} failed:`, res.data);
        return null;
    }

    return res.data;
}

// Lifecycle events — `error` is transport-only; `response`/`response-4xx`/
// `response-5xx` fire for every completed exchange (see Event System)
api.on('error', (event: FetchEvent) => {
    console.error('Transport failure:', event.error);
});

api.on('response-5xx', (event: FetchEvent) => {
    console.error('Server error:', event.status, event.path);
});

api.on('retry', (event: FetchEvent) => {
    // event.outcome is the FetchResponse or FetchError that triggered this retry
    console.log(`Retrying attempt ${event.nextAttempt} after ${event.delay}ms`);
});
```

> **React consumers:** `@logosdx/react`'s `createFetchContext`/`useQuery`/`useMutation`/`useAsync` re-merge these two channels into one `failure: { kind: 'transport', error } | { kind: 'http', response } | null` field — see `skills/logosdx/references/react.md` and `docs/packages/react.md`.

## Headers & Parameters Management

```typescript
// Headers
api.headers.set('Authorization', 'Bearer new-token');
api.headers.set({ 'X-API-Version': 'v2', 'X-Client': 'web' });
api.headers.set('Content-Type', 'application/json', 'POST'); // method-specific
api.headers.remove('Authorization');
api.headers.remove(['X-API-Version', 'X-Client']);
api.headers.has('Authorization'); // boolean

// Parameters
api.params.set('version', 'v1');
api.params.set({ api_key: 'abc123', format: 'json' });
api.params.set('page', '1', 'GET'); // method-specific
api.params.remove('version');
api.params.has('api_key'); // boolean

// Access current configuration
api.headers.defaults;           // Default headers (global)
api.headers.all;                // All headers including method overrides
api.headers.resolve('GET');     // Resolved headers for a specific method

api.params.defaults;            // Default params (global)
api.params.all;                 // All params including method overrides
api.params.resolve('GET');      // Resolved params for a specific method

// With global instance and destructured managers
import { headers, params, config } from '@logosdx/fetch';
headers.set('X-API-Key', 'key123');
params.set('version', 'v1');
```

## State Management

```typescript
// Internal state for auth tokens, user context, etc.
api.state.set('authToken', 'bearer-token-123');
api.state.set({
    userId: '456',
    sessionId: 'abc',
    preferences: { theme: 'dark' }
});

const currentState = api.state.get(); // deep clone
api.state.reset(); // clear all state

// --- Auth token pattern: store token in state, attach via before-request hook ---
// 1. Store the Bearer token in state
api.state.set('authToken', 'my-jwt-token');

// 2. Use a before-request hook to attach it to every outgoing request
api.on('before-request', (event) => {

    const { authToken } = event.state;
    if (authToken) {
        api.headers.set('Authorization', `Bearer ${authToken}`);
    }
});

// Now all requests automatically include the Authorization header.
// To update the token (e.g., after refresh):
api.state.set('authToken', 'refreshed-jwt-token');

// Access response metadata with typed config — narrow on `ok` first
const response = await api.get('/users');
if (response.ok) {
    console.log('Success! Users:', response.data);
    console.log('Request URL:', response.request.url);
    console.log('Config used:', response.config);
    console.log('Rate limit:', response.headers['x-rate-limit-remaining']);
    // response.config.headers is typed as MyHeaders
    // response.config.params is typed as MyParams
    // response.headers is typed as Partial<InstanceResponseHeaders>
}
```

## Event System

```typescript
enum FetchEventNames {
    // Request lifecycle
    'before-request' = 'before-request',
    'after-request' = 'after-request',
    'abort' = 'abort',
    'error' = 'error',              // Transport failure or parse-on-ok:true. Never non-2xx.
    'response' = 'response',        // Every completed exchange, any status
    'response-4xx' = 'response-4xx', // Fires alongside `response` for 400-499
    'response-5xx' = 'response-5xx', // Fires alongside `response` for 500-599
    'retry' = 'retry',

    // Configuration changes
    'header-add' = 'header-add',
    'header-remove' = 'header-remove',
    'param-add' = 'param-add',
    'param-remove' = 'param-remove',
    'state-set' = 'state-set',
    'state-reset' = 'state-reset',
    'url-change' = 'url-change',
    'config-change' = 'config-change',

    // Deduplication events
    'dedupe-start' = 'dedupe-start',   // New request tracked
    'dedupe-join' = 'dedupe-join',     // Caller joined existing

    // Caching events
    'cache-hit' = 'cache-hit',         // Fresh cache hit
    'cache-stale' = 'cache-stale',     // Stale cache hit (SWR)
    'cache-miss' = 'cache-miss',       // No cache entry
    'cache-set' = 'cache-set',         // New cache entry stored
    'cache-revalidate' = 'cache-revalidate',           // SWR background refresh started
    'cache-revalidate-error' = 'cache-revalidate-error', // SWR background refresh failed

    // Rate limiting events
    'ratelimit-wait' = 'ratelimit-wait',       // Waiting for token
    'ratelimit-reject' = 'ratelimit-reject',   // Rejected (waitForToken: false)
    'ratelimit-acquire' = 'ratelimit-acquire', // Token acquired
    'ratelimit-abort' = 'ratelimit-abort'      // Wait ended by abort (terminal pair of ratelimit-wait)
}

// Event listeners (use regex to match all events)
api.on(/./, ({ event, data }) => console.log('Event:', event, data));
api.on('before-request', (event) => console.log('Request starting:', event.url));
api.on('error', (event) => console.error('Transport failure:', event.error));
api.on('response-4xx', (event) => console.warn('Client error:', event.status, event.path));
api.on('response-5xx', (event) => console.error('Server error:', event.status, event.path));
api.off('error', errorHandler); // remove listener

// Event timing — terminal events include requestStart/requestEnd
api.on('response', (event) => {
    const duration = event.requestEnd - event.requestStart;
    console.log(`[${event.requestId}] ${event.method} ${event.path} completed in ${duration}ms`);
});
```

### Event Taxonomy

| Event | Fires when |
|-------|------------|
| `response` | Every completed exchange, any status |
| `response-4xx` | Alongside `response`, status 400-499 |
| `response-5xx` | Alongside `response`, status 500-599 |
| `error` | Transport failure, parse failure on `ok: true`, or client-side rate-limit reject. Never non-2xx. |
| `retry` | Before a retried attempt — `outcome` carries whichever `FetchResponse \| FetchError` triggered it |
| `before-request` / `after-request` | Per attempt, regardless of outcome |

All diagnostic events for a request — across every attempt — carry the same `requestId`, so a retried request's attempts are traceable as one exchange.

### Event Data Fields

Request lifecycle events receive `EventData<S, H, P>`:

```typescript
interface EventData<S, H, P> {
    state: S;
    url?: string | URL;
    method?: HttpMethods;
    headers?: DictAndT<H>;
    params?: DictAndT<P>;
    error?: Error | FetchError;   // Only set on `error`/`abort` (transport)
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
    requestId?: string;      // Unique ID for this request (consistent across retries)
    requestStart?: number;   // Date.now() when request entered pipeline (all request events)
    requestEnd?: number;     // Date.now() when request resolved (response, error, abort only)
}

// `retry` events extend EventData with the outcome that triggered them
interface RetryEventData<S, H, P> extends EventData<S, H, P> {
    outcome: FetchResponse<unknown, DictAndT<H>, DictAndT<P>> | FetchError<DictAndT<H>>;
}
```

| Field | Present in | Description |
|-------|-----------|-------------|
| `requestStart` | All request events | Timestamp when the request entered the execution pipeline |
| `requestEnd` | `response`, `error`, `abort` | Timestamp when the request resolved |
| `requestId` | All request events | Unique ID, consistent across retries of the same request |

## Request Deduplication

Prevents duplicate concurrent requests by sharing the same in-flight promise among callers with identical request keys.

```typescript
// Enable with defaults (GET requests only)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    dedupePolicy: true
});

// Three concurrent calls → one network request
const [user1, user2, user3] = await Promise.all([
    api.get('/users/123'),
    api.get('/users/123'),
    api.get('/users/123')
]);

// Full configuration
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    dedupePolicy: {
        enabled: true,
        methods: ['GET', 'POST'],           // Default: ['GET']
        serializer: (ctx) => `${ctx.method}:${ctx.path}`,
        shouldDedupe: (ctx) => !ctx.payload?.skipDedupe,
        rules: [
            { startsWith: '/admin', enabled: false },
            { startsWith: '/api/v2', serializer: customSerializer }
        ]
    }
});

// Events
api.on('dedupe-start', (e) => console.log('New request:', e.key));
api.on('dedupe-join', (e) => console.log('Joined request:', e.key, 'waiters:', e.waitingCount));
```

### Deduplication Types

```typescript
interface DeduplicationConfig<S, H, P> {
    enabled?: boolean;                              // Default: true
    methods?: HttpMethod[];                         // Default: ['GET']
    serializer?: RequestSerializer<S, H, P>;        // Default: defaultRequestSerializer
    shouldDedupe?: (ctx: RequestKeyOptions) => boolean;  // Dynamic skip
    rules?: DedupeRule[];                           // Route-specific config
}

interface DedupeRule extends MatchTypes {
    methods?: HttpMethod[];
    enabled?: boolean;
    serializer?: RequestSerializer;
}

interface RequestKeyOptions<S, H, P> {
    method: string;
    path: string;
    payload?: unknown;
    headers?: H;
    params?: P;
    state?: S;
}
```

## Response Caching

Cache responses with TTL and stale-while-revalidate (SWR) support.

```typescript
// Enable with defaults (GET requests, 60s TTL)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: true
});

// Full configuration with SWR
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        enabled: true,
        methods: ['GET'],
        ttl: 300000,          // 5 minutes
        staleIn: 60000,       // Stale after 1 minute (triggers background revalidation)
        skip: (ctx) => ctx.path.includes('/realtime'),
        rules: [
            { startsWith: '/static', ttl: 3600000 },  // 1 hour for static
            { startsWith: '/admin', enabled: false }   // No caching for admin
        ]
    }
});

// Cache events
api.on('cache-hit', (e) => console.log('Cache hit:', e.key, 'stale:', e.isStale));
api.on('cache-miss', (e) => console.log('Cache miss:', e.key));
api.on('cache-set', (e) => console.log('Cached:', e.key, 'expires in:', e.expiresIn));
api.on('cache-stale', (e) => console.log('Stale:', e.key));
api.on('cache-revalidate', (e) => console.log('Revalidating:', e.key));

// Cache invalidation API
await api.clearCache();                                    // Clear all
await api.deleteCache(key);                                // Delete specific key
await api.invalidateCache((key) => key.includes('user')); // By predicate
await api.invalidatePath('/users');                        // By path prefix
await api.invalidatePath(/^\/api\/v\d+/);                  // By regex
await api.invalidatePath((key) => key.includes('user'));   // By predicate (custom serializers)
const stats = api.cacheStats();                            // { cacheSize, inflightCount }
```

### Caching Types

```typescript
interface CacheConfig<S, H, P> {
    enabled?: boolean;                              // Default: true
    methods?: HttpMethod[];                         // Default: ['GET']
    ttl?: number;                                   // Default: 60000 (1 minute)
    staleIn?: number;                               // Default: undefined (no SWR)
    serializer?: RequestSerializer<S, H, P>;        // Default: defaultRequestSerializer
    skip?: (ctx: RequestKeyOptions<S, H, P>) => boolean;  // Dynamic skip
    rules?: CacheRule[];                            // Route-specific config
    adapter?: CacheAdapter<unknown>;                // Custom storage backend (Redis, IndexedDB, etc.)
}

interface CacheRule extends MatchTypes {
    methods?: HttpMethod[];
    enabled?: boolean;
    ttl?: number;
    staleIn?: number;
    serializer?: RequestSerializer;
    skip?: (ctx: RequestKeyOptions) => boolean;
}
```

## Rate Limiting

Control outgoing request rates using a token bucket algorithm. Each unique request key gets its own rate limiter, enabling per-endpoint or per-user throttling.

```typescript
// Enable with defaults (100 requests/minute, all methods)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: true
});

// Full configuration
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        enabled: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        maxCalls: 100,            // 100 requests per window
        windowMs: 60000,          // 1 minute window
        waitForToken: true,       // Wait for token (false = reject immediately)
        serializer: (ctx) => `${ctx.method}|${ctx.url.pathname}`,
        shouldRateLimit: (ctx) => !ctx.headers?.['X-Bypass-RateLimit'],
        onRateLimit: (ctx, waitTimeMs) => console.log(`Rate limited, waiting ${waitTimeMs}ms`),
        rules: [
            { startsWith: '/api/search', maxCalls: 10, windowMs: 60000 },  // Stricter for search
            { startsWith: '/api/bulk', waitForToken: false },              // Reject bulk if limited
            { startsWith: '/health', enabled: false }                      // No limits for health checks
        ]
    }
});

// Cache checks run BEFORE rate limiting
// Cached responses return immediately without consuming rate limit tokens

// Events
api.on('ratelimit-wait', (e) => console.log('Waiting for token:', e.key, e.waitTimeMs));
api.on('ratelimit-reject', (e) => console.log('Rate limited:', e.key));
api.on('ratelimit-acquire', (e) => console.log('Token acquired:', e.key, 'remaining:', e.currentTokens));
api.on('ratelimit-abort', (e) => console.log('Wait abandoned by abort:', e.key, 'after', e.waitTimeMs, 'ms'));

// Aborts interrupt the token wait: totalTimeout or a manual abort settles the
// wait promptly, consumes no token, and rejects with FetchError (status 499,
// aborted: true; timedOut: true when totalTimeout caused it).

### Rate Limiting Types

```typescript
interface RateLimitConfig<S, H, P> {
    enabled?: boolean;                              // Default: true
    methods?: HttpMethod[];                         // Default: all methods
    maxCalls?: number;                              // Default: 100
    windowMs?: number;                              // Default: 60000 (1 minute)
    waitForToken?: boolean;                         // Default: true (wait vs reject)
    serializer?: RequestSerializer<S, H, P>;        // Default: defaultRateLimitSerializer
    shouldRateLimit?: (ctx: RequestKeyOptions) => boolean;  // Dynamic bypass
    onRateLimit?: (ctx: RequestKeyOptions, waitTimeMs: number) => void | Promise<void>;
    rules?: RateLimitRule[];                        // Route-specific config
}

interface RateLimitRule extends MatchTypes {
    methods?: HttpMethod[];
    enabled?: boolean;
    maxCalls?: number;
    windowMs?: number;
    waitForToken?: boolean;
    serializer?: RequestSerializer;
}

// Default serializer groups by method + pathname (per-endpoint limiting)
// defaultRateLimitSerializer: (ctx) => `${ctx.method}|${ctx.url.pathname}`
```

### Route Matching

Deduplication, caching, and rate limiting all support flexible route matching:

```typescript
interface MatchTypes {
    is?: string;           // Exact path match
    startsWith?: string;   // Path prefix match
    endsWith?: string;     // Path suffix match
    includes?: string;     // Path contains match
    match?: RegExp;        // Regex match
}

// Multiple match types use AND logic (except 'is' which is exclusive)
const rules = [
    { is: '/users' },                               // Exact match only
    { startsWith: '/api', endsWith: '.json' },      // Must satisfy both
    { includes: 'admin', match: /\/v\d+\// },       // Must satisfy both
];
```

## Timeout Options

FetchEngine provides two timeout types that can be used independently or together:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',

    // totalTimeout: Caps entire operation including all retries
    // When triggered, stops everything immediately
    totalTimeout: 30000,  // 30s max for entire request lifecycle

    // attemptTimeout: Per-attempt timeout (creates fresh controller per attempt)
    // When triggered, that attempt fails but can be retried
    attemptTimeout: 5000, // 5s per attempt

    retry: {
        maxAttempts: 3,
        shouldRetry: (outcome) => isFetchError(outcome) && outcome.status === 499 // Retry on timeout
    }
});

// timeout is deprecated - use totalTimeout instead
// timeout: 5000 is equivalent to totalTimeout: 5000
```

### How They Work Together

```
totalTimeout (parent controller)
    │
    ├── attempt 1: attemptTimeout (child controller 1) → times out → retry
    ├── attempt 2: attemptTimeout (child controller 2) → times out → retry
    └── attempt 3: attemptTimeout (child controller 3) → still running...
                                                          │
totalTimeout fires ─────────────────────────────────────────┘
    → Immediately stops all attempts, no more retries
```

### Distinguishing Abort Causes

FetchError provides helper methods to distinguish between different types of 499 errors:

```typescript
const [, err] = await attempt(() => api.get('/slow'));

if (isFetchError(err)) {
    if (err.isCancelled()) {
        // Manual abort - user navigated away, component unmounted, etc.
        // Don't show error, don't log
        return;
    }

    if (err.isTimeout()) {
        // Our timeout fired (attemptTimeout or totalTimeout)
        toast.warn('Request timed out. Retrying...');
    }
    else if (err.isConnectionLost()) {
        // Server dropped connection or network failed (NOT our abort)
        toast.error('Connection lost. Check your internet.');
    }
}
```

**Helper Methods (all return `false` for non-499 errors):**

| Method | Logic | Use Case |
|--------|-------|----------|
| `isCancelled()` | `status === 499 && aborted && !timedOut` | User/app intentionally cancelled |
| `isTimeout()` | `status === 499 && timedOut` | Our timeout fired |
| `isConnectionLost()` | `status === 499 && step === 'fetch' && !aborted` | Server/network dropped us |

**Raw Property Reference:**

| Scenario | `status` | `aborted` | `timedOut` | `step` |
|----------|----------|-----------|------------|--------|
| Manual abort (`promise.abort()`) | 499 | `true` | `undefined` | `'fetch'` |
| `attemptTimeout` fires | 499 | `true` | `true` | `'fetch'` |
| `totalTimeout` fires | 499 | `true` | `true` | `'fetch'` |
| Server closed connection | 499 | `false` | `undefined` | `'fetch'` |
| Network error | 499 | `false` | `undefined` | `'fetch'` |

## Response Chaining

Declare how the response body should be parsed by chaining a directive method before awaiting. No directive means auto-detection based on content-type (backwards compatible).

```typescript
// Explicit response type via chaining
const user = await api.get<User>('/users/123').json();   // FetchResponse<User>
const html = await api.get('/page').text();              // FetchResponse<string>
const file = await api.get('/file').blob();              // FetchResponse<Blob>
const buf  = await api.get('/binary').arrayBuffer();     // FetchResponse<ArrayBuffer>
const form = await api.get('/form').formData();          // FetchResponse<FormData>
const raw  = await api.get('/endpoint').raw();           // FetchResponse<Response>

// The directive declares the parse type; `data` still narrows on `ok`
if (user.ok) render(user.data); // User

// No directive — auto-parse based on content-type
const auto = await api.get<User>('/users/123');

// Override guard — setting directive twice throws
api.get('/users').json().text(); // throws: 'Response type already set'

// Works with the three-channel pattern — err (transport), !res.ok (server said no)
const [res, err] = await attempt(() => api.get<User>('/users/123').json());
if (err) {
    if (isFetchError(err) && err.isTimeout()) return showRetryPrompt();
    return;
}
if (!res.ok) {
    if (res.status === 404) return showNotFound();
    return;
}
console.log(res.data); // typed as User

// Works with abort
const request = api.get('/slow').json();
setTimeout(() => request.abort('Too slow'), 5000);
```

## Stream Mode

Return raw `Response` objects with unconsumed body streams via `.stream()`. Cache and deduplication are skipped (each caller needs its own readable stream). Rate limiting and lifecycle events still fire normally.

```typescript
// Stream mode via .stream() — supports async iteration
for await (const chunk of api.get('/events').stream()) {
    console.log(new TextDecoder().decode(chunk));
}

// Cache and deduplication are skipped (each caller needs its own stream)
// Rate limiting and lifecycle events still fire normally
// Type: .stream() returns FetchStreamPromise (AsyncIterable<Uint8Array>)
```

## Advanced Features

```typescript
// Disable retries completely
const noRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: false  // No retries at all
});

// Custom retry logic with shouldRetry controlling delays. `outcome` is a
// resolved `ok: false` FetchResponse for an HTTP-status retry, or a
// rejected FetchError for a transport retry — narrow with isFetchError().
const customRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: {
        maxAttempts: 5,
        baseDelay: 1000,  // Base delay for exponential backoff
        shouldRetry: (outcome, attempt) => {

            if (isFetchError(outcome)) return outcome.isConnectionLost();

            // `outcome.headers` are the RESPONSE headers, so retry-after
            // is readable here.
            if (outcome.status === 429) {
                const retryAfter = outcome.headers['retry-after'];
                return retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            }

            // Don't retry client errors
            if (outcome.status >= 400 && outcome.status < 500) {
                return false;
            }

            // Return custom delay for server errors
            if (outcome.status >= 500) {
                // Custom delay calculation overrides exponential backoff
                return Math.min(2000 * attempt, 10000);
            }

            return true;  // Use default exponential backoff
        }
    }
});

// Custom type determination
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    determineType: (response) => {
        if (response.url.includes('/download')) return 'blob';
        if (response.url.includes('/csv')) return 'text';
        return FetchEngine.useDefault; // fall back to built-in detection
    }
});

// Environment switching
api.config.set('baseUrl', 'https://api.staging.com');
```

## TypeScript Patterns

```typescript
// Extend interfaces for type safety
declare module '@logosdx/fetch' {
    namespace FetchEngine {
        interface InstanceHeaders {
            Authorization?: string;
            'Content-Type'?: string;
            'X-API-Key'?: string;
        }

        interface InstanceParams {
            version?: string;
            format?: 'json' | 'xml';
        }

        interface InstanceResponseHeaders extends Record<string, string> {
            'x-rate-limit-remaining'?: string;
            'x-rate-limit-reset'?: string;
            'x-request-id'?: string;
            'content-type'?: string;
        }

        interface InstanceState {
            authToken?: string;
            userId?: string;
            sessionId?: string;
        }
    }
}

// Now both custom instances and global instance use the same types
const api = new FetchEngine<
    FetchEngine.InstanceHeaders,
    FetchEngine.InstanceParams,
    FetchEngine.InstanceState,
    FetchEngine.InstanceResponseHeaders
>({
    baseUrl: 'https://api.example.com',
    validate: {
        headers: (headers) => {
            if (!headers.Authorization) {
                throw new Error('Authorization required');
            }
        },
        state: (state) => {
            if (state.userId && !state.sessionId) {
                throw new Error('Session required with user');
            }
        }
    }
});

// Global instance automatically gets the extended types
import { state, get, put, post, patch, del, options } from '@logosdx/fetch';
state.set('authToken', 'token123'); // Typed

// Response is properly typed with FetchResponse including typed config.
// status/headers/request/config exist on BOTH branches; `data` types as
// `User` only after narrowing on `ok`.
const response = await get<User>('/api/user');
response.status; // ✅ Typed as number
response.headers; // ✅ Typed as Partial<InstanceResponseHeaders>
response.headers['x-rate-limit-remaining']; // ✅ Typed access to response headers
response.request; // ✅ Typed as Request
response.config.headers; // ✅ Typed as InstanceHeaders
response.config.params; // ✅ Typed as InstanceParams

if (response.ok) {
    response.data; // ✅ Typed as User — narrowed by the ok check
}

// Per-request response header typing
interface CustomHeaders {
    'x-custom-header': string;
}

const customResponse = await get<User, CustomHeaders>('/api/user');
customResponse.headers['x-custom-header']; // ✅ Typed — headers exist on both branches
```

## Lifecycle Management

```typescript
// Destroy instances when done (component unmount, app teardown)
api.destroy();
api.isDestroyed(); // true
await api.get('/users'); // throws: "Cannot make requests on destroyed FetchEngine instance"

// on() returns cleanup function; all listeners auto-removed on destroy()
const cleanup = api.on('error', (e) => console.error(e));
cleanup();  // manual removal

// off() for named handler removal
api.off('error', errorHandler);
```

## Request Serializers

Serializers generate unique keys for identifying requests. Used by dedupe, cache, and rate limit policies.

### Built-in Serializers

```typescript
import { endpointSerializer, requestSerializer } from '@logosdx/fetch';

// requestSerializer (Default for Cache & Dedupe)
// Format: method|path+query|payload|stableHeaders
// Only includes stable headers: authorization, accept, accept-language, content-type, accept-encoding
// Excludes dynamic headers: X-Timestamp, X-HMAC-Signature, X-Request-Id, etc.

// endpointSerializer (Default for Rate Limit)
// Format: method|pathname
// Groups all requests to same endpoint regardless of params
```

### Custom Serializers

```typescript
// Custom serializer example: user-scoped rate limiting
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        serializer: (ctx) => `user:${ctx.state?.userId ?? 'anonymous'}`,
        maxCalls: 100
    }
});
```

### Serializer Signature

```typescript
type RequestSerializer<S, H, P> = (ctx: RequestKeyOptions<S, H, P>) => string;
// RequestKeyOptions defined in Deduplication Types above
```

## Policy Architecture

FetchEngine policies share a common architecture for consistent behavior and performance.

### Policy Execution Order

FetchEngine uses a 3-phase hook pipeline powered by `@logosdx/hooks`:

```
beforeRequest (run):
  -30: cache plugin → return cached if hit (skip network entirely)
  -20: rate-limit plugin → wait or reject if exceeded
    0: user hooks

execute (pipe — onion middleware):
  -30: dedupe plugin → join in-flight if exists
  -20: retry plugin → wrap with retry logic
    0: user hooks
  core: actual HTTP call (makeCall)

afterRequest (run):
  -10: cache plugin → store response
    0: user hooks
```

**Key implications:**
- Cached responses don't consume rate limit tokens (cache runs first)
- Rate limiting only gates cache misses
- Dedupe and retry wrap the actual network call via pipe middleware
- Only the request initiator consumes a rate limit token; joiners share the result


## Plugin Architecture

FetchEngine's resilience features are implemented as plugins using `@logosdx/hooks`. Plugins install hooks on the engine's `HookEngine` instance.

### Plugin Factories

```typescript
import { cachePlugin, dedupePlugin, retryPlugin, rateLimitPlugin, cookiePlugin } from '@logosdx/fetch';

// Create plugins
const cache = cachePlugin({ ttl: 300000, staleIn: 60000 });
const dedupe = dedupePlugin(true);
const retry = retryPlugin({ maxAttempts: 3 });
const rateLimit = rateLimitPlugin({ maxCalls: 100, windowMs: 60000 });
const cookies = cookiePlugin();

// Use with FetchEngine
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    plugins: [cache, dedupe, retry, rateLimit, cookies]
});

// Access plugin methods directly
cache.clearCache();
cache.stats();   // { cacheSize, inflightCount }
dedupe.inflightCount();
```

### engine.use(plugin)

Install a plugin at runtime. Returns a cleanup function.

```typescript
const cleanup = api.use(myPlugin);
// Later: cleanup() to uninstall
```


## Cookie Management


```typescript
import { FetchEngine, cookiePlugin } from '@logosdx/fetch';
import type { Cookie, CookieAdapter, CookieConfig } from '@logosdx/fetch';

// Shorthand — in-memory jar, session only
const api = new FetchEngine({ baseUrl: '...', cookies: true });

// Shorthand with config — exclude domains, adjust limits
const api = new FetchEngine({ baseUrl: '...', cookies: { exclude: ['cdn.example.com'] } });

// Explicit plugin — when you need init/flush/jar access
const cookies = cookiePlugin({
    adapter: {
        async load(): Promise<Cookie[]> { return JSON.parse(await redis.get('cookies') ?? '[]'); },
        async save(cookies: Cookie[]): Promise<void> { await redis.set('cookies', JSON.stringify(cookies)); }
    },
    syncOnRequest: true, // re-load from adapter before each request (for shared backends)
});
await cookies.init(); // MUST call before first request when using an adapter

const api = new FetchEngine({ baseUrl: '...', plugins: [cookies] });

// After login — server sets session cookie, plugin captures it automatically
await api.post('/login', credentials);

// Subsequent requests automatically include the Cookie header
await api.get('/me');

// On logout — clear session (non-persistent) cookies
cookies.jar.clearSession();

// Manual jar access
const all: Cookie[]  = cookies.jar.all();
const url            = new URL('https://api.example.com/');
const matching       = cookies.jar.get(url);
cookies.jar.clear();                           // clear all
cookies.jar.clear('example.com');              // clear by domain
cookies.jar.delete('example.com', '/', 'sid'); // delete one cookie

// Graceful shutdown — force any pending coalesced save and await the final write
await cookies.flush();
```

**Persistence flow:**

1. `afterRequest` hook captures `Set-Cookie` → `parseSetCookieHeader()` → `jar.set(cookie)`
2. `CookieJar` fires its `onChange` callback; the plugin's `schedulePersist()` queues a microtask (coalesced — one per tick regardless of burst size)
3. On the microtask, `adapter.save(jar.all())` runs fire-and-forget; errors are swallowed
4. For graceful shutdown, `await cookies.flush()` forces `adapter.save(jar.all())` and surfaces rejection
5. `beforeRequest` hook calls `jar.get(url)` → `serializeCookies()` → injects `Cookie` header. `jar.get()` also bumps `lastAccessTime` on retrieved cookies (RFC 6265 §5.4) which triggers another coalesced save
6. With `syncOnRequest: true`, step 5 first calls `adapter.load()` to refresh the jar

**RFC 6265 compliance:** full — date parser, domain matching, path matching, `Max-Age` > `Expires` precedence, host-only flag, eviction limits (4096 bytes/cookie, 50/domain, 3000 total).

