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

### `setDeep()`

Set values deep within nested objects using dot notation paths. Creates intermediate objects automatically.

```ts
function setDeep<T, P extends PathNames<T>>(
    obj: T,
    path: P,
    value: PathValue<T, P>
): void
```

**Parameters:**

- `obj` - Object to modify (mutated in place)
- `path` - Dot-separated path to target property
- `value` - Value to set at the path

**Example:**

```ts
import { setDeep } from '@logosdx/utils'

// Building configuration incrementally
const config: any = {}

setDeep(config, 'server.port', 3000)
setDeep(config, 'server.host', 'localhost')
setDeep(config, 'database.connection.timeout', 5000)

console.log(config)
// { server: { port: 3000, host: 'localhost' }, database: { connection: { timeout: 5000 } } }

// Setting metrics in monitoring
const metrics: any = { memory: { heap: 100 } }

setDeep(metrics, 'memory.rss', 1024)
setDeep(metrics, 'cpu.user', 50)

console.log(metrics)
// { memory: { heap: 100, rss: 1024 }, cpu: { user: 50 } }

// API response building
function buildSuccessResponse(data: any) {

    const response: any = {}

    setDeep(response, 'status.code', 200)
    setDeep(response, 'status.message', 'OK')
    setDeep(response, 'data.results', data)
    setDeep(response, 'data.timestamp', Date.now())

    return response
}
```

### `setDeepMany()`

Set multiple values deep within nested objects using dot notation paths. Fails fast on first error with helpful error messages including entry index.

```ts
function setDeepMany<T>(
    obj: T,
    entries: Array<[PathNames<T>, any]>
): void
```

**Parameters:**

- `obj` - Object to modify (mutated in place)
- `entries` - Array of `[path, value]` tuples to set

**Example:**

```ts
import { setDeepMany } from '@logosdx/utils'

// Building complete response objects
const response: any = {}

setDeepMany(response, [
    ['status.code', 200],
    ['status.message', 'OK'],
    ['data.results', [1, 2, 3]],
    ['data.total', 3],
    ['meta.timestamp', Date.now()],
    ['meta.version', '1.0.0']
])

// Complex configuration
const appConfig: any = {}

setDeepMany(appConfig, [
    ['server.port', 3000],
    ['server.host', 'localhost'],
    ['database.url', 'postgres://localhost'],
    ['database.pool.min', 2],
    ['database.pool.max', 10],
    ['features.auth.enabled', true],
    ['features.logging.level', 'info'],
    ['features.monitoring.metrics', true]
])

// Setting multiple metrics at once
const systemMetrics: any = { memory: { heap: 100 } }

setDeepMany(systemMetrics, [
    ['memory.rss', 1024],
    ['memory.external', 512],
    ['cpu.user', 50],
    ['cpu.system', 30],
    ['uptime.seconds', 3600]
])
```

**Error Messages:**

Validation errors include entry index for quick debugging:

```ts
// Invalid tuple format
setDeepMany(obj, [
    ['valid', 'works'],
    ['invalid']  // ❌ entry 1 must be a [path, value] tuple
])

// Empty path
setDeepMany(obj, [
    ['valid', 'works'],
    ['', 'oops']  // ❌ entry 1 must have a non-empty string path (received: string)
])

// Errors from setDeep include path context
setDeepMany(obj, [
    ['valid.path', 'works'],
    ['a.b', 'fails']  // ❌ Cannot set property 'b' on null at path: a
])
```

---

### `makeNestedConfig()`

Transform flat environment variables into nested configuration objects with automatic type coercion. Essential for 12-factor apps and containerized deployments.

```ts
function makeNestedConfig<C extends object, F extends Record<string, string>>(
    flatConfig: F,
    opts?: {
        filter?: (key: string, val: string) => boolean
        forceAllCapToLower?: boolean  // Default: true
        separator?: string            // Default: "_"
        stripPrefix?: string | number
        parseUnits?: boolean          // Default: false
        skipConversion?: (key: string, value: unknown) => boolean
        memoizeOpts?: MemoizeOptions | false
    }
): <P extends PathLeaves<C>>(path?: P, defaultValue?: PathValue<C, P>) => C
```

**Example:**

```ts
import { makeNestedConfig } from '@logosdx/utils'

// Given process.env:
// {
//   APP_DB_HOST: 'localhost',
//   APP_DB_PORT: '5432',
//   APP_DEBUG: 'true',
//   APP_FEATURE_X_ENABLED: 'false',
//   APP_WORKER_EMAILS_maxRunsPerMin: '100'
// }

// Define expected config shape for type safety
type AppConfig = {
    db: { host: string; port: number };
    debug: boolean;
    feature: { x: { enabled: boolean } };
    worker: { emails: { maxRunsPerMin: number } };
}

const config = makeNestedConfig<AppConfig>(process.env, {
    filter: (key) => key.startsWith('APP_'),
    stripPrefix: 'APP_',
    forceAllCapToLower: true
})

console.log(config())
// {
//   db: { host: 'localhost', port: 5432 },
//   debug: true,
//   feature: { x: { enabled: false } },
//   worker: { emails: { maxRunsPerMin: 100 } }
// }

// Note: maxRunsPerMin preserved because it's not all-caps

// Reach into config with type-safe path parameter
const dbHost = config('db.host')              // 'localhost'
const dbPort = config('db.port')              // 5432
const isDebug = config('debug')               // true
const maxRuns = config('worker.emails.maxRunsPerMin')  // 100

// Use default values for missing configuration
const apiTimeout = config('api.timeout', 5000)        // 5000 (default)
const maxRetries = config('api.retries', 3)           // 3 (default)
const logLevel = config('logging.level', 'info')      // 'info' (default)

// Memoized configuration for repeated access
const getCachedConfig = makeNestedConfig(process.env, {
    filter: (key) => key.startsWith('APP_'),
    stripPrefix: 'APP_',
    memoizeOpts: { ttl: 300000 }  // Cache for 5 minutes
})

// Custom separators for different naming conventions
const doubleUnderscoreConfig = makeNestedConfig(process.env, {
    filter: (key) => key.startsWith('APP_'),
    stripPrefix: 'APP_',
    separator: '__'
})

// Parse unit values (time durations and byte sizes)
// Given: APP_TIMEOUT='5m', APP_MAX_SIZE='10mb'
const configWithUnits = makeNestedConfig(process.env, {
    filter: (key) => key.startsWith('APP_'),
    stripPrefix: 'APP_',
    parseUnits: true
})
// { timeout: 300000, max: { size: 10485760 } }

// Skip conversion for sensitive keys (keep as strings)
// Given: APP_API_KEY='12345', APP_PORT='3000'
const configWithSkip = makeNestedConfig(process.env, {
    filter: (key) => key.startsWith('APP_'),
    stripPrefix: 'APP_',
    skipConversion: (key) => key.toLowerCase().includes('key')
})
// { api: { key: '12345' }, port: 3000 }
```

**Using the path parameter:**

The returned config function accepts optional `path` and `defaultValue` parameters for direct access to nested values. When you provide a type parameter to `makeNestedConfig`, paths are type-checked and autocomplete in your editor:

```ts
// Define expected config shape for type safety
type AppConfig = {
    db: { host: string; port: number };
    api: { timeout: number };
    logging: { level: string };
}

const getConfig = makeNestedConfig<AppConfig>(process.env, {
    filter: (key) => key.startsWith('APP_'),
    stripPrefix: 'APP_'
})

// Get entire config object (processes all environment variables)
const fullConfig = getConfig()  // Type: AppConfig

// Get specific value by path (type-safe with autocomplete)
const dbHost = getConfig('db.host')      // Type: string
const dbPort = getConfig('db.port')      // Type: number
const apiTimeout = getConfig('api.timeout')  // Type: number

// Get specific value with fallback for optional settings
const timeout = getConfig('api.timeout', 5000)        // Type: number (default if missing)
const logLevel = getConfig('logging.level', 'info')   // Type: string (default if missing)
```

**Benefits of type parameter:**

- Autocomplete for all available paths in your editor
- Compile-time type checking prevents typos in path strings
- Return type is inferred from the path (e.g., `'db.port'` returns `number`)
- Default values must match the expected type

**When to use path parameter:**

- Accessing individual config values in different parts of your application
- Providing sensible defaults for optional configuration
- Hot paths where you only need specific values
- Building config getter utilities with fallback logic

**When to get full config:**

- Application initialization where you need all settings
- Validation of entire configuration structure
- Passing complete config to subsystems

---

### `castValuesToTypes()`

Intelligently coerce string values to their appropriate types. Recursively processes nested objects.

```ts
function castValuesToTypes(
    obj: object,
    opts?: {
        parseUnits?: boolean  // Default: false
        skipConversion?: (key: string, value: unknown) => boolean
    }
): void  // Mutates in place
```

**Example:**

```ts
import { castValuesToTypes } from '@logosdx/utils'

const config = {
    debug: 'true',        // → true
    verbose: 'yes',       // → true
    silent: 'false',      // → false
    disabled: 'no',       // → false
    port: '3000',         // → 3000
    timeout: '5000',      // → 5000
    name: 'myapp',        // → 'myapp' (unchanged)
    nested: {
        enabled: 'true',  // → true (recursive)
        retries: '5'      // → 5 (recursive)
    }
}

castValuesToTypes(config)  // Mutates in place

console.log(config.debug)  // true (boolean)
console.log(config.port)   // 3000 (number)

// Parse unit values
const configWithUnits = {
    timeout: '5m',
    maxSize: '10mb',
    debug: 'true'
}

castValuesToTypes(configWithUnits, { parseUnits: true })
console.log(configWithUnits.timeout)  // 300000 (5 minutes in ms)
console.log(configWithUnits.maxSize)  // 10485760 (10 MB in bytes)

// Skip conversion for specific keys
const configWithSkip = {
    apiKey: '12345',
    port: '3000'
}

castValuesToTypes(configWithSkip, {
    skipConversion: (key) => key.toLowerCase().includes('key')
})
console.log(configWithSkip.apiKey)  // '12345' (kept as string)
console.log(configWithSkip.port)    // 3000 (converted to number)
```

**Recognized values:**
- **Enabled**: `"true"`, `"yes"`, `true`
- **Disabled**: `"false"`, `"no"`, `false`
- **Numbers**: Strings containing only digits (`/^\d+$/`)

---

### `isEnabledValue()` / `isDisabledValue()`

Check if a value represents an enabled or disabled state.

```ts
function isEnabledValue(val: unknown): boolean
function isDisabledValue(val: unknown): boolean
function hasEnabledOrDisabledValue(val: unknown): boolean
```

**Example:**

```ts
import { isEnabledValue, isDisabledValue } from '@logosdx/utils'

// Environment variable checking
if (isEnabledValue(process.env.DEBUG)) {
    enableDebugMode()
}

if (isDisabledValue(process.env.FEATURE_FLAG)) {
    skipFeature()
}

// Configuration validation
const config = {
    featureA: 'true',
    featureB: 'no',
    featureC: 'maybe'
}

Object.entries(config).forEach(([key, value]) => {
    if (isEnabledValue(value)) {
        console.log(`${key}: enabled`)
    } else if (isDisabledValue(value)) {
        console.log(`${key}: disabled`)
    } else {
        console.warn(`${key}: invalid value`)
    }
})
```

---

### Unit Conversion & Formatting

Human-readable time and byte size utilities for configuration, logging, and display.

#### Time Units

```ts
// Constants
const timeUnits: {
    sec: number, min: number, hour: number, day: number, week: number
    secs(n: number): number, mins(n: number): number, hours(n: number): number
    days(n: number): number, weeks(n: number): number
}

// Convenience functions
const seconds: (n: number) => number
const minutes: (n: number) => number
const hours: (n: number) => number
const days: (n: number) => number
const weeks: (n: number) => number
const months: (n: number) => number
const years: (n: number) => number

// Parse human-readable strings to milliseconds
const parseTimeDuration: (str: string) => number

// Format milliseconds to human-readable strings
const formatTimeDuration: (ms: number, opts?: {
    decimals?: number
    unit?: 'sec' | 'min' | 'hour' | 'day' | 'week' | 'month' | 'year'
}) => string
```

**Example:**

```ts
import {
    seconds, minutes, hours,
    parseTimeDuration,
    formatTimeDuration
} from '@logosdx/utils'

// Programmatic duration calculation
setTimeout(cleanup, minutes(5))     // 5 minutes = 300000ms
setInterval(poll, seconds(30))      // 30 seconds = 30000ms
cache.set(key, value, { ttl: hours(1) })  // 1 hour

// Parse configuration from environment variables
const config = {
    sessionTimeout: parseTimeDuration(process.env.SESSION_TIMEOUT || '1hour'),
    cacheExpiry: parseTimeDuration(process.env.CACHE_TTL || '15min'),
    heartbeat: parseTimeDuration(process.env.HEARTBEAT || '30sec')
}

// Supports multiple formats
parseTimeDuration('30sec')       // 30000
parseTimeDuration('30 secs')     // 30000
parseTimeDuration('30 seconds')  // 30000
parseTimeDuration('5m')          // 300000
parseTimeDuration('5min')        // 300000
parseTimeDuration('2.5 hours')   // 9000000 (decimals supported)

// Format for display (auto-selects unit)
formatTimeDuration(1000)          // "1sec"
formatTimeDuration(90000)         // "1.5min" (smart decimals)
formatTimeDuration(3600000)       // "1hour"

// Control formatting
formatTimeDuration(90000, { unit: 'sec' })      // "90sec"
formatTimeDuration(90000, { decimals: 0 })      // "2min"

// Logging with readable durations
logger.info(`Cache expires in: ${formatTimeDuration(cache.ttl)}`)
logger.debug(`Request took: ${formatTimeDuration(elapsed)}`)
```

#### Byte Sizes

```ts
// Constants
const byteUnits: {
    kb: number, mb: number, gb: number, tb: number
    kbs(n: number): number, mbs(n: number): number
    gbs(n: number): number, tbs(n: number): number
}

// Convenience functions
const kilobytes: (n: number) => number
const megabytes: (n: number) => number
const gigabytes: (n: number) => number
const terabytes: (n: number) => number

// Parse human-readable strings to bytes
const parseByteSize: (str: string) => number

// Format bytes to human-readable strings
const formatByteSize: (bytes: number, opts?: {
    decimals?: number  // Default: 2
    unit?: 'kb' | 'mb' | 'gb' | 'tb'
}) => string
```

**Example:**

```ts
import {
    megabytes, kilobytes,
    parseByteSize,
    formatByteSize
} from '@logosdx/utils'

// Programmatic size calculation
const maxFileSize = megabytes(10)  // 10485760 bytes
const bufferSize = kilobytes(64)   // 65536 bytes

// Parse configuration
const config = {
    uploadLimit: parseByteSize(process.env.MAX_UPLOAD || '10mb'),
    diskQuota: parseByteSize(process.env.DISK_QUOTA || '100gb'),
    thumbnailMax: parseByteSize(process.env.THUMB_SIZE || '500kb')
}

// Supports multiple formats
parseByteSize('10kb')           // 10240
parseByteSize('10 kbs')         // 10240
parseByteSize('10 kilobytes')   // 10240
parseByteSize('2.5gb')          // 2684354560 (decimals supported)

// Format for display (auto-selects unit)
formatByteSize(1024)            // "1kb"
formatByteSize(1536)            // "1.5kb"
formatByteSize(10485760)        // "10mb"

// Control formatting
formatByteSize(1024, { unit: 'mb' })        // "0mb"
formatByteSize(1536, { decimals: 0 })       // "2kb"

// Display file sizes
files.forEach(file => {
    console.log(`${file.name}: ${formatByteSize(file.size)}`)
})
```

## Performance & Caching

### `memoize()` and `memoizeSync()`

Cache function results with TTL, LRU eviction, built-in inflight deduplication, and stale-while-revalidate pattern.

```ts
function memoize<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options?: MemoizeOptions<T>
): EnhancedMemoizedFunction<T>

function memoizeSync<T extends (...args: any[]) => any>(
    fn: T,
    options?: Omit<MemoizeOptions<T>, 'adapter' | 'staleIn' | 'staleTimeout'>
): EnhancedMemoizedFunction<T>

interface MemoizeOptions<T> {
    ttl?: number                       // Time to live in ms (default: 60000)
    maxSize?: number                   // Max cache entries (default: 1000)
    cleanupInterval?: number          // Background cleanup interval (default: 60000, 0 to disable)
    generateKey?: (...args: Parameters<T>) => string  // Custom key generator
    shouldCache?: (...args: Parameters<T>) => boolean  // Pre-check: return false to bypass cache (still deduped)
    useWeakRef?: boolean              // Use WeakRef for values (default: false)
    staleIn?: number                   // Time in ms after which data is stale (enables SWR)
    staleTimeout?: number              // Max wait for fresh data when stale (default: undefined)
    onError?: (error: Error, args: Parameters<T>) => void  // Error handler
    adapter?: CacheAdapter<string, CacheItem<ReturnType<T>>>  // Custom cache backend
}

type EnhancedMemoizedFunction<T> = T & {
    cache: {
        clear(): void
        delete(key: string): boolean
        has(key: string): boolean
        size: number
        stats(): CacheStats
        keys(): IterableIterator<string>
        entries(): Array<[string, ReturnType<T> | undefined]>
    }
}

interface CacheStats {
    hits: number           // Successful cache lookups
    misses: number         // Cache misses (function executed)
    evictions: number      // Items evicted due to maxSize
    hitRate: number        // hits / (hits + misses)
    size: number           // Current cache size
}
```

**Key features:**

- **Built-in inflight deduplication**: Concurrent calls with same arguments share the same promise (prevents duplicate API calls)
- **Stale-while-revalidate**: Return stale data instantly while fetching fresh data in background
- **Pluggable cache adapters**: Support for Redis, Memcached, or custom backends
- **Enhanced cache stats**: Track hits, misses, evictions, and hit rate
- **LRU eviction with sequence tracking**: Deterministic eviction even with identical timestamps
- **Background cleanup**: Automatic expired entry removal

**Key differences between `memoize` and `memoizeSync`:**

| Feature | `memoize` (async) | `memoizeSync` (sync) |
|---------|-------------------|----------------------|
| **Inflight deduplication** | ✅ Built-in | ❌ Not needed (instant execution) |
| **Stale-while-revalidate** | ✅ Supported | ❌ Not applicable |
| **Custom cache adapters** | ✅ Redis, Memcached, etc. | ❌ Direct Map only |
| **Performance overhead** | Minimal async overhead | Zero overhead |
| **Use cases** | API calls, DB queries | Pure computations |

**Example:**

```ts
import { memoize, memoizeSync, attempt } from '@logosdx/utils'

// Basic async memoization with inflight deduplication
const fetchUser = async (id: string) => {

    const response = await fetch(`/api/users/${id}`)
    return response.json()
}

const getUser = memoize(fetchUser, {
    ttl: 60000,              // Cache for 1 minute
    maxSize: 500             // Keep 500 users max
})

// Three concurrent calls → one API request (inflight deduplication)
// Subsequent calls within TTL → instant cache hit
const [user1, user2, user3] = await Promise.all([
    getUser("42"),
    getUser("42"),
    getUser("42")
])

// Stale-while-revalidate for instant responses with fresh data
const getPrices = memoize(
    async (symbol: string) => {

        const response = await fetch(`/api/prices/${symbol}`)
        return response.json()
    },
    {
        ttl: 60000,              // Expire after 1 minute
        staleIn: 30000,          // Consider stale after 30 seconds
        staleTimeout: 1000       // Wait max 1 second for fresh data
    }
)

// Behavior:
// - Fresh data (age < staleIn): Returns cached immediately
// - Stale data (age > staleIn): Races fresh fetch vs staleTimeout
//   - Fresh arrives within timeout: Returns fresh
//   - Timeout reached: Returns stale, updates cache in background
// - No cached data: Fetches fresh (blocks)

// Custom key function for hot paths
const fetchProfile = async (req: { userId: string; timestamp: number }) => {

    const response = await fetch(`/api/profiles/${req.userId}`)
    return response.json()
}

const getProfile = memoize(fetchProfile, {
    generateKey: (req) => req.userId  // Ignore timestamp, cache by userId only
})

// Synchronous memoization - no inflight dedup, no SWR
const fibonacci = (n: number): number => {

    if (n <= 1) return n
    return fibonacci(n - 1) + fibonacci(n - 2)
}

const memoFib = memoizeSync(fibonacci, {
    ttl: 300000,             // Cache for 5 minutes
    maxSize: 100
})

memoFib(40)  // Computed and cached
memoFib(40)  // Instant return from cache

// Cache management
getUser.cache.stats()     // { hits: 10, misses: 3, hitRate: 0.77, evictions: 0, size: 3 }
getUser.cache.clear()     // Clear all entries
getUser.cache.delete(key) // Remove specific entry
getUser.cache.has(key)    // Check if cached
getUser.cache.size        // Current cache size
getUser.cache.keys()      // Iterate cache keys
getUser.cache.entries()   // Get all [key, value] pairs

// Distributed caching with custom adapter (Redis example)
import { MapCacheAdapter } from '@logosdx/utils'

class RedisCacheAdapter implements CacheAdapter<string, CacheItem<any>> {

    async get(key: string): Promise<CacheItem<any> | undefined> {

        const data = await redis.get(key)
        return data ? JSON.parse(data) : undefined
    }

    async set(key: string, value: CacheItem<any>, expiresAt: number): Promise<void> {

        const ttl = Math.max(0, expiresAt - Date.now())
        await redis.set(key, JSON.stringify(value), 'PX', ttl)
    }

    // ... implement other methods
}

const distributedCache = memoize(expensiveQuery, {
    adapter: new RedisCacheAdapter()
})

// Memory-sensitive caching with WeakRef
const cacheLargeObjects = memoize(fetchLargeData, {
    useWeakRef: true,  // Objects can be GC'd if memory is needed
    ttl: 300000
})

// Conditional caching - bypass cache for specific requests
const fetchData = async (url: string, opts?: { bustCache?: boolean }) => {

    const response = await fetch(url)
    return response.json()
}

const smartFetch = memoize(fetchData, {
    shouldCache: (url, opts) => !opts?.bustCache,  // Bypass if bustCache is true
    ttl: 60000
})

await smartFetch('/api/data')  // Uses cache
await smartFetch('/api/data', { bustCache: true })  // Bypasses cache (still deduped though!)
```

**When to use:**

- **`memoize`**: Expensive async operations (API calls, DB queries, file I/O)
- **`memoizeSync`**: Expensive pure computations (parsing, transformations)
- **Custom `generateKey`**: Hot paths with complex arguments or functions as parameters
- **`shouldCache`**: Conditional caching based on request context (e.g., cache-busting, user preferences)
- **`staleIn` + `staleTimeout`**: Fast responses more important than 100% fresh data
- **`useWeakRef`**: Large cached objects in long-running processes
- **Custom `adapter`**: Distributed caching across multiple servers

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

### `withInflightDedup()`

Deduplicate concurrent async calls with identical arguments, ensuring only one execution per unique key.

```ts
function withInflightDedup<Args extends any[], Value, Key = string>(
    producer: AsyncFunc<Args, Value>,
    opts?: InflightOptions<Args, Key, Value>
): AsyncFunc<Args, Value>

interface InflightOptions<Args extends any[] = any[], Key = string, Value = unknown> {
    generateKey?: (...args: Args) => Key
    shouldDedupe?: (...args: Args) => boolean
    onStart?: (key: Key) => void
    onJoin?: (key: Key) => void
    onResolve?: (key: Key, value: Value) => void
    onReject?: (key: Key, error: unknown) => void
}
```

**What it does:**

- Deduplicates concurrent async calls with identical arguments
- First call starts the producer; concurrent calls share the same promise
- No caching after promise settles - each new request starts fresh
- Automatic cleanup on resolve/reject

**What it doesn't do:**

- No memoization/TTL/stale-while-revalidate (use `memoize` for that)
- No AbortController handling (callers manage their own cancellation)
- No request queuing (all concurrent calls share the same promise)

**Parameters:**

- `producer` - Async function to wrap with deduplication
- `opts.generateKey` - Optional custom key function (defaults to built-in serializer)
- `opts.shouldDedupe` - Optional pre-check to conditionally bypass deduplication (return false to bypass)
- `opts.onStart` - Called when first caller starts producer for this key
- `opts.onJoin` - Called when subsequent caller joins existing in-flight promise
- `opts.onResolve` - Called when shared promise resolves successfully
- `opts.onReject` - Called when shared promise rejects

**Returns:** Wrapped function with in-flight deduplication

**Example:**

```ts
import { withInflightDedup, attempt } from '@logosdx/utils'

// Basic usage - database query deduplication
const fetchUser = async (id: string) => db.users.findById(id)
const getUser = withInflightDedup(fetchUser)

// Three concurrent calls → one database query
const [user1, user2, user3] = await Promise.all([
    getUser("42"),
    getUser("42"),
    getUser("42")
])

// With hooks for observability
const search = async (q: string) => api.search(q)
const dedupedSearch = withInflightDedup(search, {
    onStart: (k) => logger.debug("search started", k),
    onJoin: (k) => logger.debug("joined existing search", k),
    onResolve: (k) => logger.debug("search completed", k),
    onReject: (k, e) => logger.error("search failed", k, e),
})

// Custom key - ignore volatile parameters
const fetchData = async (id: string, opts: { timestamp?: number }) => {

    const response = await fetch(`/api/data/${id}`)
    return response.json()
}

const dedupedFetch = withInflightDedup(fetchData, {
    generateKey: (id) => id  // Only dedupe by id, ignore opts
})

// Conditional deduplication - bypass for cache-busting requests
const smartFetch = withInflightDedup(fetchData, {
    shouldDedupe: (id, opts) => !opts?.bustCache
})

// Normal calls are deduped
await Promise.all([
    smartFetch("42"),
    smartFetch("42")
])  // → one request

// Cache-busting calls bypass deduplication
await smartFetch("42", { bustCache: true })  // → executes independently

// Hot path optimization - extract discriminating field only
const getProfile = async (req: { userId: string; meta: LargeObject }) => {

    const response = await fetch(`/api/profiles/${req.userId}`)
    return response.json()
}

const dedupedGetProfile = withInflightDedup(getProfile, {
    generateKey: (req) => req.userId  // Avoid serializing large meta object
})

// Functions as arguments - MUST use custom generateKey
const fetchWithTransform = async (url: string, transform: (data: any) => any) => {

    const response = await fetch(url)
    const data = await response.json()
    return transform(data)
}

const dedupedFetch = withInflightDedup(fetchWithTransform, {
    generateKey: (url) => url  // Only dedupe by URL, ignore transform function
})
```

**When to use:**

- Deduplicating database queries triggered multiple times
- Preventing duplicate API calls during component re-renders
- Sharing expensive computations across concurrent callers
- Hot paths where multiple parts of code request the same resource

**Performance notes:**

- Default key generation: O(n) in argument structure size
- For hot paths or complex args, use custom `generateKey` to extract only discriminating fields
- For functions as arguments, MUST use custom `generateKey` (functions always collide in default serializer)

**Key differences from memoize:**

- **No caching after settlement**: Each new request starts fresh producer execution
- **Concurrent-only deduplication**: Only shares promise while in-flight
- **No TTL/stale-while-revalidate**: Use `memoize` if you need result caching

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
