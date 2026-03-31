---
description: Usage patterns for the @logosdx/utils package.
globs: '*.ts'
---

# @logosdx/utils - Usage Context

A comprehensive utility library providing Go-style error handling, advanced flow control, type-safe data operations, and powerful TypeScript type utilities.

## Table of Contents

- [Core Philosophy](#core-philosophy) — Error tuple pattern, never try-catch
- [Error Handling](#error-handling) — attempt, attemptSync
- [Flow Control](#flow-control)
  - [Timing & Rate Control](#timing--rate-control) — debounce, throttle, rateLimit, RateLimitTokenBucket
  - [Resilience Patterns](#resilience-patterns) — retry, circuitBreaker, withTimeout, batch, withInflightDedup, SingleFlight
  - [Memoization & Caching](#memoization--caching) — memoize, memoizeSync with LRU/TTL/SWR
- [Data Operations](#data-operations)
  - [Object Manipulation](#object-manipulation) — clone, equals, merge, addHandlerFor
  - [Safe Property Access](#safe-property-access) — reach, setDeep, getSafeKeys
  - [Collections](#collections) — PriorityQueue
- [Validation & Type Guards](#validation--type-guards) — Environment detection, assertions, guards
- [TypeScript Type Utilities](#typescript-type-utilities) — Function types, path types, utility types
- [Property Management](#property-management) — definePublicProps, definePrivateProps
- [Async Utilities](#async-utilities) — Deferred, TimeoutPromise, wait, runInSeries
- [Array & Data Utilities](#array--data-utilities) — chunk, nTimes, serializer
- [Error Types & Utilities](#error-types--utilities) — RetryError, TimeoutError, etc.
- [Configuration & Environment Variables](#configuration--environment-variables) — makeNestedConfig, castValuesToTypes
- [Unit Conversion & Formatting](#unit-conversion--formatting) — timeUnits, byteUnits, parse/format

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

> **Every async I/O call in LogosDX code must use `attempt()`.** This includes storage operations, fetch calls, state-machine invoke sources, observer queue processors, and any function that touches the network or filesystem. Never use try-catch — the error tuple is the only sanctioned pattern.

### Common Patterns

`attempt()` is not just for fetch. Use it for **every** I/O or error-prone operation:

```ts
// Storage operation
const [user, err] = await attempt(() => storage.get('user'));

// State machine invoke source
const [result, err] = await attempt(() => validateAddress(address));

// Queue processor
const [, err] = await attempt(() => processNotification(item));

// DOM operation that may fail
const [, parseErr] = attemptSync(() => el.insertAdjacentHTML('beforeend', html));

// Any async function
const [data, err] = await attempt(() => someAsyncWork());
if (err) return handleError(err);
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
const rateLimit: <T extends Func>(fn: T, options: RateLimitOptions<T> | RateLimitBucketOptions<T>) => T

class RateLimitTokenBucket {
  constructor(config: RateLimitTokenBucket.Config)
  consume(count?: number): boolean
  waitForToken(count?: number, opts?: { onRateLimit?: Function; abortController?: AbortController }): Promise<void>
  waitAndConsume(count?: number, opts?: { onRateLimit?: Function; abortController?: AbortController }): Promise<boolean>
  hasTokens(count?: number): boolean
  get tokens(): number
  get snapshot(): { currentTokens: number; capacity: number; rejectionRate: number; /* ... */ }
  get state(): RateLimitTokenBucket.State
  get isSaveable(): boolean
  save(): Promise<void>
  load(): Promise<void>
  reset(): void
}

namespace RateLimitTokenBucket {
  interface Config {
    capacity: number
    refillIntervalMs: number
    initialState?: State
    save?: (state: State) => void | Promise<void>
    load?: () => State | null | Promise<State | null>
  }
  interface State {
    tokens: number
    lastRefill: number
    stats?: Stats
  }
  interface Stats {
    totalRequests: number
    rejectedRequests: number
    totalWaitTime: number
    waitCount: number
    createdAt: number
  }
}

class RateLimitError extends Error {
  constructor(message: string, maxCalls: number)
}
const isRateLimitError: (error: unknown) => error is RateLimitError

const limitedApi = rateLimit(apiCall, { maxCalls: 10, windowMs: 60000 })
```

### Resilience Patterns

```ts
// Retry with backoff
const retry: <T extends Func>(fn: T, options: RetryOptions) => Promise<ReturnType<T>>
const makeRetryable: <T extends Func>(fn: T, options: RetryOptions) => T

interface RetryOptions {
  retries?: number           // Number of retries (default: 3)
  delay?: number             // Delay between retries in ms (default: 0)
  backoff?: number           // Multiplier for delay between retries (default: 1)
  jitterFactor?: number      // Jitter factor for delay randomization (default: 0)
  shouldRetry?: (error: Error) => boolean  // Determine if should retry
  signal?: AbortSignal       // Abort signal to cancel retry
  throwLastError?: boolean   // Throw original error instead of RetryError (default: false)
  onRetry?: (error: Error, attempt: number) => void | Promise<void>  // Callback before each retry
  onRetryExhausted?: (error: Error) => ReturnType<Func> | Promise<ReturnType<Func>>  // Fallback handler
}

class RetryError extends Error {}
const isRetryError: (error: unknown) => error is RetryError

// Basic retry with exponential backoff and jitter
// backoff multiplies the delay after each attempt: 1000 → 2000 → 4000 → ...
// jitterFactor adds ±randomization to prevent thundering herd (0 = none, 1 = full)
const resilientFetch = makeRetryable(fetch, {
  retries: 5,
  delay: 1000,
  backoff: 2,
  jitterFactor: 0.5
})

// Preserve original error instead of RetryError (for downstream error handling)
const [result, err] = await attempt(() => retry(fetchData, {
  retries: 3,
  delay: 100,
  backoff: 2,            // exponential backoff: 100 → 200 → 400
  jitterFactor: 0.25,    // 25% jitter randomization on each delay
  throwLastError: true    // Throws the actual network error, not RetryError
}))
if (err) {
  // err is the original error from fetchData, not RetryError
  console.log(err.message)  // e.g., "Network timeout" not "Max retries reached"
}

// Logging retry attempts
await retry(fetchData, {
  retries: 3,
  delay: 100,
  onRetry: (error, attempt) => {
    console.log(`Retry attempt ${attempt} after error: ${error.message}`)
  }
})

// Graceful fallback when retries exhausted (no throw)
const data = await retry(fetchData, {
  retries: 3,
  delay: 100,
  onRetryExhausted: (error) => {
    console.warn(`All retries failed: ${error.message}`)
    return { fallback: true }  // Return fallback value instead of throwing
  }
})

// Circuit breaker for failing services
const circuitBreaker: <T extends Func>(fn: T, options: CircuitBreakerOptions<T>) => T

interface CircuitBreakerOptions<T extends Func> {
  maxFailures?: number              // Consecutive failures before tripping (default: 3)
  resetAfter?: number               // Ms before testing recovery (default: 1000)
  halfOpenMaxAttempts?: number      // Test calls allowed in half-open (default: 1)
  shouldTripOnError?: (error: Error) => boolean  // Filter which errors trip
  onTripped?: (error: CircuitBreakerError, store: CircuitBreakerStore) => void
  onError?: (error: Error, args: Parameters<T>) => void
  onReset?: () => void              // Called when circuit closes after recovery
  onHalfOpen?: (store: CircuitBreakerStore) => void
}

class CircuitBreakerError extends Error {}
const isCircuitBreakerError: (error: unknown) => error is CircuitBreakerError

// Protect an API call — trips after 5 failures, tests recovery after 10s
const protectedApi = circuitBreaker(apiCall, {
  maxFailures: 5,
  resetAfter: 10000,
  shouldTripOnError: (err) => err.message.includes('HTTP 5'),
  onTripped: (err, store) => console.warn(`Tripped after ${store.failures} failures`),
  onReset: () => console.log('Service recovered')
})

const [data, err] = await attempt(() => protectedApi('/users'))
if (isCircuitBreakerError(err)) {
  // Service unavailable — use fallback
}

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

// Process 1000 records, 50 at a time, continuing past errors
const results = await batch(processRecord, {
  items: records,
  concurrency: 50,
  failureMode: 'continue',  // 'abort' (default) stops on first error
  onError: (err, item, idx) => console.warn(`Item ${idx} failed:`, err),
  onChunkStart: ({ index, total, completionPercent }) => {
    console.log(`Chunk ${index + 1}/${total} (${completionPercent}%)`)
  }
})

// Each result tracks success/failure per item
for (const { result, error, item, itemIndex } of results) {
  if (error) console.warn(`Item ${itemIndex} failed:`, error)
  else console.log(`Item ${itemIndex} →`, result)
}

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

// SingleFlight - Generic coordinator for cache and in-flight deduplication
class SingleFlight<T = unknown> {
  constructor(opts?: SingleFlightOptions<T>)

  // Cache primitives (all async for adapter flexibility)
  getCache(key: string): Promise<CacheEntry<T> | null>
  setCache(key: string, value: T, opts?: SetCacheOptions): Promise<void>
  deleteCache(key: string): Promise<boolean>
  hasCache(key: string): Promise<boolean>
  invalidateCache(predicate: (key: string) => boolean): Promise<number>
  clearCache(): Promise<void>

  // In-flight primitives
  getInflight(key: string): InflightEntry<T> | null
  trackInflight(key: string, promise: Promise<T>): () => void  // Returns cleanup fn
  joinInflight(key: string): number  // Returns new waitingCount
  hasInflight(key: string): boolean

  // Lifecycle
  clear(): Promise<void>
  stats(): SingleFlightStats
}

interface SingleFlightOptions<T> {
  adapter?: CacheAdapter<T>    // Default: MapCacheAdapter
  defaultTtl?: number          // Default: 60000 (1 minute)
  defaultStaleIn?: number      // Default: undefined (no SWR)
  maxSize?: number             // Default: 1000
  cleanupInterval?: number     // Default: 60000
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

  const inflight = flight.getInflight(key)
  if (inflight) {
    flight.joinInflight(key)
    return inflight.promise
  }

  const promise = api.fetchUser(id)
  const cleanup = flight.trackInflight(key, promise)

  const [user, err] = await attempt(() => promise)
  cleanup()
  if (err) throw err
  return user
}
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
// Fresh (age < staleIn): Returns cached. Stale (age > staleIn): Races fresh vs timeout.
// No cached data: Fetches fresh (blocks).

// Cache management
getUser.cache.stats()     // { hits: 10, misses: 3, hitRate: 0.77, evictions: 0, size: 3 }
getUser.cache.clear()     // Clear all entries
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
// Priority queue (min-heap by default, O(log n) push/pop)
class PriorityQueue<T> {
  constructor(options?: PriorityQueueOptions<T>)
  push(value: T, priority?: number): void    // Default priority: 0
  pop(): T | null                            // Remove highest-priority item
  popMany(count?: number): T[]               // Remove multiple items
  peek(): T | null                           // View without removing
  peekMany(count?: number): T[]              // View multiple items
  find(predicate: (value: T) => boolean): T | null
  heapify(items: Node<T>[]): void            // Build heap from array O(n)
  clone(): PriorityQueue<T>                  // Independent copy
  toSortedArray(): T[]                       // Extract sorted
  size(): number
  isEmpty(): boolean
  clear(): void
  [Symbol.iterator](): IterableIterator<T>   // Iterate in priority order
}

interface PriorityQueueOptions<T> {
  lifo?: boolean      // LIFO for equal priorities (default: false/FIFO)
  compare?: (a: Node<T>, b: Node<T>) => number
  maxHeap?: boolean   // Invert priority order (default: false)
}

const taskQueue = new PriorityQueue<Task>()
taskQueue.push(urgentTask, 1)
taskQueue.push(normalTask, 5)

const leaderboard = new PriorityQueue<string>({ maxHeap: true })
leaderboard.push('Alice', 95)
leaderboard.pop() // 'Alice' (highest score first)
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

// Run functions in series (execute cleanup functions, etc.)
const runInSeries: <T extends Iterable<Func>>(fns: T) => ReturnsOfReturns<T>
runInSeries([cleanup1, cleanup2, cleanup3])

// Create a function that runs multiple functions in series with separate args
const makeInSeries: <T extends readonly Func[]>(fns: T) => (...args: ParamsOfParams<T>) => ReturnsOfReturns<T>
const pipeline = makeInSeries([logStep, saveData, notify] as const)
pipeline(['processing'], [userData], ['User created'])
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
const generateId: () => string  // Returns '_' + random alphanumeric

// Repeat a function N times
const nTimes: <T>(fn: (iteration: number) => T, n: number) => T[]
nTimes(() => createEl('span'), 3)  // [span, span, span]
nTimes((i) => (i + 1) * 2, 3)     // [2, 4, 6]

// Enhanced key generation for caching (handles circular refs, functions, Dates, Maps, Sets)
const serializer: (args: unknown[]) => string
serializer([{ b: 2, a: 1 }]) === serializer([{ a: 1, b: 2 }])  // true (sorted keys)
```

## Error Types & Utilities

Flow control utilities provide specific error types for different failure modes:

```ts
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
```

## Configuration & Environment Variables

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
) => {
  allConfigs: () => C
  getConfig: <P extends PathLeaves<C>>(path: P, defaultValue?: PathValue<C, P>) => PathValue<C, P>
}

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

### Basic Usage

```ts
// Given process.env: APP_DB_HOST='localhost', APP_DB_PORT='5432', APP_DEBUG='true'
type AppConfig = {
  db: { host: string; port: number };
  debug: boolean;
}

const { allConfigs, getConfig } = makeNestedConfig<AppConfig>(process.env, {
  filter: (key) => key.startsWith('APP_'),
  stripPrefix: 'APP_',
  forceAllCapToLower: true
})

allConfigs()                   // { db: { host: 'localhost', port: 5432 }, debug: true }
getConfig('db.host')           // 'localhost'
getConfig('db.port')           // 5432
getConfig('api.timeout', 5000) // 5000 (default for missing path)
```

### Type Coercion Table

`castValuesToTypes` converts string values recursively:

| Input | Output | Rule |
|-------|--------|------|
| `"true"`, `"yes"` | `true` | Boolean enabled |
| `"false"`, `"no"` | `false` | Boolean disabled |
| `"3000"` | `3000` | Digits-only string → number |
| `"myapp"` | `"myapp"` | Non-numeric string unchanged |
| `"5m"` | `300000` | Time duration (with `parseUnits: true`) |
| `"10mb"` | `10485760` | Byte size (with `parseUnits: true`) |

## Unit Conversion & Formatting

```ts
// Time units (all values in milliseconds)
const timeUnits: {
  sec: number, min: number, hour: number, day: number, week: number
  min15: number, min30: number, hour2: number, hour4: number, hour8: number, hour12: number
  secs(n: number): number, mins(n: number): number, hours(n: number): number
  days(n: number): number, weeks(n: number): number, months(n: number): number, years(n: number): number
}

// Byte units (all values in bytes)
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

// Parse examples: '5m' → 300000, '2.5 hours' → 9000000, '10mb' → 10485760
// Format examples: formatTimeDuration(90000) → "1.5min", formatByteSize(10485760) → "10mb"

// Usage in configuration
setTimeout(cleanup, minutes(5))
cache.set(key, value, { ttl: hours(1) })
const maxUpload = parseByteSize(process.env.MAX_UPLOAD || '10mb')
```
