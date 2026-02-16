# Resilience Error Recovery

## Error Types from Flow Controls

Each flow control utility throws a specific error class with a matching type guard:

| Error | Guard | When Thrown |
|-------|-------|------------|
| `RetryError` | `isRetryError(err)` | All retry attempts exhausted |
| `TimeoutError` | `isTimeoutError(err)` | Operation exceeded time limit |
| `CircuitBreakerError` | `isCircuitBreakerError(err)` | Circuit is open, not accepting calls |
| `RateLimitError` | `isRateLimitError(err)` | Rate limit exceeded |
| `ThrottleError` | `isThrottleError(err)` | Throttle limit exceeded |

All imports from `@logosdx/utils`.

## Basic Error Handling

```typescript
import {
    attempt,
    isRetryError,
    isTimeoutError,
    isCircuitBreakerError,
    isRateLimitError,
} from '@logosdx/utils'

const [result, err] = await attempt(() => protectedApiCall())

if (err) {

    if (isTimeoutError(err)) {
        // Show timeout UI, don't retry
        return { status: 'timeout', message: 'Request took too long' }
    }

    if (isCircuitBreakerError(err)) {
        // Service is known to be down — show maintenance page
        return { status: 'service-down', message: 'Service temporarily unavailable' }
    }

    if (isRateLimitError(err)) {
        // Back off — show "try again later"
        return { status: 'rate-limited', message: 'Too many requests' }
    }

    if (isRetryError(err)) {
        // All retries failed — persistent issue
        return { status: 'failed', message: 'Unable to complete request' }
    }

    // Unknown error
    throw err
}
```

## Recovery Strategies

### Fallback Values

```typescript
// Option 1: onRetryExhausted returns a fallback (no throw)
const data = await retry(fetchData, {
    retries: 3,
    onRetryExhausted: (err) => {
        console.warn('Using cached data:', err.message)
        return cachedData
    },
})

// Option 2: Catch and provide fallback
const [data, err] = await attempt(() => protectedFetch())
const result = err ? fallbackData : data
```

### Graceful Degradation

```typescript
const [primary, primaryErr] = await attempt(() => fetchFromPrimary())

if (primaryErr) {

    if (isCircuitBreakerError(primaryErr)) {
        // Primary is down — try secondary
        const [secondary, secondaryErr] = await attempt(() => fetchFromSecondary())
        if (secondaryErr) return staleCache()
        return secondary
    }

    if (isTimeoutError(primaryErr)) {
        // Primary is slow — use cached data
        return staleCache()
    }

    throw primaryErr
}
```

### Retry with Original Error

By default, `retry()` throws `RetryError`. Use `throwLastError` to get the original:

```typescript
const [result, err] = await attempt(() =>
    retry(fetchData, {
        retries: 3,
        throwLastError: true,  // Throws the actual error, not RetryError
    })
)

if (err) {
    // err is the original error from fetchData (e.g., TypeError, FetchError)
    // not wrapped in RetryError
    console.log(err.message)  // "Network timeout" not "Max retries reached"
}
```

### Conditional Retry

```typescript
const resilient = makeRetryable(apiCall, {
    retries: 5,
    delay: 1000,
    backoff: 2,
    shouldRetry: (err) => {

        // Don't retry client errors (4xx)
        if (isFetchError(err) && err.status >= 400 && err.status < 500) return false

        // Don't retry validation errors
        if (isAssertError(err)) return false

        // Retry everything else
        return true
    },
})
```

## Composing Error Handling with FetchEngine

When using `composeFlow` with code that also uses `FetchEngine`, you may see both `@logosdx/utils` errors and `FetchError`:

```typescript
import { isFetchError } from '@logosdx/fetch'
import { isTimeoutError, isCircuitBreakerError, isRetryError } from '@logosdx/utils'

const [result, err] = await attempt(() => protectedApiCall())

if (err) {

    // Flow control errors (from composeFlow wrappers)
    if (isTimeoutError(err)) return handleTimeout()
    if (isCircuitBreakerError(err)) return handleCircuitOpen()
    if (isRetryError(err)) return handleRetryExhausted()

    // HTTP errors (from FetchEngine)
    if (isFetchError(err)) {

        if (err.isCancelled()) return  // user navigated away
        if (err.isTimeout()) return handleTimeout()
        if (err.status === 404) return handleNotFound()
        if (err.status >= 500) return handleServerError()
    }

    throw err
}
```

## Error Guard Priority

When multiple flow controls are composed, errors bubble outward. The outermost wrapper's error type is what you'll see:

```typescript
const protected = composeFlow(fetchData, {
    circuitBreaker: { maxFailures: 3, resetAfter: 30000 },  // outer
    retry: { retries: 3, delay: 1000 },                     // inner
})

// If the circuit is open → CircuitBreakerError (doesn't even try)
// If retries exhaust → RetryError (circuit breaker sees a failure)
// After enough RetryErrors → circuit opens → CircuitBreakerError
```

## Monitoring Resilience

```typescript
const protectedApi = composeFlow(apiCall, {
    circuitBreaker: { maxFailures: 5, resetAfter: 30000 },
    retry: {
        retries: 3,
        delay: 1000,
        onRetry: (err, attempt) => {
            metrics.increment('api.retry', { attempt, error: err.message })
        },
        onRetryExhausted: (err) => {
            metrics.increment('api.retry_exhausted')
            return null
        },
    },
})

const [result, err] = await attempt(() => protectedApi())

if (err) {

    if (isCircuitBreakerError(err)) metrics.increment('api.circuit_open')
    if (isRateLimitError(err)) metrics.increment('api.rate_limited')
}
```
