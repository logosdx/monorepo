---
title: Performance & Caching
description: Memoization, debouncing, throttling, and inflight deduplication utilities.
---

# Performance & Caching

## `memoize()` and `memoizeSync()`

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
| **Inflight deduplication** | Built-in | Not needed (instant execution) |
| **Stale-while-revalidate** | Supported | Not applicable |
| **Custom cache adapters** | Redis, Memcached, etc. | Direct Map only |
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

// Three concurrent calls -> one API request (inflight deduplication)
// Subsequent calls within TTL -> instant cache hit
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

## `debounce()`

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

## `withInflightDedup()`

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

**Example:**

```ts
import { withInflightDedup, attempt } from '@logosdx/utils'

// Basic usage - database query deduplication
const fetchUser = async (id: string) => db.users.findById(id)
const getUser = withInflightDedup(fetchUser)

// Three concurrent calls -> one database query
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
])  // -> one request

// Cache-busting calls bypass deduplication
await smartFetch("42", { bustCache: true })  // -> executes independently
```

**When to use:**

- Deduplicating database queries triggered multiple times
- Preventing duplicate API calls during component re-renders
- Sharing expensive computations across concurrent callers
- Hot paths where multiple parts of code request the same resource

**Key differences from memoize:**

- **No caching after settlement**: Each new request starts fresh producer execution
- **Concurrent-only deduplication**: Only shares promise while in-flight
- **No TTL/stale-while-revalidate**: Use `memoize` if you need result caching

---

## `throttle()`

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

---

## `serializer()`

Enhanced key generation that handles object property ordering, circular references, and non-serializable values. More reliable than `JSON.stringify` for cache keys.

```ts
function serializer(args: unknown[]): string
```

**Handles:**
- Objects/arrays with sorted keys for consistent ordering
- Circular references (unique IDs per object)
- Functions, Symbols, Errors, WeakMap, WeakSet (unique instance IDs)
- Dates (`d:timestamp`), RegExp (`r:/pattern/flags`)
- Maps, Sets (sorted entries)
- Special values: `-0`, `BigInt`, `null`, `undefined`

**Example:**

```ts
import { serializer } from '@logosdx/utils'

serializer([{ a: 1, b: 2 }, 'test', 123])
// '{"a":1,"b":2}|test|123'

serializer([new Date(1000), /test/i])
// 'd:1000|r:/test/i'

// Functions get unique, stable IDs
const fn1 = () => {}
const fn2 = () => {}
serializer([fn1]) !== serializer([fn2]) // true (different functions)
serializer([fn1]) === serializer([fn1]) // true (same function)

// Consistent key ordering
serializer([{ b: 2, a: 1 }]) === serializer([{ a: 1, b: 2 }]) // true

// Use as custom generateKey in memoize
const cachedFetch = memoize(fetchData, {
    generateKey: (...args) => serializer(args)
})
```

---

## `SingleFlight`

A generic coordinator for cache and in-flight request deduplication. Provides primitives for caching values with TTL/stale-while-revalidate (SWR) and tracking in-flight promises to prevent duplicate concurrent executions.

SingleFlight is a **state manager**, not an executor. Callers control the flow and use SingleFlight as a coordination layer.

```ts
class SingleFlight<T = unknown> {
    constructor(opts?: SingleFlightOptions<T>)

    // Cache primitives
    getCache(key: string): Promise<CacheEntry<T> | null>
    setCache(key: string, value: T, opts?: SetCacheOptions): Promise<void>
    deleteCache(key: string): Promise<boolean>
    hasCache(key: string): Promise<boolean>
    invalidateCache(predicate: (key: string) => boolean): Promise<number>
    clearCache(): Promise<void>

    // In-flight primitives
    getInflight(key: string): InflightEntry<T> | null
    trackInflight(key: string, promise: Promise<T>): () => void  // Returns cleanup
    joinInflight(key: string): number  // Returns waiting count
    hasInflight(key: string): boolean

    // Lifecycle
    clear(): Promise<void>
    stats(): SingleFlightStats
}

interface SingleFlightOptions<T> {
    adapter?: CacheAdapter<T>      // External cache (Redis, IndexedDB). Default: MapCacheAdapter
    defaultTtl?: number            // Cache TTL in ms (default: 60000)
    defaultStaleIn?: number        // SWR stale threshold in ms (default: undefined)
    maxSize?: number               // Max cache entries (default: 1000)
    cleanupInterval?: number       // Background cleanup in ms (default: 60000)
}

interface CacheEntry<T> {
    value: T
    isStale: boolean
    expiresAt: number
    staleAt?: number
}

interface InflightEntry<T> {
    promise: Promise<T>
    waitingCount: number
}
```

**Example:**

```ts
import { SingleFlight } from '@logosdx/utils'

// Basic deduplication
const flight = new SingleFlight()

async function fetchUser(id: string) {

    const key = `user:${id}`

    // Check in-flight first
    const inflight = flight.getInflight(key)

    if (inflight) {

        flight.joinInflight(key)
        return inflight.promise
    }

    // Start new request
    const promise = api.fetchUser(id)
    const cleanup = flight.trackInflight(key, promise)

    try {
        return await promise
    }
    finally {
        cleanup()
    }
}

// With caching and stale-while-revalidate
const flight = new SingleFlight<UserData>({
    defaultTtl: 60000,     // 1 minute cache
    defaultStaleIn: 30000  // Stale after 30 seconds
})

async function fetchUser(id: string) {

    const key = `user:${id}`

    // Check cache first
    const cached = await flight.getCache(key)

    if (cached && !cached.isStale) {
        return cached.value
    }

    // Check in-flight
    const inflight = flight.getInflight(key)

    if (inflight) {

        flight.joinInflight(key)
        return inflight.promise
    }

    // Return stale immediately, revalidate in background
    if (cached?.isStale) {

        const promise = api.fetchUser(id)
        const cleanup = flight.trackInflight(key, promise)

        promise
            .then(value => flight.setCache(key, value))
            .finally(cleanup)

        return cached.value
    }

    // Fresh fetch
    const promise = api.fetchUser(id)
    const cleanup = flight.trackInflight(key, promise)

    try {
        const value = await promise
        await flight.setCache(key, value)
        return value
    }
    finally {
        cleanup()
    }
}

// Invalidate by pattern
await flight.invalidateCache(key => key.startsWith('user:'))
```
