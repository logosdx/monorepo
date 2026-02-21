---
title: Flow Control
description: Retry, circuit breaker, timeout, rate limiting, and batch processing utilities.
---

# Flow Control

## `retry()`

Add retry logic to any function with customizable backoff and conditions.

```ts
function retry<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: RetryOptions
): Promise<ReturnType<T>>

interface RetryOptions {
    retries?: number                    // Max retry attempts (default: 3)
    delay?: number                      // Initial delay in ms (default: 0)
    backoff?: number                    // Delay multiplier (default: 1)
    jitterFactor?: number               // Add randomness 0-1 (default: 0)
    shouldRetry?: (error: Error) => boolean
    signal?: AbortSignal                // For cancellation
    throwLastError?: boolean            // Throw original error instead of RetryError (default: false)
    onRetry?: (error: Error, attempt: number) => void | Promise<void>  // Callback before each retry
    onRetryExhausted?: (error: Error) => T | Promise<T>  // Fallback handler when retries exhausted
}
```

**Example:**

```ts
import { retry, attempt } from '@logosdx/utils'

// Basic retry with exponential backoff
const resilientFetch = retry(
    async (url: string) => {

        const response = await fetch(url)

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        return response.json()
    },
    {
        retries: 3,
        delay: 1000,    // 1s, 2s, 4s with backoff: 2
        backoff: 2,
        jitterFactor: 0.1  // Add 10% randomness
    }
)

// Advanced retry with custom logic
const smartRetry = retry(
    async (request: ApiRequest) => {

        const response = await fetch('/api/process', {
            method: 'POST',
            body: JSON.stringify(request)
        })

        if (!response.ok) {

            if (response.status === 402) {

                throw new Error('Payment required')
            }

            throw new Error(`Request failed: ${response.status}`)
        }

        return response.json()
    },
    {
        retries: 5,
        delay: 2000,
        shouldRetry: (error, attempt) => {

            // Don't retry client errors
            if (error.message.includes('Payment required')) {

                return false
            }

            // Custom delay for rate limits
            if (error.message.includes('429')) {

                return { delay: 60000 } // Wait 1 minute
            }

            // Only retry server errors
            return attempt < 5 && error.message.includes('50')
        },
        onRetry: (error, attempt) => {

            console.log(`Retry ${attempt} after error: ${error.message}`)
            metrics.increment('api.retry', { attempt })
        }
    }
)

const [result, err] = await attempt(() => smartRetry(application))

// Preserve original error for downstream handling
// Use throwLastError when you need the actual error type, not RetryError
const [loanResult, loanErr] = await attempt(() =>
    retry(
        () => fetchLoanStatus(loanId),
        {
            retries: 3,
            delay: 500,
            throwLastError: true  // Throws actual error, not "Max retries reached"
        }
    )
)

if (loanErr) {

    // loanErr is the original error (e.g., NetworkError, TimeoutError)
    // not a RetryError with generic "Max retries reached" message
    console.log(loanErr.message)  // e.g., "Connection refused" or "Timeout"
}

// Graceful fallback when retries exhausted
// Use onRetryExhausted to return a fallback value instead of throwing
const userProfile = await retry(
    () => fetchUserProfile(userId),
    {
        retries: 3,
        delay: 100,
        onRetryExhausted: (error) => {

            logger.warn(`Profile fetch failed after retries: ${error.message}`)

            // Return cached/default profile instead of throwing
            return {
                id: userId,
                name: 'Unknown User',
                avatar: '/default-avatar.png',
                fromCache: true
            }
        }
    }
)
// userProfile is either the fetched profile or the fallback - never throws
```

---

## `circuitBreaker()`

Prevent cascading failures by opening a circuit when too many requests fail.

```ts
function circuitBreaker<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: CircuitBreakerOptions<T>
): T

interface CircuitBreakerOptions<T> {
    maxFailures?: number               // Failures before opening (default: 5)
    resetAfter?: number               // Time to wait before trying again (ms, default: 30000)
    onOpen?: () => void              // Called when circuit opens
    onClose?: () => void             // Called when circuit closes
    onHalfOpen?: () => void          // Called when testing recovery
}
```

**Example:**

```ts
import { circuitBreaker, attempt } from '@logosdx/utils'

// Protect external service calls
const protectedInventoryAPI = circuitBreaker(
    async (productId: string) => {

        const response = await fetch(`/api/inventory/${productId}`)

        if (!response.ok) throw new Error(`Inventory API failed: ${response.status}`)

        return response.json()
    },
    {
        maxFailures: 5,
        resetAfter: 30000, // 30 seconds
        onOpen: () => {

            console.warn('Inventory API circuit opened - using cached data')
            notifyOps('Inventory API circuit opened')
            enableInventoryFallback()
        },
        onClose: () => {

            console.info('Inventory API circuit closed - back to normal')
            disableInventoryFallback()
        }
    }
)

// Use with attempt pattern
const checkInventory = async (productId: string) => {

    const [inventory, err] = await attempt(() => protectedInventoryAPI(productId))

    if (err) {

        if (err.message.includes('Circuit breaker open')) {

            // Return cached data
            return getCachedInventory(productId)
        }

        throw err
    }

    return inventory
}
```

---

## `withTimeout()`

Add timeout protection to any async function.

```ts
function withTimeout<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: WithTimeoutOptions
): T

interface WithTimeoutOptions {
    timeout: number                    // Timeout in milliseconds
    onTimeout?: (...args: any[]) => void
}
```

**Example:**

```ts
import { withTimeout, attempt } from '@logosdx/utils'

// Basic timeout
const timedFetch = withTimeout(
    async (url: string) => {

        const response = await fetch(url)
        return response.json()
    },
    {
        timeout: 5000,
        onTimeout: (url) => {

            console.warn(`Request to ${url} timed out after 5 seconds`)
            metrics.increment('api.timeout', { url })
        }
    }
)

// Use with slow decision APIs
const getDecision = withTimeout(
    async (applicationId: string) => {

        // This endpoint can be slow
        const response = await fetch(`/api/decisions/${applicationId}`)
        return response.json()
    },
    {
        timeout: 30000, // 30 seconds timeout
        onTimeout: (appId) => {

            console.log('Decision is taking longer than expected...')
            showToast('Your request is still being processed')
        }
    }
)

const [decision, err] = await attempt(() => getLoanDecision('loan-123'))

if (err && err.name === 'TimeoutError') {

    showMessage('Your application is still being reviewed. We\'ll notify you when ready.')
}
```

---

## `composeFlow()`

Compose multiple flow control patterns into a single function.

```ts
function composeFlow<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: ComposeFlowOptions<T>
): T

interface ComposeFlowOptions<T> {
    withTimeout?: WithTimeoutOptions
    retry?: RetryOptions
    circuitBreaker?: CircuitBreakerOptions<T>
    rateLimit?: RateLimitOptions<T>
}
```

**Example:**

```ts
import { composeFlow, attempt } from '@logosdx/utils'

// Create a bulletproof API client
const bulletproofAPI = composeFlow(
    async (endpoint: string, options: RequestInit = {}) => {

        const response = await fetch(endpoint, options)

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        return response.json()
    },
    {
        // Layer 1: Timeout protection
        withTimeout: {
            timeout: 5000,
            onTimeout: (endpoint) => console.warn(`${endpoint} timed out`)
        },

        // Layer 2: Rate limiting
        rateLimit: {
            maxCalls: 100,
            windowMs: 60000,
            onRateLimit: () => console.log('Rate limited, queuing...')
        },

        // Layer 3: Retry logic
        retry: {
            retries: 3,
            delay: 1000,
            backoff: 2,
            shouldRetry: (error) => error.message.includes('50')
        },

        // Layer 4: Circuit breaker
        circuitBreaker: {
            maxFailures: 5,
            resetAfter: 30000,
            onOpen: () => console.error('API circuit opened')
        }
    }
)

// Now every call gets all protections
const [users, err] = await attempt(() => bulletproofAPI('/api/users'))
```

---

## `rateLimit()`

Control the frequency of function calls with a token bucket algorithm.

```ts
function rateLimit<T extends (...args: any[]) => any>(
    fn: T,
    options: RateLimitOptions<T> | RateLimitBucketOptions<T>
): T

interface RateLimitOptions<T> {
    maxCalls: number                   // Maximum calls per window
    windowMs?: number                  // Time window in milliseconds (default: 1000)
    throws?: boolean                   // Throw error or wait (default: true)
    onLimitReached?: (error: RateLimitError, nextAvailable: Date, args: Parameters<T>) => void
}

interface RateLimitBucketOptions<T> {
    bucket: RateLimitTokenBucket       // Use existing bucket instance
    throws?: boolean                   // Throw error or wait (default: true)
    onLimitReached?: (error: RateLimitError, nextAvailable: Date, args: Parameters<T>) => void
}
```

**Example:**

```ts
import { rateLimit, RateLimitTokenBucket, attempt } from '@logosdx/utils'

// Basic rate limiting
const limitedSearch = rateLimit(
    async (query: string) => {

        const response = await fetch(`/api/search?q=${query}`)
        return response.json()
    },
    {
        maxCalls: 10,
        windowMs: 1000,    // 10 calls per second
        throws: false,     // Queue requests instead of throwing
        onLimitReached: (error, nextAvailable, [query]) => {

            console.log(`Search for "${query}" rate limited until ${nextAvailable}`)
            showToast('Searching... please wait')
        }
    }
)

// Advanced rate limiting with token bucket
class RateLimitTokenBucket {
    constructor(config: RateLimitTokenBucket.Config)

    consume(count?: number): boolean
    hasTokens(count?: number): boolean  // Check without consuming
    waitForToken(count?: number, options?: {
        onRateLimit?: Function
        abortController?: AbortController
    }): Promise<void>
    waitAndConsume(count?: number, options?: { ... }): Promise<boolean>

    get tokens(): number
    get snapshot(): BucketSnapshot
    get state(): RateLimitTokenBucket.State  // For persistence
    get isSaveable(): boolean  // True if save/load configured

    save(): Promise<void>  // Persist current state
    load(): Promise<void>  // Load state from backend
    reset(): void
}

namespace RateLimitTokenBucket {
    interface Config {
        capacity: number              // Max tokens
        refillIntervalMs: number      // Time per token refill
        initialState?: State          // Restore from previous state
        save?: SaveFn                 // Persistence callback
        load?: LoadFn                 // Load callback
    }
    interface State {
        tokens: number
        lastRefill: number
        stats?: Stats
    }
}

// Manual token management
const bucket = new RateLimitTokenBucket({
    capacity: 50,
    refillIntervalMs: 1000  // Refill 1 token per second
})

const makeAPICall = async (data: any) => {

    // Check if we can proceed
    if (!bucket.hasTokens()) {

        console.log('Rate limit reached, waiting...')
    }

    // Wait for token to be available
    await bucket.waitForToken(1, {
        onRateLimit: () => console.log('Waiting for rate limit...'),
        abortController: new AbortController()
    })

    // Make the call
    const [result, err] = await attempt(() => fetch('/api/data', {
        method: 'POST',
        body: JSON.stringify(data)
    }))

    return [result, err]
}

// With persistence (e.g., Redis backend)
const persistentBucket = new RateLimitTokenBucket({
    capacity: 100,
    refillIntervalMs: 60000,  // 1 token per minute
    save: async (state) => {

        await redis.set('rate-limit:user:123', JSON.stringify(state))
    },
    load: async () => {

        const data = await redis.get('rate-limit:user:123')
        return data ? JSON.parse(data) : null
    }
})

// Load state before using
await persistentBucket.load()

// Check and consume
if (persistentBucket.hasTokens()) {

    persistentBucket.consume()
    await persistentBucket.save()
}

// Use bucket with rateLimit function (auto-load/save when isSaveable)
const persistentLimitedApi = rateLimit(apiCall, {
    bucket: persistentBucket,
    throws: true
})

// When bucket.isSaveable is true, rateLimit automatically:
// 1. Calls load() before each rate limit check
// 2. Calls save() after each successful consume
await persistentLimitedApi(data)  // Auto-loads, consumes, auto-saves
```

---

## `batch()`

Process arrays with controlled concurrency and comprehensive error handling.

```ts
function batch<T, R>(
    fn: (item: T) => Promise<R>,
    options: BatchOptions<T, R>
): Promise<BatchResult<T, R>[]>

interface BatchOptions<T, R> {
    items: T[]
    concurrency?: number               // Parallel operations (default: 10)
    failureMode?: 'abort' | 'continue' // Abort or continue on errors
    onError?: (error: Error, item: T, itemIndex: number) => void
    onStart?: (total: number) => void
    onEnd?: (results: BatchResult<T, R>[]) => void
    onChunkStart?: (params: { index: number, total: number, items: T[], processedCount: number, remainingCount: number, completionPercent: number }) => void
    onChunkEnd?: (params: { index: number, total: number, items: T[], processedCount: number, remainingCount: number, completionPercent: number }) => void
}

interface BatchResult<T, R> {
    result: R | null
    error: Error | null
    item: T
    index: number
    itemIndex: number
}
```

**Example:**

```ts
import { batch, attempt } from '@logosdx/utils'

// Process applications in batches
const processApplications = async (applications: Application[]) => {

    const results = await batch(
        async (app: Application) => {

            // Each application processed independently
            const [result, err] = await attempt(() =>
                fetch('/api/process', {
                    method: 'POST',
                    body: JSON.stringify(app)
                }).then(r => r.json())
            )

            if (err) {

                throw new Error(`Failed to process ${app.id}: ${err.message}`)
            }

            return {
                applicationId: app.id,
                approved: result.approved,
                referenceId: result.referenceId,
                metadata: result.metadata
            }
        },
        {
            items: applications,
            concurrency: 5,           // Process 5 at a time
            failureMode: 'continue',  // Keep going if some fail
            onProgress: (completed, total) => {

                const percent = Math.round((completed / total) * 100)
                updateProgressBar(percent)
                console.log(`Processing applications: ${completed}/${total} (${percent}%)`)
            },
            onError: (error, app) => {

                console.error(`Failed to process application ${app.id}:`, error.message)
                // Could add to dead letter queue for manual processing
                deadLetterQueue.add({ application: app, error: error.message })
            },
            onChunkStart: ({ index, total }) => {

                console.log(`Starting batch ${index + 1} of ${total}`)
            }
        }
    )

    // Separate successful from failed results
    const successful = results.filter(r => r.result !== null)
    const failed = results.filter(r => r.error !== null)

    return {
        processed: successful.length,
        failed: failed.length,
        results: successful.map(r => r.result)
    }
}
```

---

## `makeRetryable()`

Wraps a function so every call automatically retries with the configured options. Unlike `retry()` which executes immediately, `makeRetryable()` returns a new function with retry behavior baked in.

```ts
function makeRetryable<T extends Func>(fn: T, opts: RetryOptions): T
```

**Example:**

```ts
import { makeRetryable, attempt } from '@logosdx/utils'

// Create a retryable version of an API call
const fetchUser = makeRetryable(
    async (id: string) => {

        const response = await fetch(`/api/users/${id}`)

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        return response.json()
    },
    {
        retries: 3,
        delay: 1000,
        backoff: 2
    }
)

// Every call to fetchUser now automatically retries
const [user, err] = await attempt(() => fetchUser('123'))
```

---

## `runWithTimeout()`

Executes a function once with timeout protection using `Promise.race`. Unlike `withTimeout()` which wraps a function for repeated use, `runWithTimeout()` runs the function immediately.

```ts
function runWithTimeout<T extends Func>(
    func: T,
    opts: WithTimeoutOptions
): Promise<ReturnType<T>>

interface WithTimeoutOptions {
    timeout: number                          // Timeout in milliseconds
    abortController?: AbortController        // Cancel the operation on timeout
    onError?: (error: Error, didTimeout: boolean) => void
    onTimeout?: (error: TimeoutError) => void
    throws?: boolean                         // Rethrow non-timeout errors
}
```

**Example:**

```ts
import { runWithTimeout, attempt, isTimeoutError } from '@logosdx/utils'

// One-shot execution with timeout
const [result, err] = await attempt(() =>
    runWithTimeout(
        () => fetch('/api/slow-endpoint').then(r => r.json()),
        {
            timeout: 5000,
            onTimeout: () => console.warn('Request timed out')
        }
    )
)

// With AbortController for cleanup
const controller = new AbortController()

const [data, fetchErr] = await attempt(() =>
    runWithTimeout(
        () => fetch('/api/data', { signal: controller.signal }).then(r => r.json()),
        {
            timeout: 3000,
            abortController: controller  // Aborts fetch on timeout
        }
    )
)
```

---

## `Deferred`

A promise with externally accessible `resolve` and `reject` methods. Useful when the promise needs to be controlled from outside its creation context.

```ts
class Deferred<T> {
    promise: Promise<T>
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: Error | string) => void
}
```

**Example:**

```ts
import { Deferred } from '@logosdx/utils'

// Basic external resolution
const deferred = new Deferred<string>()

deferred.promise.then(result => {
    console.log('Got result:', result)
})

// Resolve from elsewhere
setTimeout(() => deferred.resolve('Hello world!'), 1000)

// Build an async queue
class AsyncQueue<T> {

    private pending = new Map<string, Deferred<T>>()

    async waitFor(id: string): Promise<T> {

        if (!this.pending.has(id)) {
            this.pending.set(id, new Deferred<T>())
        }

        return this.pending.get(id)!.promise
    }

    complete(id: string, result: T) {

        const deferred = this.pending.get(id)

        if (deferred) {

            deferred.resolve(result)
            this.pending.delete(id)
        }
    }
}

// Coordinate multiple async operations
const coordinateWork = () => {

    const coordinator = new Deferred<void>()
    let completed = 0

    const checkComplete = () => {

        if (++completed === 3) {
            coordinator.resolve()
        }
    }

    doWork1().then(checkComplete)
    doWork2().then(checkComplete)
    doWork3().then(checkComplete)

    return coordinator.promise
}
```

---

## `wait()`

Async delay that returns a clearable promise. Resolves after the specified milliseconds with an optional value.

```ts
function wait<T>(ms: number, value?: T): TimeoutPromise<T>

// TimeoutPromise extends Promise with:
interface TimeoutPromise<T> extends Promise<T> {
    clear(): void  // Cancel the timeout
}
```

**Example:**

```ts
import { wait } from '@logosdx/utils'

// Simple delay
await wait(1000)
console.log('One second has passed')

// Resolve with a value
const result = await wait(100, 'some value')
console.log(result) // 'some value'

// Clearable timeout
const timeout = wait(5000)
// ...later, if you need to cancel:
timeout.clear()

// Add delay between operations
for (const item of items) {

    await processItem(item)
    await wait(100) // Throttle processing
}
```

---

## `runInSeries()`

Executes an array of functions synchronously in order and returns their results. Useful for running multiple cleanup functions.

```ts
function runInSeries<T extends Iterable<Func>>(fns: T): ReturnsOfReturns<T>
```

**Example:**

```ts
import { runInSeries } from '@logosdx/utils'

// Run multiple cleanup functions
const cleanupStart = observer.on('start', handler)
const cleanupStop = observer.on('stop', handler)
const cleanupError = observer.on('error', handler)

// Clean up all at once
runInSeries([cleanupStart, cleanupStop, cleanupError])
```

---

## `makeInSeries()`

Creates a function that runs multiple functions in series, passing separate argument arrays to each. Use `as const` for type safety when functions have different parameter types.

```ts
function makeInSeries<T extends readonly ((...args: any[]) => any)[]>(
    fns: T
): (...args: ParamsOfParams<T>) => ReturnsOfReturns<T>
```

**Example:**

```ts
import { makeInSeries } from '@logosdx/utils'

const logStep = (step: string) => console.log(`Step: ${step}`)
const saveData = (data: any) => database.save(data)
const sendNotification = (message: string) => emailService.send(message)

const pipeline = makeInSeries([logStep, saveData, sendNotification] as const)

pipeline(['processing'], [userData], ['User created'])
// Calls: logStep('processing'), saveData(userData), sendNotification('User created')
```
