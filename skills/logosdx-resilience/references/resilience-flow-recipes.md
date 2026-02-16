# Resilience Flow Recipes

## composeFlow API

```typescript
import { composeFlow } from '@logosdx/utils'

const composed = composeFlow(asyncFunction, {
    rateLimit?: RateLimitOptions,
    circuitBreaker?: CircuitBreakerOptions,
    retry?: RetryOptions,
    withTimeout?: WithTimeoutOptions,
    inflight?: InflightOptions,
})
```

Key order determines wrapping order. First key = outermost wrapper. Requires at least 2 keys.

## Control Option Reference

### retry

```typescript
retry: {
    retries: 3,                     // Number of retries (default: 3)
    delay: 1000,                    // Base delay in ms (default: 0)
    backoff: 2,                     // Multiplier for delay (default: 1)
    jitterFactor: 0.1,              // Randomize timing (default: 0)
    shouldRetry: (err) => boolean,  // Custom retry predicate
    signal: abortController.signal, // Abort signal
    throwLastError: true,           // Throw original error instead of RetryError
    onRetry: (err, attempt) => {},  // Callback before each retry
    onRetryExhausted: (err) => fallback,  // Return fallback instead of throwing
}
```

### circuitBreaker

```typescript
circuitBreaker: {
    maxFailures: 5,     // Failures before opening (default: 5)
    resetAfter: 30000,  // Time in ms before half-open test (default: 30000)
}
```

### withTimeout

```typescript
withTimeout: {
    timeout: 5000,  // Time limit in ms
}
```

### rateLimit

```typescript
rateLimit: {
    maxCalls: 100,       // Max calls per window
    windowMs: 60000,     // Window duration in ms
    throws: true,        // Throw RateLimitError (default: false)
    onThrottle: (args) => {},  // Called when throttled
}

// Or with token bucket for persistence
rateLimit: {
    bucket: new RateLimitTokenBucket({
        capacity: 100,
        refillIntervalMs: 1000,
    }),
    throws: true,
}
```

### inflight

```typescript
inflight: {
    generateKey: (...args) => string,   // Key from args
    shouldDedupe: (...args) => boolean, // Conditional dedup
    onStart: (key) => {},               // First caller starts
    onJoin: (key) => {},                // Subsequent caller joins
    onResolve: (key, value) => {},      // Promise resolved
    onReject: (key, error) => {},       // Promise rejected
}
```

## Recipe: API Client

Protect an API call with rate limiting, circuit breaker, and retry:

```typescript
const fetchUser = composeFlow(
    async (id: string) => {

        const res = await fetch(`/api/users/${id}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
    },
    {
        rateLimit: { maxCalls: 50, windowMs: 60000 },
        circuitBreaker: { maxFailures: 5, resetAfter: 30000 },
        retry: { retries: 3, delay: 1000, backoff: 2 },
    }
)

const [user, err] = await attempt(() => fetchUser('42'))
```

## Recipe: Deduped + Timed Search

Share in-flight search requests and enforce a time budget:

```typescript
const search = composeFlow(
    async (query: string) => {

        const res = await fetch(`/api/search?q=${query}`)
        return res.json()
    },
    {
        inflight: { generateKey: (query) => query },
        withTimeout: { timeout: 3000 },
    }
)

// Three concurrent searches for "react" → one network call, 3s max
const [a, b, c] = await Promise.all([
    attempt(() => search('react')),
    attempt(() => search('react')),
    attempt(() => search('react')),
])
```

## Recipe: Full Protection Stack

All five controls, outermost to innermost:

```typescript
const protectedApi = composeFlow(callExternalService, {
    rateLimit: { maxCalls: 100, windowMs: 60000 },
    inflight: { generateKey: (req) => req.id },
    circuitBreaker: { maxFailures: 10, resetAfter: 60000 },
    retry: {
        retries: 3,
        delay: 500,
        backoff: 2,
        shouldRetry: (err) => !(err instanceof ValidationError),
    },
    withTimeout: { timeout: 5000 },
})
```

## Recipe: Retry with Logging and Fallback

```typescript
const fetchWithFallback = composeFlow(fetchData, {
    circuitBreaker: { maxFailures: 3, resetAfter: 15000 },
    retry: {
        retries: 3,
        delay: 1000,
        backoff: 2,
        onRetry: (err, attempt) => {
            console.log(`Retry ${attempt}: ${err.message}`)
        },
        onRetryExhausted: (err) => {
            console.warn(`All retries failed: ${err.message}`)
            return { data: [], fromCache: true }
        },
    },
})
```

## Using Individual Controls (Without composeFlow)

When you only need one protection, use the function directly:

```typescript
// One-shot retry
const data = await retry(fetchData, { retries: 3, delay: 1000 })

// Reusable retryable function
const resilientFetch = makeRetryable(fetchData, { retries: 3 })

// One-shot timeout (returns null on timeout)
const result = await runWithTimeout(fetchData, { timeout: 5000 })

// Reusable timed function
const timedFetch = withTimeout(fetchData, { timeout: 5000 })

// Circuit breaker
const protected = circuitBreaker(apiCall, { maxFailures: 5, resetAfter: 30000 })

// Rate limit
const limited = rateLimit(apiCall, { maxCalls: 10, windowMs: 60000 })

// Inflight dedup
const deduped = withInflightDedup(fetchUser, { generateKey: (id) => id })
```
