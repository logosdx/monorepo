# FetchEngine Config Options

## Constructor

```typescript
const api = new FetchEngine<Headers, Params, State, ResponseHeaders>({
    // Required
    baseUrl: 'https://api.example.com',

    // Response parsing
    defaultType: 'json',  // 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData'

    // Timeouts
    totalTimeout: 30000,    // Entire operation including retries (ms)
    attemptTimeout: 5000,   // Per-attempt timeout (allows retries on timeout)

    // Retry
    retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        useExponentialBackoff: true,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        shouldRetry: (error, attempt) => boolean | number,  // number = custom delay
    },
    // retry: false  → disable retries entirely

    // Policies (see fetch-caching-strategies.md)
    dedupePolicy: true | DeduplicationConfig,
    cachePolicy: true | CacheConfig,
    rateLimitPolicy: true | RateLimitConfig,

    // Headers (global and per-method)
    headers: { Authorization: 'Bearer token' },
    methodHeaders: {
        POST: { 'Content-Type': 'application/json' },
    },

    // URL parameters (global and per-method)
    params: { version: 'v2' },
    methodParams: {
        GET: { format: 'json' },
    },

    // Request modification
    modifyConfig: (opts, state) => {
        opts.headers.Authorization = `Bearer ${state.token}`
        return opts
    },
    modifyMethodConfig: {
        POST: (opts, state) => {
            opts.headers['X-CSRF'] = state.csrfToken
            return opts
        },
    },

    // Validation
    validate: {
        headers: (headers, method?) => void,
        params: (params, method?) => void,
        state: (state) => void,
        perRequest: { headers: false, params: false },
    },

    // Request ID tracing
    generateRequestId: () => string,      // default: generateId()
    requestIdHeader: 'X-Request-Id',      // sends requestId to server

    // Custom response type detection
    determineType: (response) => 'json' | 'text' | ... | FetchEngine.useDefault,
})
```

## HTTP Methods

All return `AbortablePromise<FetchResponse<T>>`:

```typescript
api.get<T, RH>(path, options?)
api.post<T, Body, RH>(path, payload?, options?)
api.put<T, Body, RH>(path, payload?, options?)
api.patch<T, Body, RH>(path, payload?, options?)
api.delete<T, Body, RH>(path, payload?, options?)
api.options<T, RH>(path, options?)
api.request<T, Body, RH>(method, path, options & { payload? })
```

### Per-Request Options

```typescript
const [res, err] = await attempt(() =>
    api.get('/users', {
        totalTimeout: 30000,
        attemptTimeout: 10000,
        headers: { 'X-Request-ID': '123' },
        params: { include: 'profile' },
        requestId: 'upstream-trace-id',
        stream: false,
        retry: { maxAttempts: 5 },
    })
)
```

### Stream Mode

Returns raw `Response` with unconsumed body. Cache and dedup are skipped:

```typescript
const [sse, err] = await attempt(() => api.get('/events', { stream: true }))

if (!err) {

    const reader = sse.data.body.getReader()

    while (true) {

        const { done, value } = await reader.read()
        if (done) break
        console.log(new TextDecoder().decode(value))
    }
}
```

## Response Object

```typescript
interface FetchResponse<T, H, P, RH> {
    data: T              // Parsed response body
    headers: Partial<RH> // Response headers as typed object
    status: number       // HTTP status code
    request: Request     // Original Request object
    config: FetchConfig<H, P>  // Config used for this request
}
```

## Headers Management

```typescript
api.headers.set('Authorization', 'Bearer token')
api.headers.set({ 'X-Version': 'v2', 'X-Client': 'web' })
api.headers.set('Content-Type', 'application/json', 'POST')  // method-specific
api.headers.remove('Authorization')
api.headers.remove(['X-Version', 'X-Client'])
api.headers.has('Authorization')  // boolean
api.headers.defaults              // global headers
api.headers.all                   // all including method overrides
api.headers.resolve('GET')        // resolved for specific method
```

## Params Management

```typescript
api.params.set('version', 'v1')
api.params.set({ api_key: 'abc', format: 'json' })
api.params.set('page', '1', 'GET')  // method-specific
api.params.remove('version')
api.params.has('api_key')
api.params.defaults
api.params.all
api.params.resolve('GET')
```

## State Management

```typescript
api.state.set('authToken', 'token-123')
api.state.set({ userId: '42', sessionId: 'abc' })
const state = api.state.get()  // deep clone
api.state.reset()              // clear all state
```

## Runtime Config Changes

```typescript
api.config.set('baseUrl', 'https://api.staging.com')
api.config.set('modifyConfig', (opts, state) => { ... })
api.config.set('modifyConfig', undefined)  // clear modifier
api.config.set('modifyMethodConfig', { POST: undefined })  // clear method modifier
```

## Lifecycle

```typescript
api.destroy()       // Clean up all resources, reject future requests
api.isDestroyed()   // Check if destroyed
```

## Custom Retry Logic

```typescript
retry: {
    maxAttempts: 5,
    shouldRetry: (error, attempt) => {

        // Return a number for custom delay (overrides backoff)
        if (error.status === 429) {

            const retryAfter = error.headers?.['retry-after']
            return retryAfter ? parseInt(retryAfter) * 1000 : 5000
        }

        // Don't retry client errors
        if (error.status >= 400 && error.status < 500) return false

        // Use default backoff for server errors
        return true
    },
}
```
