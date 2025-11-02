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

### Performance & Caching

```ts
// Async memoization with enhanced cache management and stale-while-revalidate
type EnhancedMemoizedFunction<T> = T & {
  cache: {
    clear(): void
    delete(key: string): boolean
    has(key: string): boolean
    size: number
    stats(): { hits: number; misses: number; hitRate: number; size: number; evictions: number }
    keys(): IterableIterator<string>
    entries(): Array<[string, ReturnType<T> | undefined]>
  }
}

interface MemoizeOptions<T> {
  ttl?: number              // Time to live in milliseconds
  maxSize?: number          // Maximum cache size
  useWeakRef?: boolean      // Use WeakRef for memory management
  generateKey?: (args: Parameters<T>) => string  // Custom key generator
  staleIn?: number          // Time in ms after which data is stale (enables stale-while-revalidate)
  staleTimeout?: number     // Maximum wait time for fresh data when stale (defaults to 100ms)
}

const memoize: <T extends AnyAsyncFunc>(fn: T, options?: MemoizeOptions<T>) => EnhancedMemoizedFunction<T>
const memoizeSync: <T extends AnyFunc>(fn: T, options?: MemoizeOptions<T>) => EnhancedMemoizedFunction<T>

// Basic memoization
const cachedApi = memoize(fetchUser, {
  ttl: 60000,
  maxSize: 1000,
  useWeakRef: true,
  generateKey: (args) => JSON.stringify(args)
})

// Stale-while-revalidate pattern - return cached data immediately while fetching fresh data
const swrApi = memoize(fetchUser, {
  ttl: 300000,            // Cache for 5 minutes
  staleIn: 60000,         // Consider stale after 1 minute
  staleTimeout: 200,      // Wait max 200ms for fresh data when stale
  maxSize: 1000
})

// When stale data exists:
// - Returns cached data immediately if fresh data takes longer than staleTimeout
// - Returns fresh data if it arrives within staleTimeout
// - Updates cache with fresh data in background either way

// Function composition with flow control
const composeFlow: <T extends AnyAsyncFunc>(fn: T, opts: ComposeFlowOptions<T>) => T

const resilientApi = composeFlow(apiCall, {
  rateLimit: { maxCalls: 10, windowMs: 60000 },
  circuitBreaker: { maxFailures: 3, resetAfter: 30000 },
  retry: { retries: 3, delay: 1000 },
  withTimeout: { timeout: 5000 }
})
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
// Dot-notation path traversal
const reach: <T, P extends PathNames<T>>(obj: T, path: P) => PathValue<T, P> | undefined

const userName = reach(response, 'data.user.profile.name')
const score = reach(gameState, 'players.0.stats.score')

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