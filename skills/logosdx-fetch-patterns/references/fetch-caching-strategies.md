# FetchEngine Caching Strategies

## Request Deduplication

Prevents duplicate concurrent requests by sharing the same in-flight promise.

```typescript
// Enable with defaults (GET only)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    dedupePolicy: true,
})

// Three concurrent calls → one network request
const [a, b, c] = await Promise.all([
    api.get('/users/123'),
    api.get('/users/123'),
    api.get('/users/123'),
])

// Full configuration
dedupePolicy: {
    enabled: true,
    methods: ['GET', 'POST'],
    serializer: (ctx) => `${ctx.method}:${ctx.path}`,
    shouldDedupe: (ctx) => !ctx.payload?.skipDedupe,
    rules: [
        { startsWith: '/admin', enabled: false },
        { startsWith: '/api/v2', serializer: customSerializer },
    ],
}
```

### Independent Timeout Per Caller

Each caller joining a deduped request maintains independent timeout/abort:

```typescript
const promiseA = api.get('/slow', { totalTimeout: 10000 })
const promiseB = api.get('/slow', { totalTimeout: 2000 })

// B times out at 2s → A continues → A gets result at 5s
```

## Response Caching

Cache responses with TTL and stale-while-revalidate (SWR) support.

```typescript
// Enable with defaults (GET, 60s TTL)
cachePolicy: true

// Full configuration
cachePolicy: {
    enabled: true,
    methods: ['GET'],
    ttl: 300000,          // 5 minutes
    staleIn: 60000,       // Stale after 1 minute → background revalidation
    skip: (ctx) => ctx.path.includes('/realtime'),
    rules: [
        { startsWith: '/static', ttl: 3600000 },  // 1 hour for static
        { startsWith: '/admin', enabled: false },   // No cache for admin
    ],
}
```

### Cache Invalidation

```typescript
await api.clearCache()                                      // Clear all
await api.deleteCache(key)                                  // Delete by key
await api.invalidateCache((key) => key.includes('user'))    // By predicate
await api.invalidatePath('/users')                          // By path prefix
await api.invalidatePath(/^\/api\/v\d+/)                    // By regex
await api.invalidatePath((key) => key.includes('user'))     // By predicate
const stats = api.cacheStats()                              // { cacheSize, inflightCount }
```

## Rate Limiting

Token bucket algorithm for outgoing request rate control. Per-endpoint by default.

```typescript
// Enable with defaults (100 req/min, all methods)
rateLimitPolicy: true

// Full configuration
rateLimitPolicy: {
    enabled: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    maxCalls: 100,
    windowMs: 60000,
    waitForToken: true,       // Wait for token (false = reject immediately)
    serializer: (ctx) => `${ctx.method}|${ctx.url.pathname}`,
    shouldRateLimit: (ctx) => !ctx.headers?.['X-Bypass-RateLimit'],
    onRateLimit: (ctx, waitTimeMs) => console.log(`Rate limited, waiting ${waitTimeMs}ms`),
    rules: [
        { startsWith: '/api/search', maxCalls: 10, windowMs: 60000 },
        { startsWith: '/api/bulk', waitForToken: false },
        { startsWith: '/health', enabled: false },
    ],
}
```

## Policy Execution Order

```
Request
├── 1. Rate Limit Guard → wait or reject
├── 2. Cache Check      → return cached if hit
├── 3. Dedupe Check     → join in-flight if exists
├── 4. Network Request  → actual HTTP call
└── 5. Cache Store      → cache successful response
```

Key implications:
- Cached responses don't consume rate limit tokens
- Dedup joins happen after cache checks
- Only the initiator consumes a rate limit token; joiners share the result

## Route Matching (shared by all policies)

```typescript
interface MatchTypes {
    is?: string         // Exact path match
    startsWith?: string // Path prefix
    endsWith?: string   // Path suffix
    includes?: string   // Path contains
    match?: RegExp      // Regex match
}

// Multiple matchers use AND logic (except 'is' which is exclusive)
rules: [
    { is: '/users' },                            // exact match
    { startsWith: '/api', endsWith: '.json' },   // both must match
]
```

Prefer string matchers over regex for performance and ReDoS safety.

## Request Serializers

Serializers generate unique keys for identifying requests.

```typescript
import { endpointSerializer, requestSerializer } from '@logosdx/fetch'

// requestSerializer (default for cache & dedupe)
// Format: method|path+query|payload|stableHeaders

// endpointSerializer (default for rate limit)
// Format: method|pathname

// Custom serializer
cachePolicy: {
    serializer: (ctx) => `${ctx.headers?.['X-Tenant-ID']}|${ctx.method}|${ctx.url.pathname}`,
}
```

## Production Recipe

```typescript
const api = new FetchEngine({
    baseUrl: process.env.API_BASE_URL,
    totalTimeout: 10000,
    requestIdHeader: 'X-Request-Id',

    dedupePolicy: {
        enabled: true,
        rules: [{ startsWith: '/realtime', enabled: false }],
    },

    cachePolicy: {
        ttl: 60000,
        staleIn: 30000,
        rules: [
            { startsWith: '/static', ttl: 3600000 },
            { includes: '/realtime', enabled: false },
        ],
    },

    rateLimitPolicy: {
        maxCalls: 100,
        windowMs: 60000,
        rules: [
            { startsWith: '/api/search', maxCalls: 10 },
        ],
    },

    retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        shouldRetry: (error) => error.status >= 500 && !error.aborted,
    },
})
```
