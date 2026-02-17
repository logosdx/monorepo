---
title: Policies
description: Request deduplication, response caching, rate limiting, and route matching in FetchEngine.
---

# Policies


FetchEngine provides three resilience policies that share a common architecture: request deduplication, response caching, and rate limiting.

[[toc]]


## Request Deduplication


When multiple parts of your application make identical requests simultaneously, FetchEngine can deduplicate them by sharing a single in-flight promise. This reduces network traffic, server load, and prevents race conditions.


### Quick Start


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
// All three receive the same result from a single HTTP request
```


### Configuration


| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable deduplication |
| `methods` | `HttpMethod[]` | `['GET']` | HTTP methods to deduplicate |
| `serializer` | `RequestSerializer` | `defaultRequestSerializer` | Function to generate request keys |
| `shouldDedupe` | `(ctx) => boolean` | - | Dynamic skip check (called per-request) |
| `rules` | `DedupeRule[]` | - | Route-specific configuration |

**Full Configuration Example:**

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    dedupePolicy: {
        enabled: true,
        methods: ['GET', 'POST'],
        serializer: (ctx) => `${ctx.method}:${ctx.path}:${JSON.stringify(ctx.payload)}`,
        shouldDedupe: (ctx) => !ctx.headers?.['X-Force-Fresh'],
        rules: [
            // Disable deduplication for admin endpoints
            { startsWith: '/admin', enabled: false },

            // Custom serializer for search (ignore timestamp param)
            {
                startsWith: '/search',
                serializer: (ctx) => `${ctx.method}:${ctx.path}:${ctx.payload?.query}`
            },

            // Enable POST deduplication for specific endpoint
            { is: '/graphql', methods: ['POST'] }
        ]
    }
});
```


### Deduplication Events


```typescript
// Emitted when a new request starts tracking
api.on('dedupe-start', (event) => {
    console.log('New request:', event.key);
});

// Emitted when a caller joins an existing in-flight request
api.on('dedupe-join', (event) => {
    console.log('Joined:', event.key, 'waiters:', event.waitingCount);
});
```


### Independent Timeout per Caller


Each caller can have independent timeout and abort constraints:

```typescript
// Caller A starts request with 10s timeout
const promiseA = api.get('/slow-endpoint', { totalTimeout: 10000 });

// Caller B joins with 2s timeout
const promiseB = api.get('/slow-endpoint', { totalTimeout: 2000 });

// After 2s: B times out and rejects → A continues waiting
// At 5s: Request completes → A gets the result

// Semantics:
// - Initiator's abort/timeout → cancels fetch → everyone fails
// - Joiner's abort/timeout → only that joiner fails → others unaffected
```


## Response Caching


FetchEngine supports response caching with TTL and stale-while-revalidate (SWR) for improved performance and reduced API load.


### Quick Start


```typescript
// Enable with defaults (GET requests, 60s TTL)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: true
});

// First call: fetches from network, caches response
const users1 = await api.get('/users');

// Subsequent calls within TTL: instant cache hit
const users2 = await api.get('/users');
```


### Configuration


| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable caching |
| `methods` | `HttpMethod[]` | `['GET']` | HTTP methods to cache |
| `ttl` | `number` | `60000` | Time to live in milliseconds |
| `staleIn` | `number` | - | Time until stale for SWR (ms) |
| `serializer` | `RequestSerializer` | `defaultRequestSerializer` | Function to generate cache keys |
| `skip` | `(ctx) => boolean` | - | Dynamic skip check |
| `rules` | `CacheRule[]` | - | Route-specific configuration |
| `adapter` | `CacheAdapter<unknown>` | `MapCacheAdapter` | Custom cache storage backend |

**Full Configuration with SWR:**

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        enabled: true,
        methods: ['GET'],
        ttl: 300000,          // 5 minutes
        staleIn: 60000,       // Consider stale after 1 minute

        // Skip caching for certain requests
        skip: (ctx) => ctx.headers?.['Cache-Control'] === 'no-cache',

        rules: [
            // Long cache for static content
            { startsWith: '/static', ttl: 3600000 },

            // Short cache for user data
            { startsWith: '/user', ttl: 30000, staleIn: 10000 },

            // No caching for realtime endpoints
            { includes: '/realtime', enabled: false },

            // No caching for admin
            { startsWith: '/admin', enabled: false }
        ]
    }
});
```


### Stale-While-Revalidate (SWR)


When `staleIn` is configured, FetchEngine implements stale-while-revalidate:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        ttl: 60000,      // Expire after 60 seconds
        staleIn: 30000   // Consider stale after 30 seconds
    }
});

// Timeline:
// 0-30s:  Fresh cache hit - returns cached data immediately
// 30-60s: Stale cache hit - returns cached data + background revalidation
// >60s:   Cache miss - fetches fresh data
```


### Cache Events


```typescript
// Fresh cache hit
api.on('cache-hit', (event) => {
    console.log('Cache hit:', event.key, 'expires in:', event.expiresIn);
});

// Stale cache hit (SWR)
api.on('cache-stale', (event) => {
    console.log('Stale hit:', event.key, 'revalidating...');
});

// Cache miss
api.on('cache-miss', (event) => {
    console.log('Cache miss:', event.key);
});

// New cache entry stored
api.on('cache-set', (event) => {
    console.log('Cached:', event.key, 'TTL:', event.expiresIn);
});

// SWR background revalidation started
api.on('cache-revalidate', (event) => {
    console.log('Background revalidation:', event.key);
});

// SWR background revalidation failed
api.on('cache-revalidate-error', (event) => {
    console.error('Revalidation failed:', event.key, event.error);
});
```


### Cache Invalidation


```typescript
// Clear all cached responses
api.clearCache();

// Delete specific cache entry (sync, fire-and-forget)
api.clearCacheKey(cacheKey);

// Delete specific cache entry (async, returns whether it existed)
const existed = await api.deleteCache(cacheKey);

// Invalidate entries matching a predicate
const count = await api.invalidateCache((key) => key.includes('user'));
console.log(`Invalidated ${count} entries`);

// Invalidate by path pattern (string prefix)
await api.invalidatePath('/users');

// Invalidate by path pattern (RegExp)
await api.invalidatePath(/^\/api\/v\d+\/users/);

// Invalidate with custom predicate (for custom serializers)
await api.invalidatePath((key) => {
    // Full control over key matching - useful when using custom serializers
    return key.includes('/users') && key.includes('Bearer');
});

// Get cache statistics
const stats = api.cacheStats();
console.log('Cache size:', stats.cacheSize);
console.log('In-flight:', stats.inflightCount);
```


### Custom Cache Adapters


FetchEngine supports pluggable cache backends via the `CacheAdapter` interface. This enables caching to Redis, IndexedDB, AsyncStorage, localStorage, or any custom storage.

```typescript
import { FetchEngine } from '@logosdx/fetch';
import { CacheAdapter, CacheItem } from '@logosdx/utils';

// Example: localStorage adapter
class LocalStorageCacheAdapter implements CacheAdapter<unknown> {

    #prefix: string;
    #data = new Map<string, CacheItem<unknown>>();

    constructor(prefix = 'api-cache') {
        this.#prefix = prefix;
        this.#loadFromStorage();
    }

    get size() { return this.#data.size; }

    async get(key: string) {
        return this.#data.get(key);
    }

    async set(key: string, item: CacheItem<unknown>) {
        this.#data.set(key, item);
        this.#saveToStorage();
    }

    async delete(key: string) {
        const existed = this.#data.delete(key);
        this.#saveToStorage();
        return existed;
    }

    async has(key: string) {
        return this.#data.has(key);
    }

    async clear() {
        this.#data.clear();
        localStorage.removeItem(this.#prefix);
    }

    #loadFromStorage() {
        const stored = localStorage.getItem(this.#prefix);
        if (stored) {
            const entries = JSON.parse(stored);
            this.#data = new Map(entries);
        }
    }

    #saveToStorage() {
        localStorage.setItem(this.#prefix, JSON.stringify([...this.#data]));
    }
}

// Use the custom adapter
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        adapter: new LocalStorageCacheAdapter('my-api'),
        ttl: 300000
    }
});
```

The `CacheAdapter` interface:

```typescript
interface CacheAdapter<T> {

    get(key: string): Promise<CacheItem<T> | undefined>;
    set(key: string, item: CacheItem<T>, expiresAt?: number): Promise<void>;
    delete(key: string): Promise<boolean>;
    has(key: string): Promise<boolean>;
    clear(): Promise<void>;
    readonly size: number;
}

interface CacheItem<T> {

    value: T;
    createdAt: number;
    expiresAt: number;
    staleAt?: number;  // For SWR
}
```


## Rate Limiting


Control outgoing request rates using a token bucket algorithm. Each unique request key (generated by the serializer) gets its own rate limiter, enabling per-endpoint or per-user throttling.

This re-uses the same rate limiting logic found in the [function utility](https://logosdx.dev/packages/utils.html#ratelimit) in the utils package.


### Quick Start


```typescript
// Enable with defaults (100 requests/minute, all HTTP methods)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: true
});

// Requests are automatically throttled
// If rate limit is exceeded, requests wait for tokens by default
await api.get('/users');  // Waits if needed
```


### Configuration


```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        // Global settings
        enabled: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],  // All by default
        maxCalls: 100,            // Requests per window (default: 100)
        windowMs: 60000,          // Time window in ms (default: 60000 = 1 minute)
        waitForToken: true,       // true = wait, false = reject immediately

        // Custom key generation (default: method + pathname)
        serializer: (ctx) => `${ctx.method}|${ctx.url.pathname}`,

        // Dynamic bypass
        shouldRateLimit: (ctx) => {
            // Return false to bypass rate limiting
            return !ctx.headers?.['X-Bypass-RateLimit'];
        },

        // Callback when rate limited
        onRateLimit: (ctx, waitTimeMs) => {
            console.log(`Rate limited for ${waitTimeMs}ms:`, ctx.path);
        },

        // Route-specific rules
        rules: [
            // Stricter limits for search
            { startsWith: '/api/search', maxCalls: 10, windowMs: 60000 },

            // Reject immediately for bulk operations
            { startsWith: '/api/bulk', waitForToken: false },

            // No rate limiting for health checks
            { startsWith: '/health', enabled: false },

            // Custom serializer for user-specific limiting
            {
                startsWith: '/api/user',
                serializer: (ctx) => `user:${ctx.headers?.['X-User-ID'] ?? 'anonymous'}`
            }
        ]
    }
});
```


### Token Bucket Algorithm


Rate limiting uses a token bucket that refills continuously:

- **Capacity**: `maxCalls` tokens
- **Refill Rate**: `maxCalls / windowMs` tokens per millisecond
- Each request consumes 1 token
- If no tokens available:
  - `waitForToken: true` → waits until token available
  - `waitForToken: false` → throws `RateLimitError` immediately

```typescript
// Example: 10 requests per minute = 1 token every 6 seconds
{
    maxCalls: 10,
    windowMs: 60000  // 60000ms / 10 = 6000ms per token
}
```


### Rate Limit Events


```typescript
// Emitted when request must wait for a token
api.on('ratelimit-wait', (event) => {
    console.log('Waiting for rate limit:', {
        key: event.key,
        waitTimeMs: event.waitTimeMs,
        currentTokens: event.currentTokens,
        capacity: event.capacity,
        nextAvailable: event.nextAvailable
    });
});

// Emitted when request is rejected (waitForToken: false)
api.on('ratelimit-reject', (event) => {
    console.log('Rate limit exceeded:', {
        key: event.key,
        waitTimeMs: event.waitTimeMs  // How long they would have waited
    });
});

// Emitted after token is successfully acquired
api.on('ratelimit-acquire', (event) => {
    console.log('Token acquired:', {
        key: event.key,
        currentTokens: event.currentTokens,  // Remaining tokens
        capacity: event.capacity
    });
});
```


### Rate Limiting Order


Rate limiting is evaluated **after** the cache check but **before** deduplication and retry:

```
beforeRequest (run):
  Cache Check → Rate Limit → [user hooks]

execute (pipe):
  Dedupe → Retry → Network Request

afterRequest (run):
  Cache Store → [user hooks]
```

This means:

- Cached responses return immediately **without** consuming rate limit tokens
- Rate limiting only gates actual outbound requests (after cache miss)
- Deduplicated requests only consume one token (the initiator's)
- Retry wraps the network call, not the entire pipeline


### Per-User Rate Limiting


```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        maxCalls: 100,
        windowMs: 60000,
        // Group requests by user ID
        serializer: (ctx) => `user:${ctx.state?.userId ?? 'anonymous'}`
    }
});

// Each user gets their own 100 req/min bucket
api.state.set('userId', 'user-123');
await api.get('/data');  // Uses user-123's bucket

api.state.set('userId', 'user-456');
await api.get('/data');  // Uses user-456's bucket
```


### Global Rate Limiting


```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        maxCalls: 1000,
        windowMs: 60000,
        // All requests share one bucket
        serializer: () => 'global'
    }
});
```


### Handling Rate Limit Errors


```typescript
import { attempt, isRateLimitError } from '@logosdx/utils';

const [response, err] = await attempt(() => api.get('/users'));

if (err) {
    if (isRateLimitError(err)) {
        console.log('Rate limited:', err.message);
        console.log('Limit:', err.limit);  // maxCalls value
        // Retry after some time, or show user feedback
    }
}
```


## Route Matching


Deduplication, caching, and rate limiting all support flexible route matching via `MatchTypes`:

```typescript
interface MatchTypes {

    is?: string;           // Exact path match
    startsWith?: string;   // Path prefix match
    endsWith?: string;     // Path suffix match
    includes?: string;     // Path contains substring
    match?: RegExp;        // Regular expression match
}
```

**Match Type Behavior:**
- `is` requires an exact match and cannot be combined with other types
- Other types can be combined with AND logic (all must match)

**Examples:**

```typescript
const rules = [
    // Exact match
    { is: '/users' },

    // Prefix match
    { startsWith: '/api/v2' },

    // Suffix match
    { endsWith: '.json' },

    // Substring match
    { includes: 'admin' },

    // Regex match
    { match: /^\/v\d+\/users/ },

    // Combined (AND logic)
    { startsWith: '/api', endsWith: '.json' },  // Must satisfy both
    { includes: 'user', match: /\/\d+$/ }       // Must satisfy both
];
```

::: warning Regex Performance (ReDoS)
Route matching runs on **every request**. Poorly written regular expressions can cause catastrophic backtracking, severely degrading performance or hanging your application.

**Dangerous patterns to avoid:**

```typescript
// BAD: Nested quantifiers cause exponential backtracking
{ match: /(a+)+b/ }
{ match: /^\/api\/v\d+\/.*$/ }     // .* with anchors can backtrack
{ match: /(\w+)*@/ }               // Nested quantifiers

// BAD: Overlapping alternatives
{ match: /(a|a)+/ }
{ match: /(\d+|\d+\.)+/ }
```

**Safe patterns:**

```typescript
// GOOD: Simple, non-nested quantifiers
{ match: /^\/v\d+\/users/ }        // No trailing .*
{ match: /\/users\/\d+$/ }         // Anchored end, simple pattern
{ match: /\.(json|xml)$/ }         // Non-overlapping alternatives

// BETTER: Use string matchers when possible (faster, no ReDoS risk)
{ startsWith: '/api/v2' }          // Instead of /^\/api\/v2/
{ endsWith: '.json' }              // Instead of /\.json$/
{ includes: '/users/' }            // Instead of /\/users\//
```

**Best practice:** Prefer string-based matchers (`startsWith`, `endsWith`, `includes`, `is`) over regex. They're faster and immune to ReDoS. Only use `match` when you need pattern complexity that strings can't express.
:::


## Request Serializers


Serializers generate unique keys for identifying requests. These keys are used by deduplication, caching, and rate limiting to determine which requests should share state.


### Built-in Serializers


FetchEngine provides two built-in serializers, each optimized for different use cases:


#### Request Serializer (Default for Cache & Dedupe)


Generates keys based on full request identity: method, path, query string, payload, and stable headers.

```typescript
// Key format: method|path+query|payload|headers
// Example: "GET|/users/123?page=1|undefined|{"accept":"application/json","authorization":"Bearer token"}"
```

**Stable Headers Only:** The request serializer only includes semantically meaningful headers that affect response content:

| Included Headers | Purpose |
|-----------------|---------|
| `authorization` | Different users get different responses |
| `accept` | Different response formats (JSON, XML, etc.) |
| `accept-language` | Localized responses |
| `content-type` | Format of request payload (for POST/PUT) |
| `accept-encoding` | Response compression format |

**Excluded Headers (Dynamic):**
- `X-Timestamp`, `Date` - Change every request
- `X-HMAC-Signature` - Computed per-request
- `X-Request-Id`, `X-Correlation-Id` - Unique per-request
- `Cache-Control`, `Pragma` - Control directives, not identity

This prevents cache pollution from dynamic headers that would make every request unique.


#### Endpoint Serializer (Default for Rate Limit)


Generates keys based on endpoint identity only: method and pathname (excludes query string and payload).

```typescript
// Key format: method|pathname
// Example: "GET|/users/123"
```

This groups all requests to the same endpoint together, ideal for rate limiting where you want to protect an endpoint from overload regardless of specific parameters.


### Using Built-in Serializers


```typescript
import { endpointSerializer, requestSerializer } from '@logosdx/fetch';

// Use endpoint serializer for cache (group by endpoint)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        serializer: endpointSerializer,  // All /users/123?page=1 and /users/123?page=2 share cache
        ttl: 60000
    }
});

// Use request serializer for rate limiting (per unique request)
const api2 = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        serializer: requestSerializer,  // Each unique request gets its own bucket
        maxCalls: 100,
        windowMs: 60000
    }
});
```


### Custom Serializers


Create custom serializers when the built-ins don't match your needs:

```typescript
// User-scoped rate limiting
const userSerializer = (ctx: RequestKeyOptions) => {
    return `user:${ctx.state?.userId ?? 'anonymous'}|${ctx.method}|${ctx.url.pathname}`;
};

const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    rateLimitPolicy: {
        serializer: userSerializer,  // Each user gets their own rate limit bucket
        maxCalls: 100,
        windowMs: 60000
    }
});

// Tenant-scoped caching
const tenantSerializer = (ctx: RequestKeyOptions) => {
    const tenant = ctx.headers?.['X-Tenant-ID'] ?? 'default';
    return `${tenant}|${ctx.method}|${ctx.url.pathname}${ctx.url.search}`;
};

const multiTenantApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        serializer: tenantSerializer,  // Each tenant has separate cache
        ttl: 60000
    }
});

// Ignore certain params for caching
const ignoreTimestampSerializer = (ctx: RequestKeyOptions) => {
    const url = new URL(ctx.url);
    url.searchParams.delete('_t');  // Remove timestamp param
    url.searchParams.delete('nocache');
    return `${ctx.method}|${url.pathname}${url.search}`;
};
```


### Serializer Signature


```typescript
type RequestSerializer<S = unknown, H = unknown, P = unknown> = (
    ctx: RequestKeyOptions<S, H, P>
) => string;

interface RequestKeyOptions<S = unknown, H = unknown, P = unknown> {

    method: string;           // HTTP method (uppercase)
    path: string;             // Original path from request
    url: URL;                 // Full URL object (includes pathname, search, etc.)
    payload?: unknown;        // Request body (if any)
    headers?: H;              // Request headers
    params?: P;               // URL parameters
    state?: S;                // Instance state
}
```


### Per-Rule Serializers


Override serializers for specific routes:

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    cachePolicy: {
        enabled: true,
        ttl: 60000,
        rules: [
            // GraphQL: cache by operation name only
            {
                is: '/graphql',
                serializer: (ctx) => `graphql:${ctx.payload?.operationName ?? 'unknown'}`
            },

            // Search: ignore pagination for cache
            {
                startsWith: '/search',
                serializer: (ctx) => {
                    const url = new URL(ctx.url);
                    url.searchParams.delete('page');
                    url.searchParams.delete('limit');
                    return `search:${url.search}`;
                }
            },

            // User profile: cache per user
            {
                match: /^\/users\/\d+$/,
                serializer: (ctx) => `user:${ctx.url.pathname}`
            }
        ]
    }
});
```


## Policy Architecture


FetchEngine's resilience policies (deduplication, caching, rate limiting) share a common architecture that enables consistent behavior and efficient configuration resolution.


### Three-Method Pattern


All policies implement the same three-method pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                    ResiliencePolicy                          │
├─────────────────────────────────────────────────────────────┤
│  init(config)     Parse config → Initialize state  (O(1))   │
│  resolve(...)     Memoized lookup + dynamic checks (O(1)*)  │
│  compute(...)     Rule matching (O(n) first time only)      │
└─────────────────────────────────────────────────────────────┘
      * O(1) amortized due to memoization
```

1. **`init`**: Called during FetchEngine construction. Parses configuration, validates rules, and sets up internal state.

2. **`resolve`**: Called for every request. Returns the effective policy configuration by combining memoized rule matching with dynamic skip callbacks.

3. **`compute`**: Called once per unique method+path combination. Performs O(n) rule matching and caches the result.


### Configuration Resolution


When a request is made, each policy resolves its configuration in order:

```
Request → Policy.resolve(method, path, context)
                    │
                    ├── Check memoized cache (O(1))
                    │   └── Cache miss? → compute() → cache result
                    │
                    ├── Check dynamic skip callback
                    │   └── Skip? → return null
                    │
                    └── Return merged rule (policy defaults + matched rule)
```


### Rule Matching Priority


Rules are evaluated in declaration order. The first matching rule wins:

```typescript
rules: [
    { is: '/users', ttl: 30000 },           // Checked first (exact match)
    { startsWith: '/users', ttl: 60000 },   // Checked second
    { match: /^\/users/, ttl: 120000 }      // Checked third
]
// Request to '/users' matches first rule (30s TTL)
// Request to '/users/123' matches second rule (60s TTL)
```


### Policy Execution Order


FetchEngine uses a 3-phase hook pipeline powered by `@logosdx/hooks`:

```
beforeRequest (run — priority order):
    │
    ├── -30: Cache Check ──────────────────┐
    │        └── Hit? Return cached        │
    │                                      │
    ├── -20: Rate Limit (guard) ───────────┤
    │        └── Wait or reject            │
    │                                      │
    └──  0:  User hooks ──────────────────┘

execute (pipe — onion middleware):
    │
    ├── -30: Dedupe ───────────────────────┐
    │        └── In-flight? Join it        │
    │                                      │
    ├── -20: Retry ────────────────────────┤
    │        └── Wrap with retry logic     │
    │                                      │
    └── core: Network Request ─────────────┘

afterRequest (run — priority order):
    │
    ├── -10: Cache Store ──────────────────┐
    │        └── Store response            │
    │                                      │
    └──  0:  User hooks ──────────────────┘
```

**Key implications:**
- Cache checks run **first** — cached responses return immediately without consuming rate limit tokens
- Rate limiting only runs on cache misses — it protects the upstream API, not local cache reads
- Deduplication and retry wrap the actual network call via pipe middleware
- Only the request initiator consumes a rate limit token; joiners share the result


### Memoization Strategy


Rule matching results are cached by `method:path` key:

```typescript
// First request to GET /users/123
resolve('GET', '/users/123', ctx)
    → compute() runs, caches result
    → rulesCache.set('GET:/users/123', resolvedRule)

// Subsequent requests to same endpoint
resolve('GET', '/users/123', ctx)
    → rulesCache.get('GET:/users/123') // O(1) hit
    → Check skip callback
    → Return cached rule
```

This means:
- First request to each endpoint: O(n) rule matching
- Subsequent requests: O(1) cache lookup
- Skip callbacks always run (they depend on request-specific context)


### Policy State


Each policy maintains its own internal state:

```typescript
interface PolicyInternalState {

    enabled: boolean;                    // Global enable/disable
    methods: Set<string>;                // Applicable HTTP methods
    serializer: RequestSerializer;       // Key generation function
    rulesCache: Map<string, Rule | null>; // Memoized rule lookups
}
```


### Extending Policies


While the built-in policies cover most use cases, the architecture is designed for extensibility. Each policy class extends `ResiliencePolicy` and implements:

- `getDefaultSerializer()` - Returns the default key generation function
- `getDefaultMethods()` - Returns which HTTP methods are enabled by default
- `mergeRuleWithDefaults(rule)` - Merges matched rules with policy defaults

This shared base ensures consistent configuration handling across all resilience features.
