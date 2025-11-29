---
description: Usage patterns for the @logosdx/utils package.
globs: *.ts
---

# @logosdx/utils - Usage Context

A comprehensive utility library providing Go-style error handling, advanced flow control, type-safe data operations, and powerful TypeScript type utilities.

## Core Philosophy

**Never use try-catch.** Always use error tuple pattern for fail-prone operations.

```ts
import { attempt, attemptSync } from '@logosdx/utils'

// ✅ Fail-prone operations (I/O, network, async)
const [result, err] = await attempt(() => fetch('/api/users'))
if (err) return handleError(err)

// ✅ Business logic returns directly
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}
```

## Error Handling

### `attempt` & `attemptSync`
Go-style error tuple for safe async/sync operations.

```ts
type ResultTuple<T> = [T, null] | [null, Error]

const attempt: <T extends () => Promise<any>>(fn: T) => Promise<ResultTuple<Awaited<ReturnType<T>>>>
const attemptSync: <T extends () => any>(fn: T) => ResultTuple<ReturnType<T>>

// Usage
const [user, err] = await attempt(() => fetchUser(id))
if (err) throw err

const [parsed, parseErr] = attemptSync(() => JSON.parse(data))
if (parseErr) return defaultValue
```

## Flow Control

### Timing & Rate Control

```ts
// Enhanced Debounce - delay execution until calls stop with flush, cancel, and maxWait
interface DebouncedFunction<T extends Func> {
  (...args: Parameters<T>): void;
  flush(): ReturnType<T> | undefined;  // Execute immediately and return result
  cancel(): void;                      // Stop pending execution
}

const debounce: <T extends Func>(fn: T, options: DebounceOptions) => DebouncedFunction<T>

interface DebounceOptions {
  delay: number;
  maxWait?: number;  // Maximum time to wait before execution
}

const debouncedSearch = debounce(searchUsers, {
  delay: 300,
  maxWait: 1000  // Execute after 1s max even if still getting calls
})

// Call flush() to execute immediately
const result = debouncedSearch.flush()
// Call cancel() to prevent execution
debouncedSearch.cancel()

// Enhanced Throttle - limit execution frequency with cancel capability
interface ThrottledFunction<T extends Func> {
  (...args: Parameters<T>): ReturnType<T>;
  cancel(): void;  // Clear throttle state and allow immediate execution
}

const throttle: <T extends Func>(fn: T, options: ThrottleOptions) => ThrottledFunction<T>

class ThrottleError extends Error {}
const isThrottleError: (error: unknown) => error is ThrottleError

const throttledScroll = throttle(updatePosition, {
  delay: 16,
  throws: false,
  onThrottle: (args) => console.log('throttled', args)
})

// Call cancel() to reset throttle state
throttledScroll.cancel()

// Rate limiting - control call frequency per time window
const rateLimit: <T extends Func>(fn: T, options: RateLimitOptions<T>) => T

class RateLimitTokenBucket {
  constructor(capacity: number, refillIntervalMs: number)
  consume(count?: number): boolean
  waitForToken(count?: number, opts?: { onRateLimit?: Function; abortController?: AbortController }): Promise<void>
  waitAndConsume(count?: number, opts?: { onRateLimit?: Function; abortController?: AbortController }): Promise<boolean>
  get tokens(): number
  get snapshot(): { currentTokens: number; capacity: number; rejectionRate: number; /* ... */ }
  reset(): void
}

class RateLimitError extends Error {
  constructor(message: string, maxCalls: number)
}
const isRateLimitError: (error: unknown) => error is RateLimitError

const limitedApi = rateLimit(apiCall, { maxCalls: 10, windowMs: 60000 })
const bucket = new RateLimitTokenBucket(10, 1000)
```

### Resilience Patterns

```ts
// Retry with backoff
const retry: <T extends Func>(fn: T, options: RetryOptions) => Promise<ReturnType<T>>
const makeRetryable: <T extends Func>(fn: T, options: RetryOptions) => T

class RetryError extends Error {}
const isRetryError: (error: unknown) => error is RetryError

const resilientFetch = makeRetryable(fetch, { retries: 3, delay: 1000, backoff: 2 })

// Circuit breaker for failing services
const circuitBreaker: <T extends Func>(fn: T, options: CircuitBreakerOptions<T>) => T

class CircuitBreakerError extends Error {}
const isCircuitBreakerError: (error: unknown) => error is CircuitBreakerError

const protectedApi = circuitBreaker(apiCall, { maxFailures: 3, resetAfter: 30000 })

// Timeout protection
const withTimeout: <T extends Func>(fn: T, options: WithTimeoutOptions) => T
const runWithTimeout: <T extends Func>(fn: T, options: WithTimeoutOptions) => Promise<ReturnType<T> | null>

class TimeoutError extends Error {}
const isTimeoutError: (error: unknown) => error is TimeoutError

const timedFetch = withTimeout(fetch, { timeout: 5000 })

// Batch operations with comprehensive tracking
type BatchResult<T, R> = {
  result: R | null
  error: Error | null
  item: T
  index: number
  itemIndex: number
}

const batch: <T, R>(
  fn: BatchFunction<[T], R>,
  options: BatchOptions<T, R>
) => Promise<BatchResult<T, R>[]>

await batch(processItem, {
  items: [1, 2, 3, 4, 5],
  concurrency: 3,
  failureMode: 'continue',
  onChunkStart: ({ index, total }) => console.log(`Starting chunk ${index + 1}/${total}`)
})

// In-flight promise deduplication - share promises for concurrent calls
const withInflightDedup: <Args extends any[], Value, Key = string>(
  producer: AsyncFunc<Args, Value>,
  opts?: InflightOptions<Args, Key, Value>
) => AsyncFunc<Args, Value>

interface InflightOptions<Args, Key, Value> {
  generateKey?: (...args: Args) => Key          // Spread args: (arg1, arg2, ...)
  shouldDedupe?: (...args: Args) => boolean     // Spread args: (arg1, arg2, ...)
  onStart?: (key: Key) => void                  // First caller starts
  onJoin?: (key: Key) => void                   // Subsequent caller joins
  onResolve?: (key: Key, value: Value) => void  // Promise resolved
  onReject?: (key: Key, error: unknown) => void // Promise rejected
}

// Basic usage - deduplicate concurrent calls
const fetchUser = withInflightDedup(async (id: string) => {
  return db.users.findById(id)
})

// Three concurrent calls → one database query
const [u1, u2, u3] = await Promise.all([
  fetchUser("42"),
  fetchUser("42"),
  fetchUser("42")
])

// With observability hooks
const search = withInflightDedup(searchAPI, {
  onStart: (key) => logger.debug("started", key),
  onJoin: (key) => logger.debug("joined", key),
  onResolve: (key) => logger.debug("completed", key)
})

// Custom key function for hot paths
const getProfile = withInflightDedup(fetchProfile, {
  generateKey: (req) => req.userId  // Extract only discriminating field
})

// Conditional deduplication - bypass for cache-busting
const smartFetch = withInflightDedup(fetchData, {
  shouldDedupe: (url, opts) => !opts?.bustCache
})
// Normal calls are deduped:
await Promise.all([smartFetch('/api/data'), smartFetch('/api/data')])  // → 1 network call
// Cache-busting calls bypass deduplication:
await smartFetch('/api/data', { bustCache: true })  // → executes independently

// Key differences from memoize:
// - No caching after settlement (each new request starts fresh)
// - Only shares promise while in-flight
// - No TTL/stale-while-revalidate features

// SingleFlight - Generic coordinator for cache and in-flight deduplication
// Provides primitives for building custom caching/deduplication strategies
class SingleFlight<T = unknown> {
  constructor(opts?: SingleFlightOptions<T>)

  // Cache primitives (sync for Map adapter, async for Redis/etc.)
  getCache(key: string): CacheEntry<T> | null
  getCacheAsync(key: string): Promise<CacheEntry<T> | null>
  setCache(key: string, value: T, opts?: SetCacheOptions): void
  setCacheAsync(key: string, value: T, opts?: SetCacheOptions): Promise<void>
  deleteCache(key: string): boolean
  deleteCacheAsync(key: string): Promise<boolean>
  hasCache(key: string): boolean
  hasCacheAsync(key: string): Promise<boolean>

  // In-flight primitives
  getInflight(key: string): InflightEntry<T> | null
  trackInflight(key: string, promise: Promise<T>): () => void  // Returns cleanup fn
  joinInflight(key: string): number  // Returns new waitingCount
  hasInflight(key: string): boolean

  // Lifecycle
  clear(): void              // Clear cache + inflight
  clearCache(): void         // Clear cache only
  clearCacheAsync(): Promise<void>
  stats(): SingleFlightStats
}

interface SingleFlightOptions<T> {
  adapter?: SingleFlightCacheAdapter<T>  // Default: in-memory Map
  defaultTtl?: number                    // Default: 60000 (1 minute)
  defaultStaleIn?: number                // Default: undefined (no SWR)
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

interface SetCacheOptions {
  ttl?: number      // Override defaultTtl
  staleIn?: number  // Override defaultStaleIn
}

// Basic deduplication usage
const flight = new SingleFlight<User>()

async function fetchUser(id: string): Promise<User> {
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
  } finally {
    cleanup()
  }
}

// With caching and stale-while-revalidate
const flight = new SingleFlight<User>({
  defaultTtl: 60000,     // Cache for 1 minute
  defaultStaleIn: 30000  // Stale after 30 seconds
})

async function fetchUser(id: string): Promise<User> {
  const key = `user:${id}`

  // 1. Check cache
  const cached = flight.getCache(key)
  if (cached && !cached.isStale) {
    return cached.value  // Fresh hit
  }

  // 2. Check in-flight
  const inflight = flight.getInflight(key)
  if (inflight) {
    flight.joinInflight(key)
    return inflight.promise
  }

  // 3. SWR: return stale, revalidate in background
  if (cached?.isStale) {
    const promise = api.fetchUser(id)
    const cleanup = flight.trackInflight(key, promise)
    promise
      .then(value => flight.setCache(key, value))
      .finally(cleanup)
    return cached.value  // Return stale immediately
  }

  // 4. Fresh fetch
  const promise = api.fetchUser(id)
  const cleanup = flight.trackInflight(key, promise)
  try {
    const value = await promise
    flight.setCache(key, value)
    return value
  } finally {
    cleanup()
  }
}

// Custom cache adapter for distributed caching
class RedisCacheAdapter implements SingleFlightCacheAdapter<User> {
  async get(key: string) { /* Redis GET */ }
  async set(key: string, item: SingleFlightCacheItem<User>) { /* Redis SET */ }
  async delete(key: string) { /* Redis DEL */ }
  async clear() { /* Redis FLUSHDB */ }
  get size() { return /* Redis DBSIZE */ }
}

const distributedFlight = new SingleFlight<User>({
  adapter: new RedisCacheAdapter()
})

// Key differences from memoize/withInflightDedup:
// - Primitives only: You control the execution flow
// - Generic: No function wrapping, just state management
// - Composable: Build custom patterns (cache-first, dedupe-first, etc.)
// - Pluggable: Works with any cache backend via adapters
```

### Memoization & Caching

```ts
// Async memoization with LRU eviction, inflight deduplication, and stale-while-revalidate
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
  hits: number          // Successful cache lookups
  misses: number        // Cache misses (function executed)
  evictions: number     // Items evicted due to maxSize
  hitRate: number       // hits / (hits + misses)
  size: number          // Current cache size
}

interface MemoizeOptions<T> {
  ttl?: number                    // Time to live in milliseconds (default: 60000)
  maxSize?: number                // Maximum cache size with LRU eviction (default: 1000)
  cleanupInterval?: number        // Background cleanup interval (default: 60000)
  useWeakRef?: boolean            // Use WeakRef for objects (memory-sensitive) (default: false)
  generateKey?: (...args: Parameters<T>) => string       // Spread args: (arg1, arg2, ...)
  onError?: (error: Error, args: Parameters<T>) => void  // Tuple args: ([arg1, arg2, ...])
  shouldCache?: (...args: Parameters<T>) => boolean     // Spread args: (arg1, arg2, ...)
  staleIn?: number                // Time after which data is stale (enables SWR)
  staleTimeout?: number           // Max wait for fresh data when stale (default: undefined)
  adapter?: CacheAdapter          // Custom cache adapter (Redis, Memcached, etc.)
}

const memoize: <T extends AsyncFunc>(fn: T, options?: MemoizeOptions<T>) => EnhancedMemoizedFunction<T>
const memoizeSync: <T extends Func>(fn: T, options?: Omit<MemoizeOptions<T>, 'adapter' | 'staleIn' | 'staleTimeout'>) => EnhancedMemoizedFunction<T>

// Basic async memoization - caches results with TTL and LRU eviction
const fetchUser = async (id: string) => database.users.findById(id)
const getUser = memoize(fetchUser, {
  ttl: 60000,              // Cache for 1 minute
  maxSize: 500             // Keep 500 users max (LRU eviction)
})

// Three concurrent calls → one database query (inflight deduplication)
// Subsequent calls within TTL → instant cache hit
const [user1, user2, user3] = await Promise.all([
  getUser("42"),
  getUser("42"),
  getUser("42")
])

// Stale-while-revalidate pattern - fast responses with fresh data
const getPrices = memoize(fetchPrices, {
  ttl: 60000,              // Expire after 1 minute
  staleIn: 30000,          // Consider stale after 30 seconds
  staleTimeout: 1000       // Wait max 1 second for fresh data
})

// Behavior:
// - Fresh data (age < staleIn): Returns cached immediately
// - Stale data (age > staleIn): Races fresh fetch vs staleTimeout
//   - Fresh data arrives within timeout: Returns fresh
//   - Timeout reached: Returns stale, updates cache in background
// - No cached data: Fetches fresh (blocks)

// Custom key function for hot paths - extract only discriminating fields
const fetchUserProfile = async (req: { userId: string; timestamp: number }) => { }
const getProfile = memoize(fetchUserProfile, {
  generateKey: (req) => req.userId  // Ignore timestamp, cache by userId only
})

// Conditional caching - bypass cache for specific requests
const fetchData = async (url: string, opts?: { bustCache?: boolean }) => { /* ... */ }
const smartFetch = memoize(fetchData, {
  shouldCache: (url, opts) => !opts?.bustCache,  // Spread args (matches shouldDedupe pattern)
  ttl: 60000
})
await smartFetch('/api/data')  // Uses cache
await smartFetch('/api/data', { bustCache: true })  // Bypasses cache (still deduped though!)

// Sync memoization - no inflight deduplication, no stale-while-revalidate
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

// Cache management API
getUser.cache.stats()     // { hits: 10, misses: 3, hitRate: 0.77, evictions: 0, size: 3 }
getUser.cache.clear()     // Clear all entries
getUser.cache.delete(key) // Remove specific entry
getUser.cache.has(key)    // Check if cached
getUser.cache.size        // Current cache size
getUser.cache.keys()      // Iterate cache keys
getUser.cache.entries()   // Get all [key, value] pairs

// Pluggable cache adapters for distributed caching
class RedisCacheAdapter implements CacheAdapter<string, CacheItem<any>> {
  async get(key: string): Promise<CacheItem<any> | undefined> { }
  async set(key: string, value: CacheItem<any>, expiresAt: number): Promise<void> { }
  async delete(key: string): Promise<boolean> { }
  // ... other methods
}

const distributedCache = memoize(expensiveQuery, {
  adapter: new RedisCacheAdapter(redisClient)
})

// Memory-sensitive caching with WeakRef (objects only)
const cacheLargeObjects = memoize(fetchLargeData, {
  useWeakRef: true,  // Objects can be GC'd if memory is needed
  ttl: 300000
})

// Key differences: memoize vs memoizeSync
// memoize:
// - Built-in inflight deduplication (concurrent calls share promise)
// - Supports stale-while-revalidate pattern
// - Supports custom cache adapters (Redis, etc.)
// - Async overhead (Promise handling)
//
// memoizeSync:
// - No inflight deduplication (sync functions execute instantly)
// - No stale-while-revalidate (not applicable for sync)
// - No custom adapters (direct Map for performance)
// - Zero promise overhead

// When to use:
// - memoize: Expensive async operations (API calls, DB queries, file I/O)
// - memoizeSync: Expensive pure computations (parsing, transformations)
// - Both provide LRU eviction, TTL, and WeakRef support
```

## Data Operations

### Object Manipulation

```ts
// Deep cloning (handles all JS types, circular refs)
const clone: <T>(value: T) => T
const cloned = clone(complexState)

// Deep equality comparison
const equals: (a: unknown, b: unknown) => boolean
if (!equals(oldState, newState)) triggerUpdate()

// Deep merging with type safety
const merge: <T, U>(target: T, source: U) => T & U
const mergeDefaults: <T, U>(target: T, defaults: U) => T & U

const config = mergeDefaults(userConfig, defaultConfig)
```

### Safe Property Access

```ts
// Dot-notation path traversal (read)
const reach: <T, P extends PathNames<T>>(obj: T, path: P) => PathValue<T, P> | undefined

const userName = reach(response, 'data.user.profile.name')
const score = reach(gameState, 'players.0.stats.score')

// Dot-notation path setting (write)
const setDeep: <T, P extends PathNames<T>>(obj: T, path: P, value: PathValue<T, P>) => void
const setDeepMany: <T>(obj: T, entries: Array<[PathNames<T>, any]>) => void

setDeep(config, 'server.port', 3000)
setDeep(metrics, 'memory.rss', 1024)

setDeepMany(response, [
  ['status.code', 200],
  ['status.message', 'OK'],
  ['data.results', [1, 2, 3]]
])

// Safe object key operations
const getSafeKeys: <T extends object>(obj: T) => Array<keyof T>
const getSafeEntries: <T extends object>(obj: T) => Array<[keyof T, T[keyof T]]>
const isDangerousKey: (key: string) => boolean

// Advanced merge type for complex nested objects
type MergeTypes<Target, Source> = {
  [K in keyof Target | keyof Source]: K extends keyof Source
    ? K extends keyof Target
      ? /* complex merge logic for nested objects, arrays, Maps, Sets */
      : Source[K]
    : K extends keyof Target
      ? Target[K]
      : never
}

// Extend built-in operations with custom handlers
interface AddHandlerFor {
  <T extends AnyConstructor>(fn: 'clone', cnstr: T, handler: (original: InstanceType<T>, seen?: WeakMap<any, any>) => InstanceType<T>): void
  <T extends AnyConstructor>(fn: 'merge', cnstr: T, handler: (target: InstanceType<T>, source: InstanceType<T>, opts?: MergeOptions) => InstanceType<T>): void
  <T extends AnyConstructor>(fn: 'equals', cnstr: T, handler: (target: InstanceType<T>, source: InstanceType<T>) => boolean): void
}

const addHandlerFor: AddHandlerFor

// Usage: extend clone/merge/equals for custom classes
addHandlerFor('clone', MyClass, (original, seen) => new MyClass(original.value))
addHandlerFor('equals', MyClass, (a, b) => a.id === b.id)
addHandlerFor('merge', MyClass, (target, source, opts) => new MyClass(merge(target.data, source.data, opts)))
```

### Collections

```ts
// Priority queue (min-heap by default)
class PriorityQueue<T> {
  constructor(options?: PriorityQueueOptions<T>)
  push(value: T, priority?: number): void
  pop(): T | undefined
  peek(): T | undefined
  size(): number
  isEmpty(): boolean
}

const taskQueue = new PriorityQueue<Task>()
taskQueue.push(urgentTask, 1)
taskQueue.push(normalTask, 5)
```

## Validation & Type Guards

### Environment Detection

```ts
const isBrowser: () => boolean
const isNode: () => string | false
const isReactNative: () => boolean
const isCloudflare: () => boolean
const isBrowserLike: () => boolean

if (isBrowser()) {
  document.querySelector('#app')
} else {
  const fs = require('fs')
}
```

### Assertions & Guards

```ts
// Basic assertion
const assert: (test: unknown, message?: string, ErrorClass?: typeof Error) => void

// Object validation with path-based assertions
const assertObject: <T extends object>(obj: T, assertions: AssertionMap<T>) => void

assertObject(user, {
  'id': (val) => [typeof val === 'string', 'ID must be string'],
  'profile.email': (val) => [val.includes('@'), 'Invalid email'],
  'settings.notifications': (val) => [typeof val === 'boolean', 'Must be boolean']
})

// Optional value validation
const isOptional: <T>(val: T | undefined, check: Function | boolean) => boolean
const assertOptional: <T>(val: T | undefined, ...rest: Parameters<typeof assert>) => void

// Type guards
const isFunction: (a: unknown) => a is Function
const isObject: (a: unknown) => a is Object
const isPlainObject: (a: unknown) => a is object
const isPrimitive: (val: unknown) => boolean
const isUndefined: (val: unknown) => val is undefined
const isDefined: (val: unknown) => val is NonNullable<unknown>
const isNull: (val: unknown) => val is null

// Advanced type checks
const isNonIterable: (val: unknown) => boolean
const hasNoConstructor: (val: unknown) => boolean
const hasSameConstructor: (value: unknown, compare: unknown) => boolean
const isSameLength: <A extends Iterable<unknown>, B extends Iterable<unknown>>(a: A, b: B) => boolean
```

### Collection Validation

```ts
// Validate all object properties
const allKeysValid: <T extends object>(item: T, check: (value: T[keyof T], key: string | number) => boolean) => boolean

// Validate all iterable items
const allItemsValid: <I extends Iterable<unknown>>(item: I, check: (value: unknown) => boolean) => boolean

const configValid = allKeysValid(config, (value, key) => {
  return value !== null && value !== undefined
})
```

## TypeScript Type Utilities

### Function Types

```ts
type Func<A extends unknown[] = unknown[], R = unknown> = (...args: A) => R
type AsyncFunc<A extends unknown[] = unknown[], R = unknown> = (...args: A) => Promise<R>
type ClassType = { new (...args: any[]): any }
```

### Object Type Manipulation

```ts
// Extract function/non-function properties
type FunctionProps<T> = { [K in keyof T]: T[K] extends Func | ClassType ? K : never }[keyof T]
type NonFunctionProps<T> = { [K in keyof T]: T[K] extends Func | ClassType ? never : K }[keyof T]

// Deep optional and nullable variants
type DeepOptional<T> = { [K in keyof T]?: T[K] extends object ? DeepOptional<T[K]> : T[K] }
type NullableObject<T> = { [K in keyof T]: T[K] | null }
```

### Path Navigation Types

```ts
// Generate all possible paths in an object
type PathNames<T> = // Complex recursive type for dot-notation paths

// Get value type at specific path
type PathValue<T, P extends string> = // Type-safe path value extraction

// Usage in generic functions
function getValue<T, P extends PathNames<T>>(obj: T, path: P): PathValue<T, P> | undefined {
  return reach(obj, path)
}
```

### Utility Types

```ts
type OneOrMany<T> = T | T[]
type MaybePromise<T> = T | Promise<T>
type StrOrNum = string | number
type Falsy = false | 0 | "" | null | undefined | 0n
type Truthy<T> = T extends Falsy ? never : T
type NotUndefined<T> = T extends undefined ? never : T

interface StringProps { [key: string]: string }
interface BoolProps { [key: string]: boolean }
```

## Property Management

### Property Definition

```ts
// Public (enumerable) properties
const definePublicProps: <T, U extends Record<string, unknown>>(
  target: T,
  props: U,
  configurable?: boolean
) => void

// Private (non-enumerable) properties
const definePrivateProps: <T, U extends Record<string, unknown>>(
  target: T,
  props: U,
  configurable?: boolean
) => void

// Private getters
const definePrivateGetters: <T, U extends Record<string, Func>>(
  target: T,
  props: U,
  configurable?: boolean
) => void

// Usage in classes
class DataProcessor {
  constructor(config: Config) {
    definePrivateProps(this, {
      _cache: new Map(),
      _process: this.process.bind(this)
    })
  }
}
```

## Async Utilities

```ts
// Deferred promise with external control
class Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: Error | string) => void
}

// Clearable timeout promise
class TimeoutPromise<T = void> extends Promise<T> {
  clear: () => void
}

const wait: <T>(ms: number, value?: T) => TimeoutPromise<T>

const timeout = wait(1000)
timeout.clear() // Cancel the timeout

// Wait with value
const result = await wait(1000, 'completed')
```

## Array & Data Utilities

```ts
// Array chunking
const chunk: <T>(array: T[], size: number) => T[][]
const batches = chunk(largeArray, 100)

// Array normalization
const itemsToArray: <T>(items: T | T[]) => T[]
const oneOrMany: <T>(items: T[]) => T | T[]

// Utility functions
const noop: (...args: any[]) => any
const generateId: () => string
```

## Error Types & Utilities

Flow control utilities provide specific error types for different failure modes:

```ts
// Error classes and type guards
class RetryError extends Error {}
const isRetryError: (error: unknown) => error is RetryError

class TimeoutError extends Error {}
const isTimeoutError: (error: unknown) => error is TimeoutError

class CircuitBreakerError extends Error {}
const isCircuitBreakerError: (error: unknown) => error is CircuitBreakerError

class RateLimitError extends Error {
  constructor(message: string, maxCalls: number)
}
const isRateLimitError: (error: unknown) => error is RateLimitError

class ThrottleError extends Error {}
const isThrottleError: (error: unknown) => error is ThrottleError

class AssertError extends Error {}
const isAssertError: (error: unknown) => error is AssertError

// Usage with error handling
const [result, err] = await attempt(() => resilientApiCall())

if (err) {
  if (isTimeoutError(err)) {
    console.log('Request timed out')
  } else if (isCircuitBreakerError(err)) {
    console.log('Circuit breaker is open')
  } else if (isRateLimitError(err)) {
    console.log('Rate limit exceeded')
  } else if (isRetryError(err)) {
    console.log('All retry attempts failed')
  }
  throw err
}
```

## Common Patterns

### Error Handling Composition

```ts
// Compose error handling with business logic
async function updateUser(id: string, data: UserData): Promise<User> {
  const [user, fetchErr] = await attempt(() => fetchUser(id))
  if (fetchErr) throw fetchErr

  const [updated, updateErr] = await attempt(() => updateUserData(user, data))
  if (updateErr) throw updateErr

  return updated
}
```

### Resilient API Calls

```ts
// Combine flow control utilities
const resilientApi = retry(
  circuitBreaker(
    withTimeout(apiCall, 5000),
    { maxFailures: 3, resetAfter: 30000 }
  ),
  { attempts: 3, delay: 1000 }
)
```

### Safe Object Operations

```ts
// Safe deep operations
const safeUpdate = (state: State, updates: Partial<State>) => {
  const cloned = clone(state)
  const merged = merge(cloned, updates, {
    mergeArrays: false,
    mergeSets: false
  })

  if (!equals(state, merged)) {
    return merged
  }
  return state
}
```

### Type-Safe Path Access

```ts
// Type-safe configuration access
function getConfig<P extends PathNames<Config>>(path: P): PathValue<Config, P> | undefined {
  return reach(globalConfig, path)
}

const apiUrl = getConfig('api.endpoints.users') // Type-safe!
```

## Configuration & Environment Variables

### Environment Variable Parsing

Transform flat environment variables into nested configuration objects with intelligent type coercion. Particularly useful for containerized applications and 12-factor apps.

```ts
const makeNestedConfig: <C extends object, F extends Record<string, string>>(
  flatConfig: F,
  opts?: {
    filter?: (key: string, val: string) => boolean
    forceAllCapToLower?: boolean  // Default: true
    separator?: string            // Default: "_"
    stripPrefix?: string | number // Strip prefix from keys
    parseUnits?: boolean          // Default: false
    skipConversion?: (key: string, value: unknown) => boolean
    memoizeOpts?: MemoizeOptions | false
  }
) => <P extends PathLeaves<C>>(path?: P, defaultValue?: PathValue<C, P>) => C

const castValuesToTypes: (
  obj: object,
  opts?: {
    parseUnits?: boolean  // Default: false
    skipConversion?: (key: string, value: unknown) => boolean
  }
) => void  // Mutates in place
const isEnabledValue: (val: unknown) => boolean
const isDisabledValue: (val: unknown) => boolean
const hasEnabledOrDisabledValue: (val: unknown) => boolean
```

#### Why Use This

Environment variables are always strings, but application configuration often needs booleans, numbers, and nested structures. `makeNestedConfig` bridges this gap by:

1. **Converting flat keys to nested objects**: `APP_DB_HOST` → `{ db: { host: ... } }`
2. **Smart type coercion**: `"true"` → `true`, `"5432"` → `5432`
3. **Preserving camelCase in all-caps contexts**: `APP_WORKER_maxRetries` → `{ worker: { maxRetries: ... } }`

This eliminates manual environment variable parsing and reduces configuration boilerplate.

#### Configuration Patterns

```ts
// Basic usage - transform environment variables
// Given process.env:
// {
//   APP_DB_HOST: 'localhost',
//   APP_DB_PORT: '5432',
//   APP_DEBUG: 'true',
//   APP_FEATURE_X_ENABLED: 'false'
// }

// Define expected config shape for type safety
type AppConfig = {
  db: { host: string; port: number };
  debug: boolean;
  feature: { x: { enabled: boolean } };
}

const config = makeNestedConfig<AppConfig>(process.env, {
  filter: (key) => key.startsWith('APP_'),
  stripPrefix: 'APP_',
  forceAllCapToLower: true,
  separator: '_'
})

console.log(config())
// {
//   db: { host: 'localhost', port: 5432 },
//   debug: true,
//   feature: { x: { enabled: false } }
// }

// Reach into config with path parameter
const dbHost = config('db.host')  // 'localhost'
const dbPort = config('db.port')  // 5432
const debug = config('debug')     // true

// Use default values for missing paths
const timeout = config('api.timeout', 5000)  // 5000 (uses default)
const retries = config('api.retries', 3)     // 3 (uses default)

// Memoized configuration - prevents repeated processing
const getCachedConfig = makeNestedConfig(process.env, {
  filter: (key) => key.startsWith('APP_'),
  stripPrefix: 'APP_',
  memoizeOpts: { ttl: 300000 }  // Cache for 5 minutes
})

// Mixed casing - preserve camelCase in configuration
// Given: APP_WORKER_EMAILS_maxRunsPerMin: '100'
const workerConfig = makeNestedConfig(process.env, {
  filter: (key) => key.startsWith('APP_WORKER_'),
  stripPrefix: 'APP_WORKER_',
  forceAllCapToLower: true  // ALL_CAPS → lowercase, but keeps maxRunsPerMin
})

console.log(workerConfig())
// { emails: { maxRunsPerMin: 100 } }
// Note: maxRunsPerMin preserved because it's not all-caps

// Custom separators for different naming conventions
// Given: APP_DB__HOST, APP_DB__PORT
const customSepConfig = makeNestedConfig(process.env, {
  filter: (key) => key.startsWith('APP_'),
  stripPrefix: 'APP_',
  separator: '__'  // Use double underscore
})

// Numeric prefix stripping
const shortConfig = makeNestedConfig(process.env, {
  stripPrefix: 4  // Strip first 4 characters ("APP_")
})

// Parse unit values (time durations and byte sizes)
// Given: APP_TIMEOUT='5m', APP_MAX_UPLOAD_SIZE='10mb'
const configWithUnits = makeNestedConfig(process.env, {
  filter: (key) => key.startsWith('APP_'),
  stripPrefix: 'APP_',
  parseUnits: true  // Enable unit parsing
})

console.log(configWithUnits())
// { timeout: 300000, max: { upload: { size: 10485760 } } }

// Skip conversion for sensitive keys (keep as strings)
// Given: APP_API_KEY='12345', APP_SECRET='abc', APP_PORT='3000'
const configWithSkip = makeNestedConfig(process.env, {
  filter: (key) => key.startsWith('APP_'),
  stripPrefix: 'APP_',
  skipConversion: (key) => key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')
})

console.log(configWithSkip())
// { api: { key: '12345' }, secret: 'abc', port: 3000 }
// Keys and secrets kept as strings, port converted to number

// Combine parseUnits and skipConversion
const advancedConfig = makeNestedConfig(process.env, {
  filter: (key) => key.startsWith('APP_'),
  stripPrefix: 'APP_',
  parseUnits: true,
  skipConversion: (key) => key.toLowerCase().includes('key')
})
```

#### Type Coercion

The `castValuesToTypes` function intelligently converts string values:

```ts
const config = {
  debug: 'true',        // → true
  verbose: 'yes',       // → true
  silent: 'false',      // → false
  disabled: 'no',       // → false
  port: '3000',         // → 3000
  timeout: '5000',      // → 5000
  name: 'myapp',        // → 'myapp' (unchanged)
  nested: {
    enabled: 'true',    // → true (recursive)
    retries: '5'        // → 5 (recursive)
  }
}

castValuesToTypes(config)  // Mutates in place

// Parse unit values
const configWithUnits = {
  timeout: '5m',
  maxSize: '10mb',
  debug: 'true'
}

castValuesToTypes(configWithUnits, { parseUnits: true })
console.log(configWithUnits)
// { timeout: 300000, maxSize: 10485760, debug: true }

// Skip conversion for specific keys
const configWithSkip = {
  apiKey: '12345',
  secretToken: '67890',
  port: '3000'
}

castValuesToTypes(configWithSkip, {
  skipConversion: (key) => key.toLowerCase().includes('key') || key.toLowerCase().includes('token')
})
console.log(configWithSkip)
// { apiKey: '12345', secretToken: '67890', port: 3000 }

// Combine both options
const advancedConfig = {
  timeout: '5m',
  apiKey: '12345',
  port: '3000'
}

castValuesToTypes(advancedConfig, {
  parseUnits: true,
  skipConversion: (key) => key.toLowerCase().includes('key')
})
console.log(advancedConfig)
// { timeout: 300000, apiKey: '12345', port: 3000 }
```

**Recognized boolean values:**
- Enabled: `"true"`, `"yes"`, `true`
- Disabled: `"false"`, `"no"`, `false`

**Number coercion:**
- Only strings containing only digits: `/^\d+$/`
- Does not convert floats or negative numbers (intentional safety)

**Unit parsing (when parseUnits: true):**
- Time durations: `'5m'` → 300000 (milliseconds)
- Byte sizes: `'10mb'` → 10485760 (bytes)

#### Value Validation Helpers

```ts
// Check for enabled/disabled values
if (isEnabledValue(process.env.DEBUG)) {
  enableDebugMode()
}

if (isDisabledValue(process.env.FEATURE_FLAG)) {
  skipFeature()
}

// Validate configuration values
const hasValidToggle = hasEnabledOrDisabledValue(config.toggle)
```

#### Using the Path Parameter

The returned config function accepts optional `path` and `defaultValue` parameters. When you provide a type parameter to `makeNestedConfig`, the path parameter is type-checked and autocompletes:

```ts
// Define config shape for type safety
type AppConfig = {
  db: { host: string; port: number };
  api: { timeout: number };
}

const getConfig = makeNestedConfig<AppConfig>(process.env, {
  filter: (key) => key.startsWith('APP_'),
  stripPrefix: 'APP_'
})

// Get entire config object
const fullConfig = getConfig()  // Type: AppConfig

// Get specific value by path (type-safe with autocomplete)
const host = getConfig('db.host')          // Type: string
const port = getConfig('db.port')          // Type: number
const timeout = getConfig('api.timeout')   // Type: number

// Get specific value with fallback for missing paths
const maxRetries = getConfig('api.timeout', 5000)  // Type: number (uses default if missing)
```

**When to use path parameter:**
- Accessing single config values in hot paths (avoids processing entire config)
- Providing default values for optional configuration
- Building config getters with fallback logic
- Type-safe access to deeply nested values

**When to get full config:**
- Initializing application with all settings
- Passing config to subsystems that need multiple values
- Validating entire configuration structure

#### When to Use Each Pattern

**`makeNestedConfig` when:**
- Loading environment variables in containerized apps
- Building 12-factor app configuration
- Need nested structure from flat keys
- Want memoization for expensive config processing

**`castValuesToTypes` when:**
- Already have flat config object
- Need in-place mutation (memory efficient)
- Custom parsing logic required

**Direct validation helpers when:**
- Checking individual environment variable values
- Building custom configuration parsers
- Need boolean coercion without full config transformation

## Unit Conversion & Formatting

Human-readable time and byte size utilities for configuration, logging, and user interfaces.

```ts
// Time unit constants
const timeUnits: {
  sec: number, min: number, hour: number, day: number, week: number
  min15: number, min30: number, hour2: number, hour4: number, hour8: number, hour12: number
  secs(n: number): number, mins(n: number): number, hours(n: number): number
  days(n: number): number, weeks(n: number): number, months(n: number): number, years(n: number): number
}

// Byte unit constants
const byteUnits: {
  kb: number, mb: number, gb: number, tb: number
  kbs(n: number): number, mbs(n: number): number, gbs(n: number): number, tbs(n: number): number
}

// Convenience exports
const seconds: (n: number) => number
const minutes: (n: number) => number
const hours: (n: number) => number
const days: (n: number) => number
const weeks: (n: number) => number
const months: (n: number) => number
const years: (n: number) => number

const kilobytes: (n: number) => number
const megabytes: (n: number) => number
const gigabytes: (n: number) => number
const terabytes: (n: number) => number

// Parsing - flexible input formats
const parseTimeDuration: (str: string) => number  // → milliseconds
const parseByteSize: (str: string) => number      // → bytes

// Formatting - numbers to human-readable strings
const formatTimeDuration: (ms: number, opts?: {
  decimals?: number
  unit?: 'sec' | 'min' | 'hour' | 'day' | 'week' | 'month' | 'year'
}) => string

const formatByteSize: (bytes: number, opts?: {
  decimals?: number  // Default: 2
  unit?: 'kb' | 'mb' | 'gb' | 'tb'
}) => string
```

#### Why Use This

Configuration files and environment variables often use human-readable duration/size strings. Converting these to milliseconds/bytes (and vice versa for display) is repetitive boilerplate. These utilities provide:

1. **Natural language parsing**: `"5 minutes"` → `300000` milliseconds
2. **Multiple format support**: `"5min"`, `"5mins"`, `"5 minutes"` all work
3. **Intelligent formatting**: Auto-selects appropriate unit for display
4. **Type safety**: All conversions are explicit and typed

#### Time Duration Patterns

```ts
// Parse various time formats to milliseconds
parseTimeDuration('30sec')       // 30000
parseTimeDuration('30 secs')     // 30000
parseTimeDuration('30 seconds')  // 30000
parseTimeDuration('5m')          // 300000
parseTimeDuration('5min')        // 300000
parseTimeDuration('5 minutes')   // 300000
parseTimeDuration('2h')          // 7200000
parseTimeDuration('2hrs')        // 7200000
parseTimeDuration('2 hours')     // 7200000
parseTimeDuration('1d')          // 86400000
parseTimeDuration('1day')        // 86400000
parseTimeDuration('2.5 hours')   // 9000000 (supports decimals)

// Use in configuration
const config = {
  sessionTimeout: parseTimeDuration(process.env.SESSION_TIMEOUT || '1hour'),
  cacheExpiry: parseTimeDuration(process.env.CACHE_TTL || '15min'),
  heartbeat: parseTimeDuration(process.env.HEARTBEAT || '30sec')
}

// Programmatic duration calculation
setTimeout(cleanup, minutes(5))        // 5 minutes
setInterval(poll, seconds(30))        // 30 seconds
cache.set(key, value, { ttl: hours(1) })  // 1 hour

// Format for display
formatTimeDuration(1000)              // "1sec"
formatTimeDuration(30000)             // "30sec"
formatTimeDuration(90000)             // "1.5min" (smart decimals)
formatTimeDuration(3600000)           // "1hour"
formatTimeDuration(86400000)          // "1day"

// Control formatting
formatTimeDuration(90000, { unit: 'sec' })     // "90sec" (force unit)
formatTimeDuration(90000, { decimals: 0 })     // "2min" (round up)
formatTimeDuration(90000, { decimals: 2 })     // "1.5min" (trailing zeros removed)

// Logging with readable durations
logger.info(`Cache expires in: ${formatTimeDuration(cache.ttl)}`)
logger.debug(`Request took: ${formatTimeDuration(elapsed)}`)
```

#### Byte Size Patterns

```ts
// Parse various byte size formats
parseByteSize('10kb')            // 10240
parseByteSize('10 kbs')          // 10240
parseByteSize('10 kilobytes')    // 10240
parseByteSize('5mb')             // 5242880
parseByteSize('5 megabytes')     // 5242880
parseByteSize('2.5gb')           // 2684354560 (supports decimals)

// Use in configuration
const config = {
  uploadLimit: parseByteSize(process.env.MAX_UPLOAD || '10mb'),
  diskQuota: parseByteSize(process.env.DISK_QUOTA || '100gb'),
  thumbnailMax: parseByteSize(process.env.THUMB_SIZE || '500kb')
}

// Programmatic size calculation
const maxFileSize = megabytes(10)  // 10485760
const bufferSize = kilobytes(64)   // 65536

// Format for display
formatByteSize(1024)              // "1kb"
formatByteSize(1536)              // "1.5kb"
formatByteSize(10485760)          // "10mb"
formatByteSize(1073741824)        // "1gb"

// Control formatting
formatByteSize(1024, { unit: 'mb' })          // "0mb" (force unit)
formatByteSize(1536, { decimals: 0 })         // "2kb" (round up)
formatByteSize(1024 * 1.5, { decimals: 3 })   // "1.5kb"

// Display file sizes
files.forEach(file => {
  console.log(`${file.name}: ${formatByteSize(file.size)}`)
})
```

#### Advanced Time Unit Usage

```ts
// Using constants directly
const CACHE_TTL = timeUnits.min15  // 15 minutes
const SESSION_DURATION = timeUnits.hour2  // 2 hours

// Combining units for complex durations
const complexDuration =
  days(7) +
  hours(12) +
  minutes(30)  // 7 days, 12 hours, 30 minutes in ms

// Rate limiting with time units
const apiLimiter = rateLimit(apiCall, {
  maxCalls: 100,
  windowMs: minutes(15)  // 100 calls per 15 minutes
})

// Retry with exponential backoff
const resilientFetch = retry(fetch, {
  retries: 3,
  delay: seconds(1),
  backoff: 2  // 1s, 2s, 4s
})

// Circuit breaker timeouts
const protectedApi = circuitBreaker(apiCall, {
  maxFailures: 5,
  resetAfter: minutes(5)  // Reset after 5 minutes
})
```

#### When to Use Each Pattern

**Constants (`timeUnits.min`, `byteUnits.mb`) when:**
- You need the raw millisecond/byte value
- Building configuration objects
- Performance-critical code (no function call overhead)

**Functions (`minutes()`, `megabytes()`) when:**
- Dynamic values from variables
- Clearer intent: `minutes(config.timeout)` vs `config.timeout * 60000`
- Composing multiple units

**Parsing (`parseTimeDuration()`, `parseByteSize()`) when:**
- Reading from environment variables
- Processing user input
- Loading configuration files
- Supporting multiple input formats

**Formatting (`formatTimeDuration()`, `formatByteSize()`) when:**
- Displaying durations to users
- Logging human-readable values
- Building UI components
- Generating reports