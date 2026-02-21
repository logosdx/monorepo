---
description: Usage patterns for the @logosdx/fetch package.
globs: *.ts
---

# @logosdx/fetch

HTTP client with retry logic, request/response interception, and comprehensive error handling for production applications.

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

// Error handling pattern
const [response, err] = await attempt(() => api.get('/users/123'));
if (err) {
    console.error('Request failed:', err.status, err.message);
    return;
}

const { data: user } = response;
console.log('User:', user);
console.log('Rate limit:', response.headers['x-rate-limit-remaining']);

// Global instance (simplified usage)
import fetch, { get, post, headers, params, state, config, on, off } from '@logosdx/fetch';

// Global instance auto-uses current domain as base URL
const [{ data: users }, err] = await attempt(() => fetch.get('/api/users'));

// Or use destructured methods
headers.set('Authorization', 'Bearer token');
state.set('userId', '123');
const [{ data: user }, err] = await attempt(() => get('/api/users/123'));

// Smart URL handling - absolute URLs bypass base URL
const [{ data: external }, err] = await attempt(() => get('https://api.external.com/data'));
```

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

// Enhanced response object with typed headers, params, and response headers
interface FetchResponse<T = any, H = FetchEngine.InstanceHeaders, P = FetchEngine.InstanceParams, RH = FetchEngine.InstanceResponseHeaders> {
    data: T;                // Parsed response body
    headers: Partial<RH>;   // Response headers as typed plain object
    status: number;         // HTTP status code
    request: Request;       // Original request object
    config: FetchConfig<H, P>;  // Typed configuration used for request
}

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
        retryableStatusCodes?: number[]; // default: [408, 429, 500, 502, 503, 504]
        shouldRetry?: (error: FetchError, attempt: number) => boolean | number;
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

```typescript
interface FetchError<T = {}, H = FetchEngine.Headers> extends Error {
    data: T | null;
    status: number;
    method: HttpMethods;
    path: string;
    aborted?: boolean;    // True if request was aborted (any cause)
    timedOut?: boolean;   // True if aborted due to timeout (attemptTimeout or totalTimeout)
    requestId?: string;   // Unique request ID for tracing (consistent across retries)
    attempt?: number;
    step?: 'fetch' | 'parse' | 'response';
    url?: string;
    headers?: H;

    // Convenience methods for distinguishing 499 errors
    isCancelled(): boolean;     // status === 499 && aborted && !timedOut
    isTimeout(): boolean;       // status === 499 && timedOut
    isConnectionLost(): boolean; // status === 499 && step === 'fetch' && !aborted
}

// Error checking - FetchError is thrown on failure
if (isFetchError(error)) {
    console.log('Fetch error:', error.status, error.step);
    console.log('Failed URL:', error.url);
    console.log('Response data (if any):', error.data);
}

// Lifecycle events
api.on('error', (event: FetchEvent) => {
    console.error('Request failed:', event.error);
});

api.on('retry', (event: FetchEvent) => {
    console.log(`Retrying attempt ${event.nextAttempt} after ${event.delay}ms`);
});
```

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

// Access response metadata with typed config
const response = await api.get('/users');
if (response.status === 200) {
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
    'error' = 'error',
    'response' = 'response',
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
    'ratelimit-acquire' = 'ratelimit-acquire'  // Token acquired
}

// Event listeners (use regex to match all events)
api.on(/./, ({ event, data }) => console.log('Event:', event, data));
api.on('before-request', (event) => console.log('Request starting:', event.url));
api.on('error', (event) => console.error('Request failed:', event.error));
api.off('error', errorHandler); // remove listener

// Event timing — terminal events include requestStart/requestEnd
api.on('response', (event) => {
    const duration = event.requestEnd - event.requestStart;
    console.log(`[${event.requestId}] ${event.method} ${event.path} completed in ${duration}ms`);
});
```

### Event Data Fields

Request lifecycle events receive `EventData<S, H, P>`:

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
    requestId?: string;      // Unique ID for this request (consistent across retries)
    requestStart?: number;   // Date.now() when request entered pipeline (all request events)
    requestEnd?: number;     // Date.now() when request resolved (response, error, abort only)
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
```

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

### Regex Performance Warning (ReDoS)

Route matching runs on **every request**. Poorly written regex can cause catastrophic backtracking:

```typescript
// ❌ DANGEROUS: Nested quantifiers, exponential backtracking
{ match: /(a+)+b/ }
{ match: /^\/api\/v\d+\/.*$/ }     // .* with anchors can backtrack
{ match: /(\w+)*@/ }

// ✅ SAFE: Simple patterns, no nesting
{ match: /^\/v\d+\/users/ }
{ match: /\/users\/\d+$/ }

// ✅ BETTER: Use string matchers (faster, no ReDoS risk)
{ startsWith: '/api/v2' }          // Instead of /^\/api\/v2/
{ endsWith: '.json' }              // Instead of /\.json$/
{ includes: '/users/' }            // Instead of /\/users\//
```

**Best practice:** Prefer string-based matchers over regex. Only use `match` when strings can't express what you need.

### Independent Timeout Per Caller

When deduplicating, each caller can have independent timeout/abort constraints:

```typescript
// Caller A: 10s timeout
const promiseA = api.get('/slow', { totalTimeout: 10000 });

// Caller B: 2s timeout (joins A's request)
const promiseB = api.get('/slow', { totalTimeout: 2000 });

// After 2s, B times out → A continues waiting
// Request completes at 5s → A gets the result, B already rejected
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
        shouldRetry: (error) => error.status === 499 // Retry on timeout
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
const { data: user } = await api.get<User>('/users/123').json();
const { data: html } = await api.get('/page').text();
const { data: file } = await api.get('/file').blob();
const { data: buf } = await api.get('/binary').arrayBuffer();
const { data: form } = await api.get('/form').formData();
const { data: res } = await api.get('/endpoint').raw();

// No directive — auto-parse based on content-type (backwards compatible)
const { data: auto } = await api.get<User>('/users/123');

// Override guard — setting directive twice throws
api.get('/users').json().text(); // throws: 'Response type already set'

// Works with error handling
const [response, err] = await attempt(() => api.get<User>('/users/123').json());
if (err) return handleError(err);
console.log(response.data); // typed as User

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

// With error handling
const [response, err] = await attempt(() => api.get('/events').stream());
if (!err) {
    const reader = response.data.body.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log(new TextDecoder().decode(value));
    }
}

// Works with all HTTP methods
const [response, err] = await attempt(() =>
    api.post('/upload-stream', largePayload).stream()
);

// Type signature: .stream() returns FetchStreamPromise (async iterable)
// api.get('/path').stream(): FetchStreamPromise<H, P, RH>
```

## Advanced Features

```typescript
// Disable retries completely
const noRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: false  // No retries at all
});

// Accept default retry configs
const noRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: true || {}  // Accept default retry configs
});

// Custom retry logic with shouldRetry controlling delays
const customRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: {
        maxAttempts: 5,
        baseDelay: 1000,  // Base delay for exponential backoff
        shouldRetry: (error, attempt) => {
            // Return custom delay in milliseconds for rate limits
            if (error.status === 429) {
                const retryAfter = error.headers?.['retry-after'];
                return retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            }

            // Don't retry client errors
            if (error.status >= 400 && error.status < 500) {
                return false;
            }

            // Return custom delay for server errors
            if (error.status >= 500) {
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

// Per-request options
const [response, err] = await attempt(() =>
    api.get('/users', {
        totalTimeout: 30000,
        attemptTimeout: 10000,
        headers: { 'X-Request-ID': '123' },
        params: { include: 'profile' },
        requestId: 'upstream-trace-id',  // Override auto-generated request ID
        // Use .stream() chaining for raw Response with unconsumed body
        retry: { maxAttempts: 5 }
    })
);

if (!err) {
    console.log('Users:', response.data);
    console.log('Rate limit remaining:', response.headers['x-rate-limit-remaining']);
    console.log('Request ID:', response.headers['x-request-id']);
}
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

// Response is properly typed with FetchResponse including typed config
const response = await get<User>('/api/user');
response.data; // ✅ Typed as User
response.status; // ✅ Typed as number
response.headers; // ✅ Typed as Partial<InstanceResponseHeaders>
response.headers['x-rate-limit-remaining']; // ✅ Typed access to response headers
response.request; // ✅ Typed as Request
response.config.headers; // ✅ Typed as InstanceHeaders
response.config.params; // ✅ Typed as InstanceParams

// Per-request response header typing
interface CustomHeaders {
    'x-custom-header': string;
}

const customResponse = await get<User, CustomHeaders>('/api/user');
customResponse.headers['x-custom-header']; // ✅ Typed
```

## Lifecycle Management

```typescript
// Memory leak prevention - destroy instances when done
const api = new FetchEngine({ baseUrl: 'https://api.example.com' });

// Use the instance...
await api.get('/users');

// Clean up when no longer needed (component unmount, app teardown)
api.destroy();

// Attempting requests after destroy throws error
api.isDestroyed(); // true
await api.get('/users'); // throws: "Cannot make requests on destroyed FetchEngine instance"

// Listener cleanup - Option 1: Use on() with cleanup function (recommended)
// Listeners added via on() are automatically removed when destroy() is called
const cleanup1 = api.on('error', (e) => console.error(e));
const cleanup2 = api.on('response', (e) => console.log(e));

// Manual cleanup (if you stored the cleanup functions)
cleanup1();
cleanup2();

// Or just call destroy() - automatically removes all listeners added via on()
api.destroy();

// Listener cleanup - Option 2: Use off() for manual removal
const errorHandler = (e) => console.error(e);
const responseHandler = (e) => console.log(e);

api.on('error', errorHandler);
api.on('response', responseHandler);

// Remove specific listeners manually
api.off('error', errorHandler);
api.off('response', responseHandler);
api.destroy();

// Listener cleanup - Option 3: Use addEventListener with your own AbortController
// For advanced use cases where you need fine-grained control
const controller = new AbortController();

api.addEventListener('error', errorHandler, { signal: controller.signal });
api.addEventListener('response', responseHandler, { signal: controller.signal });

// Remove all listeners at once
controller.abort();
api.destroy();

// Component lifecycle integration (simplest approach)
class MyComponent {
    constructor() {
        this.api = new FetchEngine({ baseUrl: 'https://api.example.com' });

        // on() returns cleanup function and automatically cleaned on destroy()
        this.cleanups = [
            this.api.on('error', this.handleError),
            this.api.on('response', this.handleResponse)
        ];
    }

    async fetchData() {
        if (this.api.isDestroyed()) {
            throw new Error('API instance destroyed');
        }
        return this.api.get('/data');
    }

    destroy() {
        // Option 1: Just destroy - automatically removes listeners added via on()
        this.api.destroy();

        // Option 2: Manually cleanup first (if you stored cleanup functions)
        // this.cleanups.forEach(cleanup => cleanup());
        // this.api.destroy();

        this.api = null;
    }
}
```

## Production Patterns

```typescript
// Resilient API client with caching and deduplication
const api = new FetchEngine({
    baseUrl: process.env.API_BASE_URL,
    defaultType: 'json',
    totalTimeout: 5000,

    // Distributed tracing - sends requestId as header to server
    requestIdHeader: 'X-Request-Id',

    // Deduplication - prevent duplicate concurrent requests
    dedupePolicy: {
        enabled: true,
        methods: ['GET'],
        rules: [
            { startsWith: '/realtime', enabled: false }  // Disable for realtime endpoints
        ]
    },

    // Caching with stale-while-revalidate
    cachePolicy: {
        enabled: true,
        methods: ['GET'],
        ttl: 60000,           // 1 minute
        staleIn: 30000,       // Stale after 30 seconds
        rules: [
            { startsWith: '/static', ttl: 3600000 },  // 1 hour for static
            { startsWith: '/user/me', ttl: 300000 },  // 5 minutes for user profile
            { includes: '/realtime', enabled: false }  // No caching for realtime
        ]
    },

    retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        useExponentialBackoff: true,
        shouldRetry: (error) => error.status >= 500 && !error.aborted
    },

    validate: {
        headers: (headers) => {
            if (!headers.Authorization && process.env.NODE_ENV === 'production') {
                throw new Error('Auth required in production');
            }
        }
    }
});

// Global error handling
api.on('error', (event) => {
    // Log to monitoring service
    console.error('API Error:', {
        url: event.url,
        status: event.error?.status,
        attempt: event.attempt,
        method: event.method
    });
});

api.on('retry', (event) => {
    console.log(`Retry ${event.nextAttempt}/${api.config.get('retry.maxAttempts')} after ${event.delay}ms`);
});

// Dynamic state management
api.state.set('authToken', await getAuthToken());

// Environment switching
if (process.env.NODE_ENV === 'development') {
    api.config.set('baseUrl', 'https://api.dev.com');
}

// FetchPromise with timeout
const request = api.get('/long-running-task');
const timeoutId = setTimeout(() => {
    if (!request.isFinished) request.abort('Timeout');
}, 30000);

const [response, err] = await attempt(() => request);
clearTimeout(timeoutId);
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
// User-scoped rate limiting
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        serializer: (ctx) => `user:${ctx.state?.userId ?? 'anonymous'}`,
        maxCalls: 100
    }
});

// Tenant-scoped caching
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        serializer: (ctx) => `${ctx.headers?.['X-Tenant-ID'] ?? 'default'}|${ctx.method}|${ctx.url.pathname}`,
        ttl: 60000
    }
});

// Per-rule serializer override
{
    cachePolicy: {
        rules: [
            { is: '/graphql', serializer: (ctx) => `graphql:${ctx.payload?.operationName}` }
        ]
    }
}
```

### Serializer Signature

```typescript
type RequestSerializer<S, H, P> = (ctx: RequestKeyOptions<S, H, P>) => string;

interface RequestKeyOptions<S, H, P> {
    method: string;      // HTTP method (uppercase)
    path: string;        // Original path
    url: URL;            // Full URL object
    payload?: unknown;   // Request body
    headers?: H;         // Request headers
    params?: P;          // URL parameters
    state?: S;           // Instance state
}
```

## Policy Architecture

FetchEngine policies share a common architecture for consistent behavior and performance.

### Three-Method Pattern

```
ResiliencePolicy
├── init(config)    → Parse config, validate rules, setup state (O(1))
├── resolve(...)    → Memoized lookup + dynamic skip checks (O(1) amortized)
└── compute(...)    → Rule matching, cached per method:path (O(n) first call only)
```

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

### Rule Matching

Rules evaluated in declaration order, first match wins:

```typescript
rules: [
    { is: '/users', ttl: 30000 },           // Exact match first
    { startsWith: '/users', ttl: 60000 },   // Prefix second
    { match: /^\/users/, ttl: 120000 }      // Regex third
]
```

### Policy State

```typescript
interface PolicyInternalState {
    enabled: boolean;                    // Global enable/disable
    methods: Set<string>;                // Applicable HTTP methods
    serializer: RequestSerializer;       // Key generation function
    rulesCache: Map<string, Rule | null>; // Memoized rule lookups
}
```

## Plugin Architecture

FetchEngine's resilience features are implemented as plugins using `@logosdx/hooks`. Plugins install hooks on the engine's `HookEngine` instance.

### Plugin Factories

```typescript
import { cachePlugin, dedupePlugin, retryPlugin, rateLimitPlugin } from '@logosdx/fetch';

// Create plugins
const cache = cachePlugin({ ttl: 300000, staleIn: 60000 });
const dedupe = dedupePlugin(true);
const retry = retryPlugin({ maxAttempts: 3 });
const rateLimit = rateLimitPlugin({ maxCalls: 100, windowMs: 60000 });

// Use with FetchEngine
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    plugins: [cache, dedupe, retry, rateLimit]
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

### FetchPlugin Interface

```typescript
interface FetchPlugin<H, P, S> {
    name: string;
    install(engine: FetchEnginePublic<H, P, S>): () => void;
}
```

### Backward Compatibility

Legacy config options (`cachePolicy`, `dedupePolicy`, `rateLimitPolicy`, `retry`) are automatically converted to plugins internally. The `plugins` config option takes precedence.