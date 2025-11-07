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
interface DebouncedFunction<T extends AnyFunc> {
  (...args: Parameters<T>): void;
  flush(): ReturnType<T> | undefined;  // Execute immediately and return result
  cancel(): void;                      // Stop pending execution
}

const debounce: <T extends AnyFunc>(fn: T, options: DebounceOptions) => DebouncedFunction<T>

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
interface ThrottledFunction<T extends AnyFunc> {
  (...args: Parameters<T>): ReturnType<T>;
  cancel(): void;  // Clear throttle state and allow immediate execution
}

const throttle: <T extends AnyFunc>(fn: T, options: ThrottleOptions) => ThrottledFunction<T>

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
const rateLimit: <T extends AnyFunc>(fn: T, options: RateLimitOptions<T>) => T

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
const retry: <T extends AnyFunc>(fn: T, options: RetryOptions) => Promise<ReturnType<T>>
const makeRetryable: <T extends AnyFunc>(fn: T, options: RetryOptions) => T

class RetryError extends Error {}
const isRetryError: (error: unknown) => error is RetryError

const resilientFetch = makeRetryable(fetch, { retries: 3, delay: 1000, backoff: 2 })

// Circuit breaker for failing services
const circuitBreaker: <T extends AnyFunc>(fn: T, options: CircuitBreakerOptions<T>) => T

class CircuitBreakerError extends Error {}
const isCircuitBreakerError: (error: unknown) => error is CircuitBreakerError

const protectedApi = circuitBreaker(apiCall, { maxFailures: 3, resetAfter: 30000 })

// Timeout protection
const withTimeout: <T extends AnyFunc>(fn: T, options: WithTimeoutOptions) => T
const runWithTimeout: <T extends AnyFunc>(fn: T, options: WithTimeoutOptions) => Promise<ReturnType<T> | null>

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
  keyFn?: (...args: Args) => Key
  hooks?: InflightHooks<Key, Value>
}

interface InflightHooks<Key, Value> {
  onStart?: (key: Key) => void
  onJoin?: (key: Key) => void
  onResolve?: (key: Key, value: Value) => void
  onReject?: (key: Key, error: unknown) => void
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
  hooks: {
    onStart: (key) => logger.debug("started", key),
    onJoin: (key) => logger.debug("joined", key),
    onResolve: (key) => logger.debug("completed", key)
  }
})

// Custom key function for hot paths
const getProfile = withInflightDedup(fetchProfile, {
  keyFn: (req) => req.userId  // Extract only discriminating field
})

// Key differences from memoize:
// - No caching after settlement (each new request starts fresh)
// - Only shares promise while in-flight
// - No TTL/stale-while-revalidate features
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
  generateKey?: (args: Parameters<T>) => string  // Custom key generator
  onError?: (error: Error, args: Parameters<T>) => void  // Error handler
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
  generateKey: ([req]) => req.userId  // Ignore timestamp, cache by userId only
})

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