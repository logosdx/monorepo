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
    timeout: 5000
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
import fetch, { get, post, setState, addHeader } from '@logosdx/fetch';

// Global instance auto-uses current domain as base URL
const [{ data: users }, err] = await attempt(() => fetch.get('/api/users'));

// Or use destructured methods
addHeader('Authorization', 'Bearer token');
setState('userId', '123');
const [{ data: user }, err] = await attempt(() => get('/api/users/123'));

// Smart URL handling - absolute URLs bypass base URL
const [{ data: external }, err] = await attempt(() => get('https://api.external.com/data'));
```

## HTTP Methods

```typescript
// All methods return AbortablePromise<FetchResponse<T>>
interface AbortablePromise<T> extends Promise<T> {
    isFinished: boolean;
    isAborted: boolean;
    abort(reason?: string): void;
}

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

// HTTP convenience methods - all return FetchResponse with typed config and response headers
api.get<User, RH>(path, options?): AbortablePromise<FetchResponse<User, H, P, RH>>
api.post<User, CreateUserData, RH>(path, payload?, options?): AbortablePromise<FetchResponse<User, H, P, RH>>
api.put<User, UpdateUserData, RH>(path, payload?, options?): AbortablePromise<FetchResponse<User, H, P, RH>>
api.patch<User, Partial<User>, RH>(path, payload?, options?): AbortablePromise<FetchResponse<User, H, P, RH>>
api.delete<void, any, RH>(path, payload?, options?): AbortablePromise<FetchResponse<void, H, P, RH>>
api.options<any, RH>(path, options?): AbortablePromise<FetchResponse<any, H, P, RH>>

// Generic request method
api.request<Response, RequestData, RH>(method, path, options & { payload?: RequestData }): AbortablePromise<FetchResponse<Response, H, P, RH>>

// Request cancellation
const request = api.get('/users');
setTimeout(() => request.abort('User cancelled'), 2000);

// Dynamic request modification
api.changeModifyOptions(fn?: (opts: RequestOpts, state: S) => RequestOpts)
api.changeModifyMethodOptions(method: HttpMethods, fn?: (opts: RequestOpts, state: S) => RequestOpts)
```

## Configuration

```typescript
interface FetchEngine.Options<H, P, S> {
    baseUrl: string;
    defaultType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData';

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

    // Request modification (initial setup)
    modifyOptions?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
    modifyMethodOptions?: {
        GET?: (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;
        // ... other methods
    };
    // Note: Use changeModifyOptions() and changeModifyMethodOptions() for runtime changes

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
    aborted?: boolean;
    attempt?: number;
    step?: 'fetch' | 'parse' | 'response';
    url?: string;
    headers?: H;
}

// Error checking - FetchError is thrown on failure
if (isFetchError(error)) {
    console.log('Fetch error:', error.status, error.step);
    console.log('Failed URL:', error.url);
    console.log('Response data (if any):', error.data);
}

// Lifecycle events
api.on('fetch-error', (event: FetchEvent) => {
    console.error('Request failed:', event.error);
});

api.on('fetch-retry', (event: FetchEvent) => {
    console.log(`Retrying attempt ${event.nextAttempt} after ${event.delay}ms`);
});
```

## Headers & Parameters Management

```typescript
// Headers
api.addHeader('Authorization', 'Bearer new-token');
api.addHeader({ 'X-API-Version': 'v2', 'X-Client': 'web' });
api.addHeader('Content-Type', 'application/json', 'POST'); // method-specific
api.rmHeader('Authorization');
api.rmHeader(['X-API-Version', 'X-Client']);
api.hasHeader('Authorization'); // boolean

// Parameters
api.addParam('version', 'v1');
api.addParam({ api_key: 'abc123', format: 'json' });
api.addParam('page', '1', 'GET'); // method-specific
api.rmParams('version');
api.hasParam('api_key'); // boolean

// Access current configuration
const { default: globalHeaders, get: getHeaders } = api.headers;
const { default: globalParams, get: getParams } = api.params;

// With global instance and destructured methods
import { addHeader, addParam, rmHeader, hasHeader, changeModifyOptions, changeModifyMethodOptions } from '@logosdx/fetch';
addHeader('X-API-Key', 'key123');
addParam('version', 'v1');

// Dynamic request modification
changeModifyOptions((opts, state) => {
    opts.headers['X-Request-ID'] = crypto.randomUUID();
    return opts;
});

changeModifyMethodOptions('POST', (opts, state) => {
    opts.headers['Content-Type'] = 'application/json';
    return opts;
});
```

## State Management

```typescript
// Internal state for auth tokens, user context, etc.
api.setState('authToken', 'bearer-token-123');
api.setState({
    userId: '456',
    sessionId: 'abc',
    preferences: { theme: 'dark' }
});

const state = api.getState(); // deep clone
api.resetState(); // clear all state

// Use state in request modification
const api = new FetchEngine<MyHeaders, MyParams, MyState>({
    baseUrl: 'https://api.example.com',
    modifyOptions: (opts, state) => {
        if (state.authToken) {
            opts.headers.Authorization = `Bearer ${state.authToken}`;
        }
        return opts;
    }
});

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
    'fetch-before' = 'fetch-before',
    'fetch-after' = 'fetch-after',
    'fetch-abort' = 'fetch-abort',
    'fetch-error' = 'fetch-error',
    'fetch-response' = 'fetch-response',
    'fetch-retry' = 'fetch-retry',

    // Configuration changes
    'fetch-header-add' = 'fetch-header-add',
    'fetch-header-remove' = 'fetch-header-remove',
    'fetch-param-add' = 'fetch-param-add',
    'fetch-param-remove' = 'fetch-param-remove',
    'fetch-state-set' = 'fetch-state-set',
    'fetch-state-reset' = 'fetch-state-reset',
    'fetch-url-change' = 'fetch-url-change',
    'fetch-modify-options-change' = 'fetch-modify-options-change',
    'fetch-modify-method-options-change' = 'fetch-modify-method-options-change',

    // Deduplication events
    'fetch-dedupe-start' = 'fetch-dedupe-start',   // New request tracked
    'fetch-dedupe-join' = 'fetch-dedupe-join',     // Caller joined existing

    // Caching events
    'fetch-cache-hit' = 'fetch-cache-hit',         // Fresh cache hit
    'fetch-cache-stale' = 'fetch-cache-stale',     // Stale cache hit (SWR)
    'fetch-cache-miss' = 'fetch-cache-miss',       // No cache entry
    'fetch-cache-set' = 'fetch-cache-set',         // New cache entry stored
    'fetch-cache-revalidate' = 'fetch-cache-revalidate',           // SWR background refresh started
    'fetch-cache-revalidate-error' = 'fetch-cache-revalidate-error', // SWR background refresh failed

    // Rate limiting events
    'fetch-ratelimit-wait' = 'fetch-ratelimit-wait',       // Waiting for token
    'fetch-ratelimit-reject' = 'fetch-ratelimit-reject',   // Rejected (waitForToken: false)
    'fetch-ratelimit-acquire' = 'fetch-ratelimit-acquire'  // Token acquired
}

// Event listeners
api.on('*', (event) => console.log('Any event:', event.type));
api.on('fetch-before', (event) => console.log('Request starting:', event.url));
api.on('fetch-error', (event) => console.error('Request failed:', event.error));
api.off('fetch-error', errorHandler); // remove listener
```

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
api.on('fetch-dedupe-start', (e) => console.log('New request:', e.key));
api.on('fetch-dedupe-join', (e) => console.log('Joined request:', e.key, 'waiters:', e.waitingCount));
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
api.on('fetch-cache-hit', (e) => console.log('Cache hit:', e.key, 'stale:', e.isStale));
api.on('fetch-cache-miss', (e) => console.log('Cache miss:', e.key));
api.on('fetch-cache-set', (e) => console.log('Cached:', e.key, 'expires in:', e.expiresIn));
api.on('fetch-cache-stale', (e) => console.log('Stale:', e.key));
api.on('fetch-cache-revalidate', (e) => console.log('Revalidating:', e.key));

// Cache invalidation API
await api.clearCache();                                    // Clear all
await api.deleteCache(key);                                // Delete specific key
await api.invalidateCache((key) => key.includes('user')); // By predicate
await api.invalidatePath('/users');                        // By path prefix
await api.invalidatePath(/^\/api\/v\d+/);                 // By regex
const stats = api.cacheStats();                           // { cacheSize, inflightCount }
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

// Rate limiting applies BEFORE cache/dedupe checks
// So cached responses don't consume rate limit tokens

// Events
api.on('fetch-ratelimit-wait', (e) => console.log('Waiting for token:', e.key, e.waitTimeMs));
api.on('fetch-ratelimit-reject', (e) => console.log('Rate limited:', e.key));
api.on('fetch-ratelimit-acquire', (e) => console.log('Token acquired:', e.key, 'remaining:', e.currentTokens));
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
const promiseA = api.get('/slow', { timeout: 10000 });

// Caller B: 2s timeout (joins A's request)
const promiseB = api.get('/slow', { timeout: 2000 });

// After 2s, B times out → A continues waiting
// Request completes at 5s → A gets the result, B already rejected
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
api.changeBaseUrl('https://api.staging.com');

// Dynamic request modification
api.changeModifyOptions((opts, state) => {
    if (state.authToken) {
        opts.headers.Authorization = `Bearer ${state.authToken}`;
    }
    opts.headers['X-Request-ID'] = crypto.randomUUID();
    return opts;
});

api.changeModifyMethodOptions('POST', (opts, state) => {
    opts.headers['Content-Type'] = 'application/json';
    return opts;
});

// Clear modifiers
api.changeModifyOptions(undefined);
api.changeModifyMethodOptions('POST', undefined);

// Per-request options
const [response, err] = await attempt(() =>
    api.get('/users', {
        timeout: 10000,
        headers: { 'X-Request-ID': '123' },
        params: { include: 'profile' },
        onBeforeReq: (opts) => console.log('Making request:', opts),
        onAfterReq: (response) => console.log('Response:', response.status),
        onError: (error) => console.error('Error:', error),
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
import { setState, getState, get, put, post, patch, del, options } from '@logosdx/fetch';
setState('authToken', 'token123'); // ✅ Typed

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
const cleanup1 = api.on('fetch-error', (e) => console.error(e));
const cleanup2 = api.on('fetch-response', (e) => console.log(e));

// Manual cleanup (if you stored the cleanup functions)
cleanup1();
cleanup2();

// Or just call destroy() - automatically removes all listeners added via on()
api.destroy();

// Listener cleanup - Option 2: Use off() for manual removal
const errorHandler = (e) => console.error(e);
const responseHandler = (e) => console.log(e);

api.on('fetch-error', errorHandler);
api.on('fetch-response', responseHandler);

// Remove specific listeners manually
api.off('fetch-error', errorHandler);
api.off('fetch-response', responseHandler);
api.destroy();

// Listener cleanup - Option 3: Use addEventListener with your own AbortController
// For advanced use cases where you need fine-grained control
const controller = new AbortController();

api.addEventListener('fetch-error', errorHandler, { signal: controller.signal });
api.addEventListener('fetch-response', responseHandler, { signal: controller.signal });

// Remove all listeners at once
controller.abort();
api.destroy();

// Component lifecycle integration (simplest approach)
class MyComponent {
    constructor() {
        this.api = new FetchEngine({ baseUrl: 'https://api.example.com' });

        // on() returns cleanup function and automatically cleaned on destroy()
        this.cleanups = [
            this.api.on('fetch-error', this.handleError),
            this.api.on('fetch-response', this.handleResponse)
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
    timeout: 5000,

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
api.on('fetch-error', (event) => {
    // Log to monitoring service
    console.error('API Error:', {
        url: event.url,
        status: event.error?.status,
        attempt: event.attempt,
        method: event.method
    });
});

api.on('fetch-retry', (event) => {
    console.log(`Retry ${event.nextAttempt}/${api.retry.maxAttempts} after ${event.delay}ms`);
});

// Dynamic state management
api.setState('authToken', await getAuthToken());

// Use changeModifyOptions for dynamic auth token injection
api.changeModifyOptions((opts, state) => {
    if (state.authToken) {
        opts.headers.Authorization = `Bearer ${state.authToken}`;
    }
    return opts;
});

// Environment switching
if (process.env.NODE_ENV === 'development') {
    api.changeBaseUrl('https://api.dev.com');
}

// AbortablePromise with timeout
const request = api.get('/long-running-task');
const timeoutId = setTimeout(() => {
    if (!request.isFinished) request.abort('Timeout');
}, 30000);

const [response, err] = await attempt(() => request);
clearTimeout(timeoutId);
```