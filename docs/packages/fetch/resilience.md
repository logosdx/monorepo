---
title: Resilience
description: Retry configuration, timeouts, and error handling in FetchEngine.
---

# Resilience


FetchEngine provides robust resilience features including intelligent retry logic, flexible timeout configuration, and comprehensive error handling.

[[toc]]


## Retry Configuration


The retry option accepts three types of values:
- `true` - Enable retries with default configuration
- `false` - Disable retries completely
- `RetryConfig` object - Custom retry configuration

**Default values (when `retry: true` or partial config):**

```typescript
{
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    useExponentialBackoff: true,
    retryableStatusCodes: [408, 429, 499, 500, 502, 503, 504]
}
```


### RetryConfig Interface


```typescript
interface RetryConfig {

    maxAttempts?: number; // default: 3
    baseDelay?: number; // default: 1000 (in milliseconds)
    maxDelay?: number; // default: 10000
    useExponentialBackoff?: boolean; // default: true
    retryableStatusCodes?: number[]; // default: [408, 429, 499, 500, 502, 503, 504]

    // shouldRetry can return a boolean or a custom delay in milliseconds
    // When returning a number, it specifies the exact delay before the next retry
    // default: () => true
    shouldRetry?: (error: FetchError, attempt: number) => boolean | number;
}
```


### Custom Retry Logic


The `shouldRetry` function will be awaited and can return:

- `true` - Retry with default exponential backoff (uses `baseDelay`)
- `false` - Don't retry
- `number` - Retry with this exact delay in milliseconds (overrides exponential backoff)

**Examples:**

```typescript
// Use default retry configuration
const defaultRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: true  // Uses defaults: 3 attempts, 1s base delay, exponential backoff
});

// Disable retries completely
const noRetryApi = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: false  // No retries at all
});

// Custom retry logic with shouldRetry
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: {
        maxAttempts: 5,
        baseDelay: 1000, // Used for exponential backoff when shouldRetry returns true
        shouldRetry: (error, attempt) => {
            // Custom delay for rate limits (overrides exponential backoff)
            if (error.status === 429) {
                const retryAfter = error.headers?.['retry-after'];
                return retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            }

            // Don't retry client errors
            if (error.status >= 400 && error.status < 500) {
                return false;
            }

            // Custom delay for server errors (overrides exponential backoff)
            if (error.status >= 500) {
                return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
            }

            return true; // Use default exponential backoff with baseDelay
        }
    }
});
```


## Timeout Configuration


FetchEngine provides two complementary timeout mechanisms for fine-grained control over request timing:

- **`totalTimeout`**: Caps the entire request lifecycle, including all retry attempts
- **`attemptTimeout`**: Applies per-attempt, with each retry getting a fresh timeout


### Type Definitions


```typescript
interface TimeoutOptions {

    /**
     * Total timeout for the entire request lifecycle in milliseconds.
     * Applies to the complete operation including all retry attempts.
     * When this fires, the request stops immediately with no more retries.
     */
    totalTimeout?: number;

    /**
     * Per-attempt timeout in milliseconds.
     * Each retry attempt gets a fresh timeout and AbortController.
     * When an attempt times out, it can still be retried (if retry is configured).
     */
    attemptTimeout?: number;

    /**
     * @deprecated Use `totalTimeout` instead. This is now an alias for `totalTimeout`.
     */
    timeout?: number;
}
```


### Basic Usage


```typescript
// Instance-level timeouts
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    totalTimeout: 30000,   // 30s max for entire operation
    attemptTimeout: 5000   // 5s per attempt
});

// Per-request overrides
const [response, err] = await attempt(() =>
    api.get('/slow-endpoint', {
        totalTimeout: 60000,   // Override: 60s for this request
        attemptTimeout: 10000  // Override: 10s per attempt
    })
);
```


### How Timeouts Work Together


When both timeouts are configured, they work in a parent-child relationship:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     totalTimeout (30s)                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ Attempt 1 (5s)  │  │ Attempt 2 (5s)  │  │ Attempt 3 (5s)  │     │
│  │ attemptTimeout  │  │ attemptTimeout  │  │ attemptTimeout  │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│         ↓                    ↓                    ↓                 │
│     [timeout]            [timeout]            [success]            │
│     retry →              retry →              return               │
└─────────────────────────────────────────────────────────────────────┘
```

**Key behaviors:**

1. **totalTimeout fires**: Everything stops immediately, no more retries
2. **attemptTimeout fires**: That attempt fails, but can retry if configured
3. **Both configured**: Each attempt has its own fresh AbortController


### Controller Architecture


```
┌──────────────────────────────────────────────────────────────────┐
│                    Parent Controller                              │
│                 (totalTimeout attached)                           │
│                                                                   │
│    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐    │
│    │    Child 1    │   │    Child 2    │   │    Child 3    │    │
│    │ (attempt 1)   │   │ (attempt 2)   │   │ (attempt 3)   │    │
│    │ attemptTimeout│   │ attemptTimeout│   │ attemptTimeout│    │
│    └───────────────┘   └───────────────┘   └───────────────┘    │
│                                                                   │
│  - Parent abort → All children abort (totalTimeout fired)        │
│  - Child abort → Only that attempt fails (attemptTimeout fired)  │
└──────────────────────────────────────────────────────────────────┘
```


### With Retry Configuration


```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    totalTimeout: 30000,   // 30s total
    attemptTimeout: 5000,  // 5s per attempt
    retry: {
        maxAttempts: 5,
        baseDelay: 1000,
        useExponentialBackoff: true
    }
});

// Scenario: Each attempt can take up to 5s, retries if it times out
// Total operation cannot exceed 30s regardless of retry attempts
const [response, err] = await attempt(() => api.get('/flaky-endpoint'));

if (err && err.timedOut) {
    // The request timed out (either totalTimeout or attemptTimeout)
    console.log('Request timed out after all retries');
}
```


### Default Retry Behavior with Timeouts


The default `shouldRetry` function returns `true` for status code `499`, which is set when a request is aborted (including by `attemptTimeout`). This means:

- **attemptTimeout fires** → Status 499 → Can retry (if within maxAttempts)
- **totalTimeout fires** → Parent controller aborts → No retry possible

```typescript
// Default retry configuration
{
    maxAttempts: 3,
    baseDelay: 1000,
    retryableStatusCodes: [408, 429, 499, 500, 502, 503, 504],
    shouldRetry(error) {
        if (error.status === 499) return true; // Includes attemptTimeout
        return this.retryableStatusCodes?.includes(error.status) ?? false;
    }
}
```


### Migration from `timeout`


The `timeout` option is deprecated but continues to work as an alias for `totalTimeout`:

```typescript
// Old code (still works)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    timeout: 5000
});

// New code (recommended)
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    totalTimeout: 5000
});

// Both are equivalent - totalTimeout applies to entire lifecycle
```

::: warning Migration Note
If you were using `timeout` expecting it to be per-attempt, you should now use `attemptTimeout` instead. The behavior of `timeout` (now `totalTimeout`) has always been for the entire operation.
:::


### Real-World Examples


**API Gateway with Strict Limits:**

```typescript
// Gateway has 30s hard limit, but individual services might be slow
const api = new FetchEngine({
    baseUrl: 'https://gateway.example.com',
    totalTimeout: 28000,    // Under gateway limit
    attemptTimeout: 8000,   // Allow slow services
    retry: {
        maxAttempts: 3,
        baseDelay: 500
    }
});
```

**User-Facing with Fallback:**

```typescript
const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    totalTimeout: 10000,    // Users won't wait more than 10s
    attemptTimeout: 3000,   // Quick feedback per attempt
    retry: {
        maxAttempts: 3,
        shouldRetry: (error) => {
            // Only retry on timeout, not on 4xx errors
            return error.timedOut || error.status >= 500;
        }
    }
});
```

**Background Sync with Long Tolerance:**

```typescript
const syncApi = new FetchEngine({
    baseUrl: 'https://sync.example.com',
    totalTimeout: 300000,   // 5 minutes for batch operations
    attemptTimeout: 60000,  // 1 minute per attempt
    retry: {
        maxAttempts: 5,
        baseDelay: 5000,
        useExponentialBackoff: true
    }
});
```


## Error Handling


### FetchError


```typescript
interface FetchError<T = {}, H = Record<string, string>> extends Error {

    data: T | null;            // Response body (if parseable)
    status: number;            // HTTP status code
    method: HttpMethods;       // HTTP method used
    path: string;              // Request path
    aborted?: boolean;         // Whether request was cancelled (any cause)
    timedOut?: boolean;        // Whether abort was caused by timeout
    attempt?: number;          // Retry attempt number
    step?: 'fetch' | 'parse' | 'response'; // Where error occurred
    url?: string;              // Full request URL
    headers?: H;               // Response headers

    // Helper methods for distinguishing 499 error types
    isCancelled(): boolean;    // Manual abort (user/app initiated)
    isTimeout(): boolean;      // Timeout fired (attemptTimeout or totalTimeout)
    isConnectionLost(): boolean; // Server/network dropped connection
}
```

**Important:**

- Server-aborted responses receive status code `499` (following Nginx convention)
- Parse errors without status codes receive status code `999`


### The `timedOut` Flag


The `FetchError` object includes a `timedOut` flag that distinguishes timeout aborts from other abort causes:

```typescript
interface FetchError<T = {}, H = Record<string, string>> extends Error {

    // ... other properties

    /**
     * Whether the request was aborted (any cause: manual, timeout, or server).
     */
    aborted?: boolean;

    /**
     * Whether the abort was caused by a timeout (attemptTimeout or totalTimeout).
     * - `true`: The abort was caused by a timeout firing
     * - `undefined`: The abort was manual or server-initiated
     *
     * When `timedOut` is true, `aborted` will also be true.
     */
    timedOut?: boolean;
}
```

**Usage:**

```typescript
const [response, err] = await attempt(() =>
    api.get('/endpoint', { totalTimeout: 5000 })
);

if (err) {
    if (err.aborted && err.timedOut) {
        // Timed out - show user-friendly message
        console.log('Request took too long');
    }
    else if (err.aborted) {
        // Manual abort or server disconnect
        console.log('Request was cancelled');
    }
    else {
        // Other error (network, HTTP error, etc.)
        console.log('Request failed:', err.message);
    }
}
```


### FetchError Helper Methods


All three scenarios below result in status code 499, but have different causes. Use these helper methods to distinguish them:

| Method | Returns `true` when | Use case |
|--------|---------------------|----------|
| `isCancelled()` | Request was manually aborted (not by timeout) | User navigated away, component unmounted |
| `isTimeout()` | Timeout fired (`attemptTimeout` or `totalTimeout`) | Show "request timed out" message |
| `isConnectionLost()` | Server dropped connection or network failed | Show "connection lost" message |

::: info
All helper methods return `false` for non-499 errors. They only apply to connection-level failures.
:::

**Example:**

```typescript
const [response, err] = await attempt(() => api.get('/data'));

if (err) {
    if (err.isCancelled()) {
        // User/app intentionally cancelled - don't show error
        return;
    }

    if (err.isTimeout()) {
        toast.warn('Request timed out. Please try again.');
    }
    else if (err.isConnectionLost()) {
        toast.error('Connection lost. Check your internet.');
    }
    else {
        // HTTP error (4xx, 5xx) - check err.status directly
        toast.error(`Request failed: ${err.message}`);
    }
}
```

**How it works:**

The helpers combine multiple error properties to determine the cause:

```typescript
// isCancelled(): Manual abort (user navigated away, app cancelled)
status === 499 && aborted === true && timedOut !== true

// isTimeout(): Our timeout fired
status === 499 && timedOut === true

// isConnectionLost(): Server/network dropped us (we didn't abort)
status === 499 && step === 'fetch' && aborted === false
```


### Type Guard


```typescript
isFetchError(error: unknown): error is FetchError
```

**Example:**

```typescript
const [response, err] = await attempt(() => api.get('/users'));

if (err) {
    if (isFetchError(err)) {
        // Types are available
        console.log('HTTP Error:', err.status, err.message);
        console.log('Failed at step:', err.step);
        console.log('Response data:', err.data);
    }
    else {
        console.log('Network or other error:', err.message);
    }
}
```
