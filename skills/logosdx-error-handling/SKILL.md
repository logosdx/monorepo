---
name: logosdx-error-handling
description: "Use when implementing error handling in LogosDX code. Covers attempt() vs attemptSync(), error tuples, typed error classes, and when to throw directly vs return error tuples."
license: MIT
metadata:
  author: logosdx
  version: "1.0"
---

## Quick Start

```typescript
import { attempt, attemptSync } from '@logosdx/utils'

// Async I/O — always wrap in attempt()
const [user, err] = await attempt(() => fetchUser(id))
if (err) throw err

// Sync I/O (parsing, etc.) — use attemptSync()
const [config, parseErr] = attemptSync(() => JSON.parse(rawConfig))
if (parseErr) return defaults

// Business logic — throw directly, no error tuple
function validate(email: string): string {

    if (!email.includes('@')) throw new Error('Invalid email')
    return email.toLowerCase()
}
```

## Critical Rules

1. **`attempt()` for async I/O only.** Network calls, file reads, database queries — anything that can fail due to external factors.
2. **`attemptSync()` for sync I/O only.** JSON parsing, regex with untrusted input — sync operations that may throw from external data.
3. **Throw directly for business logic.** Pure computations, validations, and transforms should never be wrapped. If they fail, it's a bug.
4. **Always check `err` before using `result`.** The tuple is `[T, null] | [null, Error]` — accessing `result` when `err` exists gives `null`.
5. **Use typed error guards for flow control errors.** Import `isTimeoutError`, `isRetryError`, etc. to handle specific failure modes.

## Error Type Catalog

| Error Class | Guard | Thrown By |
|-------------|-------|-----------|
| `RetryError` | `isRetryError(err)` | `retry()`, `makeRetryable()` |
| `TimeoutError` | `isTimeoutError(err)` | `withTimeout()`, `runWithTimeout()` |
| `CircuitBreakerError` | `isCircuitBreakerError(err)` | `circuitBreaker()` |
| `RateLimitError` | `isRateLimitError(err)` | `rateLimit()` |
| `ThrottleError` | `isThrottleError(err)` | `throttle()` |
| `AssertError` | `isAssertError(err)` | `assert()`, `assertObject()` |
| `FetchError` | `isFetchError(err)` | `FetchEngine` methods (from `@logosdx/fetch`) |
| `EventError` | `isEventError(err)` | `EventGenerator` (from `@logosdx/observer`) |

See [error-type-catalog.md](references/error-type-catalog.md) for properties and usage.

## Decision Guide

```
Is the operation I/O or external?
├── Yes, async → attempt(() => asyncOp())
├── Yes, sync  → attemptSync(() => syncOp())
└── No (pure logic) → just call it, let bugs throw
```

## Composing Error Handlers

```typescript
import {
    attempt,
    isTimeoutError,
    isCircuitBreakerError,
    isRetryError,
    isRateLimitError,
} from '@logosdx/utils'

const [result, err] = await attempt(() => resilientApiCall())

if (err) {

    if (isTimeoutError(err)) return showTimeout()
    if (isCircuitBreakerError(err)) return showServiceDown()
    if (isRateLimitError(err)) return showRateLimited()
    if (isRetryError(err)) return showRetryExhausted()
    throw err // unknown error — rethrow
}
```

## References

- [error-type-catalog.md](references/error-type-catalog.md) — Full details on each error class, properties, and usage examples
- [migration-from-try-catch.md](references/migration-from-try-catch.md) — Step-by-step guide for replacing try-catch with error tuples
