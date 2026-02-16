# Error Type Catalog

All error classes and their typed guards from `@logosdx/utils` and related packages. The only exception is `FetchError` from `@logosdx/fetch`, which is documented in the package-specific section.

## Core Error Tuple

```typescript
type ResultTuple<T> = [T, null] | [null, Error]

// attempt() — async operations
const attempt: <T extends () => Promise<any>>(fn: T) => Promise<ResultTuple<Awaited<ReturnType<T>>>>

// attemptSync() — sync operations
const attemptSync: <T extends () => any>(fn: T) => ResultTuple<ReturnType<T>>
```

The tuple guarantees: if `err` is `null`, `result` is `T`. If `err` is `Error`, `result` is `null`. Always check `err` first.

## Flow Control Errors (from @logosdx/utils)

### RetryError

Thrown when all retry attempts are exhausted.

```typescript
import { retry, makeRetryable, isRetryError } from '@logosdx/utils'

const [result, err] = await attempt(() =>
    retry(flakyOperation, { retries: 3, delay: 1000, backoff: 2 })
)

if (err && isRetryError(err)) {
    console.log('All 3 retries failed')
}

// Use throwLastError to get the original error instead of RetryError
const [result2, err2] = await attempt(() =>
    retry(flakyOperation, { retries: 3, throwLastError: true })
)
// err2 is the actual network error, not RetryError
```

### TimeoutError

Thrown when an operation exceeds the time limit.

```typescript
import { withTimeout, runWithTimeout, isTimeoutError } from '@logosdx/utils'

const timedFetch = withTimeout(inconsistentOperation, { timeout: 5000 })
const [result, err] = await attempt(() => timedFetch())

if (err && isTimeoutError(err)) {
    console.log('Operation exceeded 5 seconds')
}

// runWithTimeout returns null on timeout instead of throwing
const result = await runWithTimeout(inconsistentOperation, { timeout: 5000 })
if (result === null) console.log('Timed out')
```

### CircuitBreakerError

Thrown when the circuit is open (too many recent failures).

```typescript
import { circuitBreaker, isCircuitBreakerError } from '@logosdx/utils'

const protected = circuitBreaker(fragileApiCall, {
    maxFailures: 5,
    resetAfter: 30000,
})

const [result, err] = await attempt(() => protected())

if (err && isCircuitBreakerError(err)) {
    console.log('Circuit is open — service is down, will retry after reset period')
}
```

### RateLimitError

Thrown when the rate limit is exceeded (when `throws: true` or using `rateLimit` without `waitForToken`).

```typescript
import { rateLimit, isRateLimitError } from '@logosdx/utils'

const limited = rateLimit(apiCall, {
    maxCalls: 10,
    windowMs: 60000,
})

const [result, err] = await attempt(() => limited())

if (err && isRateLimitError(err)) {
    console.log('Rate limit exceeded')
}
```

### ThrottleError

Thrown when a throttled function is called too frequently (when `throws: true`).

```typescript
import { throttle, isThrottleError } from '@logosdx/utils'

const throttled = throttle(handler, { delay: 1000, throws: true })

const [result, err] = attemptSync(() => throttled())

if (err && isThrottleError(err)) {
    console.log('Call throttled')
}
```

### AssertError

Thrown by `assert()` and `assertObject()` when validation fails.

```typescript
import { assert, assertObject, isAssertError } from '@logosdx/utils'

assert(isObject(config), 'Config must be an object')  // throws AssertError

assertObject(user, {
    'id': (val) => [typeof val === 'string', 'ID must be string'],
    'profile.email': (val) => [val.includes('@'), 'Invalid email'],
})
```

## Package-Specific Errors

### FetchError (from @logosdx/fetch)

Rich error with HTTP context. Has convenience methods for 499 (abort/timeout) scenarios.

```typescript
import { isFetchError, FetchError } from '@logosdx/fetch'

const [response, err] = await attempt(() => api.get('/users'))

if (err && isFetchError(err)) {
    console.log(err.status)     // HTTP status code
    console.log(err.method)     // 'GET'
    console.log(err.path)       // '/users'
    console.log(err.data)       // response body if available
    console.log(err.requestId)  // unique request ID for tracing
    console.log(err.step)       // 'fetch' | 'parse' | 'response'

    // Convenience methods for 499 errors
    if (err.isCancelled()) { /* user/app aborted */ }
    if (err.isTimeout()) { /* timeout fired */ }
    if (err.isConnectionLost()) { /* network/server dropped */ }
}
```

### EventError (from @logosdx/observer)

Thrown by EventGenerator when used after cleanup.

```typescript
import { isEventError } from '@logosdx/observer'

const generator = observer.on('event')
generator.cleanup()

const [value, err] = await attempt(() => generator.next())

if (err && isEventError(err)) {
    console.log(err.event)     // event name
    console.log(err.listener)  // listener reference
}
```

## Error Handling Composition Pattern

Layer error guards from outermost to innermost:

```typescript
const [result, err] = await attempt(() => resilientCall())

if (err) {

    // Check specific flow control errors first
    if (isTimeoutError(err)) return { status: 'timeout' }
    if (isCircuitBreakerError(err)) return { status: 'service-down' }
    if (isRateLimitError(err)) return { status: 'rate-limited' }
    if (isRetryError(err)) return { status: 'exhausted' }

    // Check package-specific errors
    if (isFetchError(err)) return { status: 'http-error', code: err.status }

    // Unknown error — rethrow
    throw err
}
```
