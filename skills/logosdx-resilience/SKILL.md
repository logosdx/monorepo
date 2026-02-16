---
name: logosdx-resilience
description: "Use when building resilient async operations with @logosdx/utils. Covers composeFlow for layering retry, timeout, circuit breaker, rate limit, and inflight dedup."
license: MIT
metadata:
  author: logosdx
  version: "1.0"
---

## Quick Start

```typescript
import { composeFlow, attempt, isTimeoutError, isCircuitBreakerError } from '@logosdx/utils'

// Layer multiple protections on an API call
const resilientFetch = composeFlow(fetchUserData, {
    rateLimit: { maxCalls: 100, windowMs: 60000 },
    circuitBreaker: { maxFailures: 5, resetAfter: 30000 },
    retry: { retries: 3, delay: 1000, backoff: 2 },
})

// Use with attempt() — always
const [data, err] = await attempt(() => resilientFetch(userId))

if (err) {

    if (isTimeoutError(err)) return showTimeout()
    if (isCircuitBreakerError(err)) return showServiceDown()
    throw err
}
```

## Critical Rules

1. **Key order = wrapping order.** The first key in the options object wraps outermost. Rate limit first means it guards before any retries happen.
2. **Minimum 2 controls.** `composeFlow` requires at least 2 keys. For a single control, use the individual function directly (`retry()`, `withTimeout()`, etc.).
3. **Always wrap in `attempt()`.** Composed functions throw typed errors (`RetryError`, `TimeoutError`, `CircuitBreakerError`, `RateLimitError`). Use `attempt()` and typed guards to handle them.
4. **Use typed error guards.** Import `isTimeoutError`, `isCircuitBreakerError`, `isRetryError`, `isRateLimitError` for exhaustive error handling.

## Available Controls

| Control | Key | What It Does |
|---------|-----|-------------|
| Rate limit | `rateLimit` | Limits call frequency with token bucket |
| Circuit breaker | `circuitBreaker` | Stops calling after N failures, auto-resets |
| Retry | `retry` | Retries on failure with exponential backoff |
| Timeout | `withTimeout` | Fails if operation exceeds time limit |
| Inflight dedup | `inflight` | Shares in-flight promises for same key |

## Recommended Wrapping Order

```typescript
const protected = composeFlow(apiCall, {
    rateLimit: { ... },        // Outermost: prevents flooding
    inflight: { ... },         // Dedup before expensive retries
    circuitBreaker: { ... },   // Stop if service is down
    retry: { ... },            // Retry transient failures
    withTimeout: { ... },      // Innermost: time-bound each attempt
})
```

**Why this order:**
- **Rate limit outermost** — prevents calling when quota is exhausted, before any other work happens
- **Inflight dedup** — avoids retrying when an identical call is already in-flight
- **Circuit breaker** — fails fast when the service is known to be down
- **Retry** — retries transient failures (timeouts, 5xx)
- **Timeout innermost** — each individual attempt gets a time budget

## Individual Controls (for single use)

```typescript
import {
    retry, makeRetryable,
    circuitBreaker,
    withTimeout, runWithTimeout,
    rateLimit,
    withInflightDedup,
} from '@logosdx/utils'

// Retry — one-shot
const data = await retry(fetchData, { retries: 3, delay: 1000, backoff: 2 })

// Retry — wraps function for reuse
const resilientFetch = makeRetryable(fetchData, { retries: 3, delay: 1000 })

// Circuit breaker
const protectedApi = circuitBreaker(apiCall, { maxFailures: 5, resetAfter: 30000 })

// Timeout — wraps function
const timedFetch = withTimeout(fetchData, { timeout: 5000 })

// Timeout — one-shot (returns null on timeout)
const result = await runWithTimeout(fetchData, { timeout: 5000 })

// Rate limit
const limited = rateLimit(apiCall, { maxCalls: 10, windowMs: 60000 })

// Inflight dedup
const deduped = withInflightDedup(fetchUser, {
    generateKey: (id) => id,
})
```

See [resilience-flow-recipes.md](references/resilience-flow-recipes.md) and [resilience-error-recovery.md](references/resilience-error-recovery.md) for detailed patterns.

## References

- [resilience-flow-recipes.md](references/resilience-flow-recipes.md) — Composition recipes, individual control options, and production patterns
- [resilience-error-recovery.md](references/resilience-error-recovery.md) — Error types, guard functions, recovery strategies, and fallback patterns
