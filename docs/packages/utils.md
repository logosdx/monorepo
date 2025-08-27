---
title: Utils
description: Production utilities that compose. Resilience built in.
---

# Utils

Building resilient applications requires more than basic utilities. @logosdx/utils provides everything you need: retry failed operations with backoff, protect services with circuit breakers, control flow with rate limiting and debouncing, optimize performance with memoization, safely clone and merge complex objects, and handle errors with Go-style tuples instead of exceptions. Every utility is designed to compose - stack retry on circuit breaker on timeout. Full TypeScript support catches errors at compile time. It's the foundation for applications that don't break in production.

[[toc]]

## Installation


::: code-group

```bash [npm]
npm install @logosdx/utils
```

```bash [yarn]
yarn add @logosdx/utils
```

```bash [pnpm]
pnpm add @logosdx/utils
```

:::

**CDN:**
```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/utils@latest/dist/browser.min.js"></script>
<script>
  const { attempt, retry, clone } = LogosDx.Utils;
</script>
```

## Quick Start

```typescript
import { attempt } from '@logosdx/utils'

// Replace try-catch with error tuples
const [user, err] = await attempt(() =>
    fetch('/api/users/123').then(r => r.json())
)

if (err) {
    console.error('Failed to fetch user:', err.message)
    return
}

console.log('User loaded:', user.name)
```

## Core Concepts

Go-style error tuples provide predictable error handling without try-catch blocks. Functions return `[result, null]` on success or `[null, error]` on failure. Compose flow control utilities for resilient, production-ready operations.

## Error Handling

### `attempt()`

Go-style error handling for async operations. Returns a tuple: `[result, error]`.

```ts
function attempt<T extends () => Promise<any>>(fn: T): Promise<ResultTuple<Awaited<ReturnType<T>>>>

type ResultTuple<T> = [T, null] | [null, Error]
```

**Parameters:**

- `fn` - Async function to execute safely

**Returns:** Promise resolving to `[result, null]` on success or `[null, error]` on failure

**Example:**

```ts
import { attempt } from '@logosdx/utils'

// Basic usage
const [user, err] = await attempt(() =>
    fetch('/api/users/123').then(r => r.json())
)

if (err) {

    console.error('Failed to fetch user:', err.message)
    return
}

console.log('User loaded:', user.name)

// With payment API
const [payment, paymentErr] = await attempt(() =>
    fetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({ amount: 10000, method: 'card' })
    }).then(r => r.json())
)

if (paymentErr) {

    if (paymentErr.message.includes('Payment details failed')) {

        showError('Payment processing failed - please check your details')
    }
    else {

        showError('Could not process your payment - please try again')
    }
    return
}

processPaymentConfirmation(payment)
```

**Best Practices:**

- Use for all I/O operations (fetch, database, file system)
- Don't use for pure business logic functions
- Always check the error before using the result

---

### `attemptSync()`

Synchronous version of `attempt()` for operations that might throw.

```ts
function attemptSync<T extends () => any>(fn: T): ResultTuple<ReturnType<T>>
```

**Parameters:**

- `fn` - Synchronous function to execute safely

**Returns:** `[result, null]` on success or `[null, error]` on failure

**Example:**

```ts
import { attemptSync } from '@logosdx/utils'

// JSON parsing (classic failure case)
const [data, parseErr] = attemptSync(() => JSON.parse(rawJson))

if (parseErr) {

    console.error('Invalid JSON:', parseErr.message)
    return defaultData
}

// Custom validation
const [validated, validationErr] = attemptSync(() => {

    if (!data.category) throw new Error('Category is required')

    if (!['premium', 'standard', 'basic'].includes(data.category)) {

        throw new Error('Invalid category')
    }

    return data
})

if (validationErr) {

    showError(`Validation failed: ${validationErr.message}`)
    return
}
```

## Flow Control

### `retry()`

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
    jitterFactor?: number              // Add randomness 0-1 (default: 0)
    shouldRetry?: (error: Error) => boolean
    signal?: AbortSignal               // For cancellation
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
```

---

### `circuitBreaker()`

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

### `withTimeout()`

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

### `composeFlow()`

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

### `rateLimit()`

Control the frequency of function calls with a token bucket algorithm.

```ts
function rateLimit<T extends (...args: any[]) => any>(
    fn: T,
    options: RateLimitOptions<T>
): T

interface RateLimitOptions<T> {
    maxCalls: number                   // Maximum calls per window
    windowMs: number                   // Time window in milliseconds
    throws?: boolean                   // Throw error or wait (default: true)
    onRateLimit?: (...args: Parameters<T>) => void
}
```

**Example:**

```ts
import { rateLimit, attempt } from '@logosdx/utils'

// Respect external API limits
const limitedSearch = rateLimit(
    async (query: string) => {

        const response = await fetch(`/api/search?q=${query}`)
        return response.json()
    },
    {
        maxCalls: 10,
        windowMs: 1000,    // 10 calls per second
        throws: false,     // Queue requests instead of throwing
        onRateLimit: (query) => {

            console.log(`Search for "${query}" rate limited, queuing...`)
            showToast('Searching... please wait')
        }
    }
)

// Advanced rate limiting with token bucket
class RateLimitTokenBucket {
    constructor(capacity: number, refillIntervalMs: number)

    consume(count?: number): boolean
    waitForToken(count?: number, options?: {
        onRateLimit?: Function
        abortController?: AbortController
    }): Promise<void>

    get tokens(): number
    get snapshot(): BucketSnapshot
    reset(): void
}

// Manual token management
const bucket = new RateLimitTokenBucket(50, 1000) // 50 tokens, refill 1 per second

const makeAPICall = async (data: any) => {

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
```

---

### `batch()`

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

## Data Operations

### `clone()`

Deep clone any JavaScript value, including modern types like Maps, Sets, and WeakRefs.

```ts
function clone<T>(value: T): T
```

**Example:**

```ts
import { clone } from '@logosdx/utils'

// Complex state with modern JS types
const appState = {
    users: new Map([
        ['user1', {
            name: 'Alice',
            permissions: new Set(['read', 'write', 'admin']),
            lastLogin: new Date(),
            metadata: new WeakRef(heavyObject)
        }]
    ]),
    config: {
        features: new Map([['darkMode', true]]),
        cache: new WeakMap([[key, value]]),
        history: [
            { timestamp: new Date(), action: 'login' }
        ]
    }
}

// Perfect deep clone that preserves all types
const clonedState = clone(appState)
// Maps are Maps, Sets are Sets, Dates are Dates, WeakRefs are WeakRefs

// Safe state updates
const updateUserPermissions = (state: AppState, userId: string, newPermissions: string[]) => {

    const newState = clone(state)
    const user = newState.users.get(userId)

    if (user) {

        user.permissions = new Set(newPermissions)
        user.lastModified = new Date()
    }

    return newState
}
```

---

### `equals()`

Deep equality comparison that handles all JavaScript types correctly.

```ts
function equals(a: unknown, b: unknown): boolean
```

**Example:**

```ts
import { equals } from '@logosdx/utils'

// Compare complex objects
const state1 = {
    users: new Map([['u1', { name: 'Alice', roles: new Set(['admin']) }]]),
    lastSync: new Date('2023-01-01')
}

const state2 = {
    users: new Map([['u1', { name: 'Alice', roles: new Set(['admin']) }]]),
    lastSync: new Date('2023-01-01')
}

console.log(equals(state1, state2)) // true

// Use in React components to prevent unnecessary re-renders
const MyComponent = ({ data }) => {

    const [prevData, setPrevData] = useState(data)

    useEffect(() => {

        if (!equals(prevData, data)) {

            // Data actually changed, update UI
            setPrevData(data)
            updateExpensiveVisualization(data)
        }
    }, [data, prevData])

    // Component only re-renders when data actually changes
}

// Use for offer comparison
const compareOffers = (offer1: Offer, offer2: Offer) => {

    if (equals(offer1.terms, offer2.terms)) {

        return 'These offers have identical terms'
    }

    return 'These offers have different terms'
}
```

---

### `merge()`

Deep merge objects while preserving types and handling edge cases.

```ts
function merge<T, U>(target: T, source: U, options?: MergeOptions): T & U

interface MergeOptions {
    mergeArrays?: boolean;
    mergeSets?: boolean;
}
```

**Example:**

```ts
import { merge } from '@logosdx/utils'

// Basic merging
const defaultConfig = {
    api: { timeout: 5000, retries: 3 },
    features: { darkMode: false, beta: false }
}

const userConfig = {
    api: { timeout: 10000 },
    features: { darkMode: true }
}

const finalConfig = merge(defaultConfig, userConfig)
// Result: {
//   api: { timeout: 10000, retries: 3 },
//   features: { darkMode: true, beta: false }
// }

// Advanced merging with modern types
const currentState = {
    users: new Map([['u1', { name: 'Alice' }]]),
    permissions: new Set(['read']),
    history: [{ action: 'login' }]
}

const updates = {
    users: new Map([['u2', { name: 'Bob' }]]),
    permissions: new Set(['write']),
    history: [{ action: 'logout' }]
}

const newState = merge(currentState, updates, {
    mergeArrays: true,
    mergeSets: true
})

// Customer profile merging
const mergeCustomerProfiles = (existing: CustomerProfile, updates: Partial<CustomerProfile>) => {

    return merge(existing, updates, {
        mergeArrays: false,
        mergeSets: false
    })
}
```

---

### `reach()`

Type-safe property access with dot notation paths.

```ts
function reach<T, P extends PathNames<T>>(obj: T, path: P): PathValue<T, P> | undefined

// Type utilities for path navigation
type PathNames<T> = // All possible dot-notation paths in T
type PathValue<T, P extends string> = // Type at specific path
```

**Example:**

```ts
import { reach } from '@logosdx/utils'

// Complex nested data
interface CustomerData {
    profile: {
        personal: {
            name: string
            email: string
        }
        preferences: {
            theme: 'light' | 'dark' | 'auto'
            loanTypes: string[]
        }
    }
    loanHistory: {
        totalLoans: number
        averageAmount: number
    }
    metadata: Map<string, any>
}

const customer: CustomerData = {
    profile: {
        personal: { name: 'Alice', email: 'alice@example.com' },
        preferences: { theme: 'dark', subscriptions: ['personal', 'auto'] }
    },
    loanHistory: { totalLoans: 3, averageAmount: 15000 },
    metadata: new Map([['vip', true]])
}

// Type-safe property access
const name = reach(customer, 'profile.personal.name')           // string | undefined
const email = reach(customer, 'profile.personal.email')        // string | undefined
const theme = reach(customer, 'profile.preferences.theme') // 'light' | 'dark' | 'auto' | undefined
const totalLoans = reach(customer, 'loanHistory.totalLoans')   // number | undefined

// Safe access with fallbacks
const displayName = reach(customer, 'profile.personal.name') ?? 'Anonymous Customer'
const preferredTheme = reach(customer, 'profile.preferences.theme') ?? 'light'
const loanCount = reach(customer, 'loanHistory.totalLoans') ?? 0

// Build type-safe form systems
const createFormField = <T, P extends PathNames<T>>(
    data: T,
    path: P,
    label: string
) => {

    const value = reach(data, path)
    const type = typeof value

    return {
        path,
        label,
        value,
        type,
        required: value === undefined
    }
}

const nameField = createFormField(customer, 'profile.personal.name', 'Full Name')
const emailField = createFormField(customer, 'profile.personal.email', 'Email Address')
```

## Performance & Caching

### `memoize()` and `memoizeSync()`

Cache function results with TTL, LRU eviction, and cache management.

```ts
function memoize<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options?: MemoizeOptions<T>
): EnhancedMemoizedFunction<T>

function memoizeSync<T extends (...args: any[]) => any>(
    fn: T,
    options?: MemoizeOptions<T>
): EnhancedMemoizedFunction<T>

interface MemoizeOptions<T> {
    ttl?: number                       // Time to live in ms (default: 60000)
    maxSize?: number                   // Max cache entries (default: 1000)
    generateKey?: (args: Parameters<T>) => string
    useWeakRef?: boolean              // Use WeakRef for values (default: false)
    staleIn?: number                   // Time in ms after which data is stale (enables stale-while-revalidate)
    staleTimeout?: number              // Maximum wait time for fresh data when stale (default: 100ms)
    onError?: (error: Error, args: Parameters<T>) => void
    cleanupInterval?: number          // Background cleanup interval (default: 60000)
}

interface EnhancedMemoizedFunction<T> extends T {
    cache: {
        clear(): void
        delete(key: string): boolean
        has(key: string): boolean
        size: number
        stats(): CacheStats
        keys(): IterableIterator<string>
        entries(): Array<[string, any]>
    }
}

interface CacheStats {
    hits: number
    misses: number
    hitRate: number
    size: number
    evictions: number
}
```

**Example:**

```ts
import { memoize, memoizeSync, attempt } from '@logosdx/utils'

// Basic expensive loan calculation
const calculateLoanTerms = memoize(
    async (customerId: string, amount: number, creditScore: number) => {

        // Complex calculation involving multiple API calls
        const [rates, rateErr] = await attempt(() => fetchCurrentRates())

        if (rateErr) throw rateErr

        const [history, histErr] = await attempt(() => fetchCustomerHistory(customerId))

        if (histErr) throw histErr

        // Expensive computation
        return computeOptimalTerms(amount, creditScore, rates, history)
    },
    {
        ttl: 300000,        // Cache for 5 minutes
        maxSize: 1000,      // Keep 1000 most recent calculations
        generateKey: (customerId, amount, creditScore) =>
            `${customerId}:${amount}:${creditScore}`,
        onCacheHit: (key) => {

            console.log(`Cache hit for loan calculation: ${key}`)
            metrics.increment('loan_calc.cache.hit')
        },
        onCacheMiss: (key) => {

            console.log(`Cache miss for loan calculation: ${key}`)
            metrics.increment('loan_calc.cache.miss')
        }
    }
)

// Stale-while-revalidate loan calculation for instant responses
const fastLoanTerms = memoize(
    async (customerId: string, amount: number, creditScore: number) => {

        // Same expensive calculation as above
        const [rates, rateErr] = await attempt(() => fetchCurrentRates())
        if (rateErr) throw rateErr

        const [history, histErr] = await attempt(() => fetchCustomerHistory(customerId))
        if (histErr) throw histErr

        return computeOptimalTerms(amount, creditScore, rates, history)
    },
    {
        ttl: 600000,        // Cache for 10 minutes
        staleIn: 120000,    // Consider stale after 2 minutes
        staleTimeout: 300,  // Wait max 300ms for fresh data
        maxSize: 1000,
        generateKey: (customerId, amount, creditScore) =>
            `${customerId}:${amount}:${creditScore}`
    }
)

// Stale-while-revalidate behavior:
// - If data is fresh (< 2 minutes): return cached data immediately
// - If data is stale (> 2 minutes): race cached vs fresh data
//   - Return cached data if fresh data takes > 300ms
//   - Return fresh data if it arrives within 300ms
//   - Always update cache with fresh data in background

// Synchronous memoization for pure functions
const formatCurrency = memoizeSync(
    (amount: number, currency: string = 'USD') => {

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency
        }).format(amount)
    },
    {
        maxSize: 500,
        generateKey: (amount, currency) => `${amount}:${currency}`
    }
)

// Cache management
const getLoanTerms = async (customerId: string, amount: number) => {

    // Get customer credit score
    const [customer, err] = await attempt(() => fetchCustomer(customerId))

    if (err) return { error: 'Customer not found' }

    // Use fast stale-while-revalidate calculation for instant UX
    const [terms, calcErr] = await attempt(() =>
        fastLoanTerms(customerId, amount, customer.creditScore)
    )

    if (calcErr) return { error: 'Could not calculate loan terms' }

    return { terms }
}

// Monitor cache performance
console.log(calculateLoanTerms.cache.stats())
// { hits: 45, misses: 12, hitRate: 0.79, size: 57, evictions: 2 }

// Clear cache when rates change
const onRateUpdate = () => {

    console.log('Interest rates updated, clearing loan calculation cache')
    calculateLoanTerms.cache.clear()
}
```

---

### `debounce()`

Delay function execution until calls stop for a specified period. Enhanced with `flush()`, `cancel()`, and `maxWait` options.

```ts
function debounce<T extends (...args: any[]) => any>(
    fn: T,
    options: DebounceOptions
): DebouncedFunction<T>

interface DebounceOptions {
    delay: number                      // Delay in milliseconds
    maxWait?: number                   // Maximum wait time before execution
}

interface DebouncedFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void
    flush(): ReturnType<T> | undefined  // Execute immediately and return result
    cancel(): void                      // Stop pending execution
}
```

**Example:**

```ts
import { debounce, attempt } from '@logosdx/utils'

// Search as user types (wait for them to stop)
const searchCustomers = debounce(
    async (query: string) => {

        if (query.length < 2) return

        const [results, err] = await attempt(() =>
            fetch(`/api/customers/search?q=${query}`).then(r => r.json())
        )

        if (err) {

            console.error('Search failed:', err.message)
            showToast('Search unavailable, please try again')
            return
        }

        updateSearchResults(results)
        showToast(`Found ${results.length} customers`)
        return results
    },
    {
        delay: 300,      // Wait 300ms after user stops typing
        maxWait: 1500    // Force execution after 1.5s maximum
    }
)

// Enhanced interface usage
const performSearch = async (query: string) => {

    searchCustomers(query)

    // Execute immediately if needed
    const results = searchCustomers.flush()
    if (results) {
        console.log('Immediate results:', results)
    }

    // Cancel pending search
    if (shouldCancelSearch) {
        searchCustomers.cancel()
    }
}

// Auto-save form data
const autoSaveForm = debounce(
    async (formData: FormData) => {

        const [saved, err] = await attempt(() =>
            fetch('/api/auto-save', {
                method: 'POST',
                body: JSON.stringify(formData)
            })
        )

        if (err) {

            console.warn('Auto-save failed:', err.message)
            showToast('Could not auto-save. Please save manually.')
            return
        }

        showToast('Draft saved automatically')
    },
    {
        delay: 2000,  // Save 2 seconds after user stops editing
        onDebounce: () => showToast('Saving draft...')
    }
)

// Use in React
const SearchInput = () => {

    const [query, setQuery] = useState('')

    const handleSearch = useCallback((value: string) => {

        setQuery(value)
        searchCustomers(value)  // Debounced automatically
    }, [])

    return (
        <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search customers..."
        />
    )
}
```

---

### `throttle()`

Limit function execution frequency to a maximum rate. Enhanced with `cancel()` capability to clear throttle state.

```ts
function throttle<T extends (...args: any[]) => any>(
    fn: T,
    options: ThrottleOptions
): ThrottledFunction<T>

interface ThrottleOptions {
    delay: number                      // Minimum delay between calls
    throws?: boolean                   // Throw error when throttled (default: true)
    onThrottle?: (...args: any[]) => void
}

interface ThrottledFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): ReturnType<T>
    cancel(): void                     // Clear throttle state and allow immediate execution
}
```

**Example:**

```ts
import { throttle } from '@logosdx/utils'

// Limit scroll event handling
const handleScroll = throttle(
    (event: Event) => {

        const scrollPercent = window.scrollY / document.body.scrollHeight
        updateScrollIndicator(scrollPercent)

        // Track analytics (but not too frequently)
        analytics.track('page_scroll', {
            percent: Math.round(scrollPercent * 100),
            page: window.location.pathname
        })
    },
    {
        delay: 100,     // Maximum 10 times per second
        throws: false,  // Don't throw when throttled
        onThrottle: () => {

            // Optional callback when throttled
            console.log('Scroll event throttled')
        }
    }
)

// Limit API calls for real-time features
const updateUserPresence = throttle(
    async (userId: string, activity: string) => {

        const [updated, err] = await attempt(() =>
            fetch('/api/presence', {
                method: 'PUT',
                body: JSON.stringify({ userId, activity, timestamp: Date.now() })
            })
        )

        if (err) {

            console.warn('Presence update failed:', err.message)
        }
    },
    {
        delay: 5000,    // Update presence at most every 5 seconds
        throws: false
    }
)

// Rate limit button clicks
const submitLoanApplication = throttle(
    async (application: LoanApplication) => {

        const [result, err] = await attempt(() =>
            fetch('/loan-requests/create-magic', {
                method: 'POST',
                body: JSON.stringify(application)
            }).then(r => r.json())
        )

        if (err) {

            showError('Could not submit application. Please try again.')
            return
        }

        showSuccess('Application submitted successfully!')
        showConfirmation(result.confirmationId)
    },
    {
        delay: 2000,    // Prevent double-clicks
        throws: false,
        onThrottle: () => {

            showToast('Please wait before submitting again')
        }
    }
)

// Enhanced interface usage
const handleFormSubmit = (application: LoanApplication) => {

    submitLoanApplication(application)

    // Reset throttle if user cancels
    if (userCanceled) {
        submitLoanApplication.cancel()
        showToast('Submission canceled - you can submit again now')
    }
}
```

## Validation & Type Guards

### `assert()`

Basic assertion with custom error messages and types.

```ts
function assert(test: unknown, message?: string, ErrorClass?: typeof Error): void
```

**Example:**

```ts
import { assert } from '@logosdx/utils'

// Basic assertions
const processLoanApplication = (app: unknown) => {

    assert(app, 'Loan application is required')
    assert(typeof app === 'object', 'Application must be an object')
    assert(app.amount > 0, 'Loan amount must be positive')
    assert(app.category, 'Category is required')

    // Custom error types
    assert(
        ['premium', 'standard', 'basic'].includes(app.category),
        'Invalid category selection',
        ValidationError
    )

    // Now TypeScript knows app is valid
    return processValidApplication(app)
}

// Use in function parameters
const calculateInterest = (principal: number, rate: number, term: number) => {
    assert(principal > 0, 'Principal must be positive')
    assert(rate >= 0 && rate <= 1, 'Rate must be between 0 and 1')
    assert(term > 0, 'Term must be positive')
    assert(Number.isInteger(term), 'Term must be whole number of months')

    return principal * rate * term
}
```

---

### `assertObject()`

Deep object validation with path-based assertions.

```ts
function assertObject<T extends object>(
    obj: T,
    assertions: AssertionMap<T>
): void

type AssertionMap<T> = {
    [P in PathNames<T>]?: (value: PathValue<T, P>) => [boolean, string]
}
```

**Example:**

```ts
import { assertObject, attempt } from '@logosdx/utils'

// Validate complex customer data
const validateCustomerData = (data: unknown) => {

    assertObject(data, {
        // Basic required fields
        'id': (val) => [
            typeof val === 'string' && val.length > 0,
            'Customer ID must be non-empty string'
        ],

        'profile.email': (val) => [
            typeof val === 'string' && val.includes('@'),
            'Email must be valid format'
        ],

        'profile.name': (val) => [
            typeof val === 'string' && val.trim().length >= 2,
            'Name must be at least 2 characters'
        ],

        // Financial validation
        'loanHistory.totalLoans': (val) => [
            typeof val === 'number' && val >= 0,
            'Total loans must be non-negative number'
        ],

        'loanHistory.averageAmount': (val) => [
            typeof val === 'number' && val > 0,
            'Average loan amount must be positive'
        ],

        // Preference validation
        'preferences.theme': (val) => [
            ['light', 'dark', 'auto'].includes(val),
            'Theme must be light, dark, or auto'
        ],

        'preferences.notificationsPerDay': (val) => [
            typeof val === 'number' && val >= 0 && val <= 10,
            'Notifications per day must be between 0 and 10'
        ],

        // Optional field validation
        'metadata.vipStatus': (val) => [
            val === undefined || typeof val === 'boolean',
            'VIP status must be boolean if present'
        ]
    })

    // If we get here, data is valid
    return data as ValidatedCustomerData
}

// Use with API responses
const loadCustomerProfile = async (customerId: string) => {

    const [rawData, fetchErr] = await attempt(() =>
        fetch(`/api/customers/${customerId}`).then(r => r.json())
    )

    if (fetchErr) {

        return { error: 'Could not load customer profile' }
    }

    const [customer, validationErr] = attemptSync(() =>
        validateCustomerData(rawData)
    )

    if (validationErr) {

        console.error('Customer data validation failed:', validationErr.message)
        return {
            error: 'Customer data is corrupted. Please contact support.',
            details: validationErr.message
        }
    }

    return { customer }
}
```

---

### Type Guards

Collection of utility functions for runtime type checking.

```ts
// Basic type guards
function isFunction(a: unknown): a is Function
function isObject(a: unknown): a is Object
function isPlainObject(a: unknown): a is object
function isPrimitive(val: unknown): boolean
function isUndefined(val: unknown): val is undefined
function isDefined(val: unknown): val is NonNullable<unknown>
function isNull(val: unknown): val is null

// Collection validation
function allKeysValid<T extends object>(
    item: T,
    check: (value: T[keyof T], key: string | number) => boolean
): boolean

function allItemsValid<I extends Iterable<unknown>>(
    item: I,
    check: (value: unknown) => boolean
): boolean
```

**Example:**

```ts
import {
    isFunction,
    isObject,
    isPrimitive,
    isDefined,
    allKeysValid,
    allItemsValid
} from '@logosdx/utils'

// Build custom type guards
const isLoanApplication = (value: unknown): value is LoanApplication => {

    if (!isObject(value)) return false

    const obj = value as Record<string, unknown>

    return (
        typeof obj.id === 'string' &&
        typeof obj.amount === 'number' &&
        obj.amount > 0 &&
        ['personal', 'auto', 'home', 'business'].includes(obj.type) &&
        isDefined(obj.applicant) &&
        isObject(obj.applicant)
    )
}

// Validate configuration objects
const validateConfig = (config: unknown) => {

    if (!isObject(config)) return false

    return allKeysValid(config, (value, key) => {

        // All config values must be defined and not functions
        return isDefined(value) && !isFunction(value)
    })
}

// Validate arrays
const validateStringArray = (arr: unknown): arr is string[] => {

    if (!Array.isArray(arr)) return false

    return allItemsValid(arr, (item) => typeof item === 'string')
}

// Use in request handlers
const handleLoanApplication = (req: Request) => {

    const body = req.body

    if (!isLoanApplication(body)) {

        return new Response('Invalid loan application format', { status: 400 })
    }

    // TypeScript now knows body is LoanApplication
    return processLoanApplication(body)
}

// Environment detection
import { isBrowser, isNode, isReactNative } from '@logosdx/utils'

const setupEnvironment = () => {

    if (isBrowser()) {

        // Browser-specific setup
        setupAnalytics()
        registerServiceWorker()
    }
    else if (isNode()) {

        // Node.js-specific setup
        setupLogging()
        connectToDatabase()
    }
    else if (isReactNative()) {

        // React Native-specific setup
        setupNativeModules()
    }
}
```

## Error Types & Utilities

All flow control utilities throw specific error types for better error handling:

```ts
// Error classes
class RetryError extends Error {}
class TimeoutError extends Error {}
class CircuitBreakerError extends Error {}
class RateLimitError extends Error {}
class ThrottleError extends Error {}
class AssertError extends Error {}

// Type guards
function isRetryError(error: unknown): error is RetryError
function isTimeoutError(error: unknown): error is TimeoutError
function isCircuitBreakerError(error: unknown): error is CircuitBreakerError
function isRateLimitError(error: unknown): error is RateLimitError
function isThrottleError(error: unknown): error is ThrottleError
function isAssertError(error: unknown): error is AssertError
```

**Example:**

```ts
import {
    attempt,
    isTimeoutError,
    isRetryError,
    isCircuitBreakerError,
    isRateLimitError
} from '@logosdx/utils'

const handleLoanProcessing = async (application: LoanApplication) => {

    const [result, err] = await attempt(() => processLoanWithAllProtections(application))

    if (err) {

        // Handle each error type specifically
        if (isTimeoutError(err)) {

            return {
                error: 'Your application is taking longer than expected. Please wait while we process it.',
                canRetry: true,
                suggestedDelay: 30000
            }
        }

        if (isRateLimitError(err)) {

            return {
                error: 'You\'re submitting applications too quickly. Please wait before trying again.',
                canRetry: true,
                suggestedDelay: err.retryAfter || 60000
            }
        }

        if (isCircuitBreakerError(err)) {

            return {
                error: 'Our loan processing system is temporarily experiencing issues. Your application will be reviewed manually.',
                canRetry: false,
                fallbackAction: 'manual_review'
            }
        }

        if (isRetryError(err)) {

            return {
                error: 'We encountered multiple issues processing your application. Please try again later.',
                canRetry: true,
                suggestedDelay: 300000 // 5 minutes
            }
        }

        // Unknown error
        console.error('Unexpected loan processing error:', err)
        return {
            error: 'An unexpected issue occurred. Please contact support if this persists.',
            canRetry: false,
            contactSupport: true
        }
    }

    return { success: true, result }
}
```
