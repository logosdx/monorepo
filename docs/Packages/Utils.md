---
permalink: '/packages/utils'
aliases: ["@logosdx/utils", "Utils", "utilities"]
---

# @logosdx/utils

**Production-tested utilities for building resilient JavaScript applications.**

`@logosdx/utils` provides a comprehensive set of utilities that handle common edge cases in production environments: network failures, race conditions, data mutations, and complex error scenarios. Built on patterns proven across thousands of deployments.

Works everywhere: browsers, React Native, Node.js, Cloudflare Workers.

> 📚 **Complete API Documentation**: [typedoc.logosdx.dev](https://typedoc.logosdx.dev/modules/_logosdx_utils.html)

```bash
npm install @logosdx/utils
```

```bash
pnpm add @logosdx/utils
```

```bash
yarn add @logosdx/utils
```

## Quick Start

```ts
import { attempt, retry, clone, equals } from '@logosdx/utils';

// Clean error handling with [result, error] tuples
const [user, err] = await attempt(() => fetchUser(id));
if (err) return handleError(err);

// Retry with backoff
const [data, retryErr] = await retry(() => callFlakeyAPI(), {
    attempts: 3,
    delay: 1000
});

// Deep equality comparison
if (equals(user, { id: 1, name: 'John' })) {

    console.log('Hello John!');
}

// Clone with Map/Set support
const config = clone(defaultConfig);
```

## API Overview

The utilities are organized by category to help you find what you need:

### Control Flow

You're building a backend worker, or calling APIs from a frontend, or dealing with flaky third-party services. You want to survive timeouts, retries, and slow failures without rewriting the same try/catch wrappers. These utilities help you compose async logic that won't fall over in production.

| Function | Description | When to Use |
|----------|-------------|-------------|
| `attempt` | Go-style error handling that returns `[result, error]` tuples | Replace try-catch blocks for cleaner, composable error handling |
| `attemptSync` | Synchronous version of attempt for sync operations | Handle errors in sync functions without try-catch |
| `batch` | Process arrays of items with controlled concurrency | Process large datasets efficiently without overwhelming resources |
| `circuitBreaker` | Prevents calling failing functions and tests recovery | Protect against cascading failures from unreliable services |
| `circuitBreakerSync` | Synchronous version of circuit breaker | Protect sync operations from cascading failures |
| `composeFlow` | Combines multiple flow control utilities into one function | Build resilient operations with timeouts, retries, and circuit breaking |
| `debounce` | Delays function execution until after calls have stopped | Search inputs, resize handlers, API calls triggered by user input |
| `memoize` | Caches async function results based on input arguments | Expensive async calculations, API calls with predictable inputs |
| `memoizeSync` | Caches sync function results based on input arguments | Expensive sync calculations, data transformations |
| `makeRetryable` | Creates a retryable version of a function | When you need a reusable retryable function |
| `rateLimit` | Limits function calls to a maximum rate | Respect API rate limits, prevent spam, control resource usage |
| `retry` | Automatically retries failed operations with backoff | Network requests, database operations, flaky third-party APIs |
| `throttle` | Limits function execution to a maximum frequency | Scroll handlers, animation frames, frequent user interactions |
| `withTimeout` | Adds timeout protection to async operations | Prevent hanging requests, ensure responsive UIs |

### Data Structures

JavaScript's cloneDeep and Object.assign break on Maps, Sets, Dates, and circular refs. These utilities give you true deep equality and immutable state updates for real-world structures.

| Function | Description | When to Use |
|----------|-------------|-------------|
| `clone` | Creates deep copies of any JavaScript value including Maps, Sets, WeakRefs | State management, preventing mutations, backup copies |
| `equals` | Deep equality comparison for any JavaScript values including circular refs | Comparing complex state, testing, change detection |
| `merge` | Recursively merges objects, arrays, Maps, and Sets | Configuration merging, state updates, API response combining |
| `addHandlerFor` | Register custom clone/merge/equality handlers for specific constructors | Extend deep operations to work with custom classes |
| `mergeDefaults` | Default configuration object for merge operations | Customize merge behavior globally |

Additional type utilities from data structures:

| Type | Description |
|------|-------------|
| `AnyConstructor` | Type for any constructor function |
| `InferCloneType<T>` | Infer exact cloned type structure |
| `MergeTypes<Target, Source>` | Smart merge type that properly handles nested object merging |
| `IsCloneable<T>` | Check if type is cloneable |
| `CloneableProperties<T>` | Extract cloneable properties from an object type |
| `DeepPropertyPath<T>` | Type-safe property access for deeply nested objects |
| `DeepPropertyType<T, Path>` | Get the type of a deeply nested property |

### Validation Utils

You don't always need a full schema validator. You need to know: "Is this object what I expect?" These guards and assertions give you runtime checks without Zod/ajv overhead. Perfect for usage inside functions.

| Function | Description |
|----------|-------------|
| `assert` | Asserts that a value is truthy, throws AssertError if false |
| `assertObject` | Validates object properties against assertion functions |
| `assertOptional` | Only asserts if value is not undefined |
| `isOptional` | Returns true if value is undefined or passes custom validation |
| `isObject` | Checks if value is an object (uses instanceof Object) |
| `isFunction` | Checks if value is a function (uses instanceof Function) |
| `isPrimitive` | Checks if value is a primitive type (null, undefined, string, number, boolean, symbol, bigint, function) |
| `isNull` | Checks if value is null |
| `isUndefined` | Checks if value is undefined |
| `isDefined` | Checks if value is not undefined |
| `hasNoConstructor` | Checks if value is null or undefined (lacks constructor) |
| `hasSameConstructor` | Checks if both values have the same constructor |
| `isSameLength` | Checks if both collections have the same length/size |
| `isNonIterable` | Checks if value cannot be iterated over |
| `isPlainObject` | Checks if value is an object but not a common built-in type |
| `isDangerousKey` | Checks if a property key is dangerous for prototype pollution |
| `allKeysValid` | Validates all keys in an object pass a test function |
| `allItemsValid` | Validates all items in an iterable pass a test function |

### Environment Detection

You're building a frontend app, a backend worker, or a library that shares code between the two. You need to detect the current runtime environment.

| Function | Description |
|----------|-------------|
| `isBrowser` | Checks if running in a browser environment |
| `isReactNative` | Checks if running in React Native environment |
| `isCloudflare` | Checks if running in Cloudflare Workers environment |
| `isBrowserLike` | Checks if running in any browser-like environment |
| `isNode` | Checks if running in Node.js environment |

### Types

TypeScript type utilities for better type safety.

| Type | Description |
|------|-------------|
| `Func<A, R>` | Generic function type for type-safe function signatures |
| `AsyncFunc<A, R>` | Generic async function type for Promise-returning functions |
| `ClassType` | Generic constructor type for class-based operations |
| `NonFunctionProps<T>` | Extracts only non-function properties from an object type |
| `FunctionProps<T>` | Extracts only function properties from an object type |
| `DeepOptional<T>` | Makes all properties in T optional recursively |
| `DeepPartial<T>` | Makes all properties in T optional recursively (from data-structures) |
| `DeepRequired<T>` | Makes all properties in T required recursively (from data-structures) |
| `DeepReadonly<T>` | Makes all properties in T readonly recursively (from data-structures) |
| `NullableObject<T>` | Makes all properties in T nullable |
| `PathNames<T>` | Generates all possible dot-notation paths for an object type. Supports nested objects, arrays, maps, and sets. |
| `PathLeaves<T>` | Generates only the leaf paths (final values) for an object type |
| `PathValue<T, P>` | Extracts the value type at a specific string path. Supports nested objects, arrays, maps, and sets. |
| `StrOrNum` | Union of string and number types |
| `OneOrMany<T>` | Represents either a single item or array of items |
| `StringProps` | Object with string keys and string values |
| `BoolProps` | Object with string keys and boolean values |
| `MaybePromise<T>` | Value that can be either synchronous or asynchronous |
| `NotUndefined<T>` | Filters out undefined from a union type |
| `Falsy` | Union of all JavaScript falsy values |
| `Truthy<T>` | Filters out falsy values from a type |

### Object Manipulation

You're building a library or a framework that needs to manipulate objects and their properties. These utilities help you do meta-programming on classes and objects. Define properties that shouldn't be enumerable, or hidden, or only have getters, or setters, or whatever.

| Function | Description |
|----------|-------------|
| `definePublicProps` | Defines visible, non-configurable properties on an object |
| `definePrivateProps` | Defines hidden, non-configurable properties on an object |
| `definePrivateGetters` | Defines hidden, non-configurable getters on an object |
| `reach` | Safely navigates nested object properties using dot notation |

### Array and Collection Utils

You're doing a lot of array operations, or you're building a library that needs to manipulate arrays.

| Function | Description |
|----------|-------------|
| `itemsToArray` | Wraps single items in an array, leaves arrays unchanged |
| `oneOrMany` | Returns single item if array has one element, otherwise the array |
| `chunk` | Splits an array into smaller arrays of specified size |

### Other Utilities

You're need some stuff for dealing with async operations.

| Function | Description |
|----------|-------------|
| `wait` | Promise-based delay function (waits specified milliseconds) |
| `Deferred` | Class for creating externally controllable promises. This is a temporary polyfill for `Promise.withResolvers()`. |
| `noop` | No-operation function that accepts any arguments |
| `getSafeKeys` | Returns an array of keys from an object, excluding dangerous keys |
| `getSafeEntries` | Returns an array of [key, value] pairs from an object, excluding dangerous keys |

> ⚠️ `Deferred` is a temporary placeholder for `Promise.withResolvers()`, which is only available in Node.js 22, and any browser after early 2024. It will be deprecated once Node 20 is deprecated. It currently polyfills the method for environments that don't support it, so you _will_ have access to it. You can use the class if you prefer.

## Patterns

| Problem | Solution |
|----------|-------------|
| Replace nested try/catch | `attempt(fn)` |
| Retry transient failures | `retry(fn, opts) + attempt` |
| Enforce rate limits | `rateLimit(fn, opts)` |
| Circuit breaker for flaky APIs | `circuitBreaker(fn, opts)` |
| Compare complex state trees | `equals(a, b)` |
| Clone immutable app state | `clone(state)` |
| Merge config or updates | `merge(a, b)` |
| Memoize expensive lookups | `memoize(fn, opts)` |
| Debounce input handlers | `debounce(fn, delay)` |
| Throttle scroll handlers | `throttle(fn, interval)` |
| Detect Node vs Browser | `isNode(), isBrowser()` |
| Validate API response shape | `assertObject, isObject, isDefined` |
| Guard against proto pollution | `getSafeKeys, isDangerousKey` |
| Control async flow (timeouts, batching) | `composeFlow, batch, withTimeout` |


## Usage

### `attempt(fn)` / `attemptSync(fn)`

**What it does:**
Wraps any function and returns `[result, error]` instead of throwing. The async version handles promises, the sync version handles regular functions.

**Example:**

```ts
// Async example
const [user, err] = await attempt(async () => {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
});

if (err) {

    console.error('Failed to fetch user:', err);
    return null;
}

// Sync example
const [parsed, parseErr] = attemptSync(() => JSON.parse(userInput));
if (parseErr) {

    return 'Invalid JSON';
}
```

**When to use:**
Any time you'd write try/catch. Whenever you want to handle errors explicitly, or want to use the `[result, error]` tuple pattern, or want to ignore errors.

### `retry(fn, options)`

**What it does:**
Retries a function up to a specified number of times, with optional delay, exponential backoff, and jitter. Supports both sync and async functions. Allows custom logic to determine if an error is retryable. Throws a `RetryError` if the maximum number of retries is reached.

**Options:**

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `retries` | `number` | ❌ | Number of attempts before failing. Must be > 0. | `3` |
| `delay` | `number` | ❌ | Milliseconds to wait between retries. | `0` |
| `backoff` | `number` | ❌ | Multiplier for delay after each failure. | `1` (no backoff) |
| `jitter` | `number` | ❌ | Random factor (0-1) to add to delay for each retry. Prevents [thundering herd problem](https://en.wikipedia.org/wiki/Thundering_herd_problem). | `0` |
| `shouldRetry` | `function` | ❌ | Receives the error, returns true to retry, false to fail immediately. | Always retry |

**Example:**

```ts
// Async example
const [value, err] = await attempt(() =>
    retry(
        async () => {
            const res = await fetch('https://api.example.com/data');
            if (!res.ok) throw new Error('Network error');
            return res.json();
        },
        {
            retries: 3,
            delay: 100,
            backoff: 2,
            jitter: 0.5,
            shouldRetry: (err) => !err.message.includes('permanent')
        }
    )
);

if (err instanceof RetryError) {

    // handle the retry error
}

// Sync example
const [value, err] = await attempt(() =>
    retry(
        () => {
            if (Math.random() < 0.7) throw new Error('fail');
            return 42;
        },
        { retries: 5 }
    )
);
```

**When to use:**
Any operation that may fail transiently (network, database, etc). Use `shouldRetry` to avoid retrying on permanent errors.

> ⚠️ You probably want to define `shouldRetry` to prevent retrying on unrecoverable errors (e.g. 401s, 403s, 404s, etc).
> ⚠️ Long backoff + many retries = long stall with no user feedback.

### `makeRetryable(fn, options)`

**What it does:**
Wraps a function with retry behavior, returning a new function with embedded retry logic. Alternative to calling `retry()` directly inside `attempt()`.

**Options:**

See `retry()` for options.

```ts
const retryingFetch = makeRetryable(
    async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fail');
        return res.json();
    },
    { retries: 3, delay: 100 }
);

const [data, error] = await attempt(
    () => retryingFetch('https://api.example.com/data')
);
```

**When to use:**

When you want to create a reusable retriable function ahead of time, especially when the same function needs to be called multiple times with different arguments.

### `rateLimit(fn, options)`

**What it does:**

Ensures a function isn't called more than N times per time window. Throws a `RateLimitError` if the limit is exceeded.

**Options:**

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `maxCalls` | `number` | ✅ | Maximum number of calls allowed per time window. | - |
| `windowMs` | `number` | ✅ | Time window in milliseconds. | - |
| `throws` | `boolean` | ❌ | Whether to throw an error or return undefined when limit is hit. | `true` |
| `onLimitReached` | `function` | ❌ | Callback function to be called when the limit is reached. | - |

**Example:**

```ts
const limitedFetch = rateLimit(
    (url: string) => fetch(url),
    {
        maxCalls: 10,
        windowMs: 1000, // 10 calls per second
        throws: true,   // Throw error or return undefined when limit hit
        onLimitReached: (error, nextAvailable) => {

            console.log(`Rate limit hit, try after ${nextAvailable}`);
        }
    }
);

// Will throw RateLimitError if limit is exceeded
const responses = await Promise.all(
    urls.map(url => limitedFetch(url))
);
```

**When to use:**

API clients respecting rate limits, preventing spam, throttling expensive operations.

> ⚠️ It's in-memory — doesn't persist across server instances.
> ⚠️ No async storage adapter support (e.g. Redis).

### `circuitBreaker(fn, options)` / `circuitBreakerSync(fn, options)`

**What it does:**

Stops calling a failing service until it recovers. Fails fast when the circuit is "open". Throws a `CircuitBreakerError` if the circuit is open. The sync version immediately throws on failure if circuit is open.

**Options:**

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `maxFailures` | `number` | ❌ | Maximum number of consecutive failures before tripping the circuit. | `3` |
| `halfOpenMaxAttempts` | `number` | ❌ | Maximum number of test attempts allowed in half-open state. | `1` |
| `resetAfter` | `number` | ❌ | Time in milliseconds to wait before testing recovery. | `1000` |
| `onTripped` | `function` | ❌ | Callback invoked when circuit breaker trips (opens). | - |
| `onError` | `function` | ❌ | Callback invoked when the protected function throws an error. | - |
| `onReset` | `function` | ❌ | Callback invoked when circuit breaker resets (closes). | - |
| `onHalfOpen` | `function` | ❌ | Callback invoked when circuit breaker enters half-open state. | - |
| `shouldTripOnError` | `function` | ❌ | Predicate function to determine if an error should trip the circuit. | - |

```ts
const guarded = circuitBreaker(
    () => riskyOperation(),
    {
        maxFailures: 3,
        halfOpenMaxAttempts: 1,
        resetAfter: 1000,
        onTripped: (error, store) => {

            console.log(`Circuit breaker tripped: ${error.message}`);
        },
        onError: (error, args) => {

            console.log(`Error in guarded operation: ${error.message}`);
        },
        onReset: () => {

            console.log('Circuit breaker reset');
        },
        onHalfOpen: (store) => {

            console.log('Circuit breaker entering half-open state');
        },
        shouldTripOnError: (error) => {

            return error.message.includes('permanent');
        }
    }
);

const [result, err] = await attempt(() => guarded());

if (err instanceof CircuitBreakerError) {

    // Circuit is open, use fallback
    return cachedValue;
}

throw err; // Re-throw unexpected errors
```

**When to use:**

Microservice communication, external dependencies, preventing cascade failures. Use the async version for async operations, the sync version for sync operations.

> ⚠️ You probably want to trigger the circuit breaker only on certain errors, such as 4xx errors. You can use the `shouldTripOnError` option to do this.

### `composeFlow(func, options)`

**What it does:**

Composes a map of flow control functions into a single function allowing you to apply multiple controls to a function.

**Options:**

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `rateLimit` | `RateLimitOptions` | ❌ | Rate limit options. | - |
| `circuitBreaker` | `CircuitBreakerOptions` | ❌ | Circuit breaker options. | - |
| `retry` | `RetryOptions` | ❌ | Retry options. | - |
| `withTimeout` | `WithTimeoutOptions` | ❌ | Timeout options. | - |

```ts
const _getAllUsers = () => fetch('/api/users');

const getAllUsers = composeFlow(_getAllUsers, {
    circuitBreaker: {
        maxFailures: 3,
        halfOpenMaxAttempts: 1,
        resetAfter: 1000,
    },
    rateLimit: {
        maxCalls: 10,
        windowMs: 1000,
    },
    retry: {
        retries: 3,
        delay: 100,
        backoff: 2,
        jitter: 0.5,
        shouldRetry: (err) => (
            err instanceof RetryError === false &&
            err instanceof CircuitBreakerError === false &&
            err instanceof RateLimitError === false &&
            err.status > 500
        ),
    },
    withTimeout: {
        timeout: 1000,
    },
});

const users = await getAllUsers();
```

**When to use:**

When you need to apply more than one flow control function to a function.

> ⚠️ The order of the flow control functions matters. They are applied in the order they are passed into the options object.

### `batch(fn, options)`

**What it does:**

Performs a function call against an array of arguments, and returns a promise that resolves to an array of results.

**Options:**

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `items` | `Array` | ✅ | The array of arguments to pass to the function. | - |
| `concurrency` | `number` | ❌ | The maximum number of concurrent function calls. | `1` |
| `failureMode` | `'abort' \| 'continue'` | ❌ | Whether to abort the batch on the first error, or continue processing the remaining items. | `'abort'` |
| `onError` | `function` | ❌ | Callback invoked when an error occurs during function execution. | - |
| `onStart` | `function` | ❌ | Callback invoked when the batch starts. | - |
| `onEnd` | `function` | ❌ | Callback invoked when the batch ends. | - |
| `onChunkStart` | `function` | ❌ | Callback invoked when a chunk starts. | - |
| `onChunkEnd` | `function` | ❌ | Callback invoked when a chunk ends. | - |

**Example:**

```ts
const items = [1, 2, 3, 4, 5];
const results = await batch(
    async (item) => {
        return item * 2;
    },
    { items, concurrency: 2 }
);

console.log(results); // [2, 4, 6, 8, 10]
```

**When to use:**

When you need to call a function against a large array of items, and you want to control the concurrency of the function calls. Useful for batching API calls, perform ETL, etc.

> ⚠️ The batches are not guaranteed to be called in order since they are processed using `Promise.all` under the hood.
> ⚠️ Failure mode `'abort'` makes the entire batch all-or-nothing, so if your batch-work changes the state of the world, you should use `'continue'` or handle the reversals yourself.


### `memoize(fn, options)` / `memoizeSync(fn, options)`

**What it does:**
Caches function results based on arguments. Supports TTL, LRU eviction, and custom cache keys.

**Options:**

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `maxSize` | `number` | ❌ | Maximum number of entries to keep in cache. | `100` |
| `ttl` | `number` | ❌ | Time to live for cached entries in milliseconds. | `60000` |
| `onError` | `function` | ❌ | Callback invoked when an error occurs during key generation or function execution. | - |
| `generateKey` | `function` | ❌ | Function to generate cache key from arguments. | - |
| `useWeakRef` | `boolean` | ❌ | Whether to use WeakRef for large objects to prevent memory leaks. | `false` |
| `cleanupInterval` | `number` | ❌ | Interval in milliseconds for background cleanup of expired entries. | `60000` |

**Example:**

```ts
const expensiveCalc = memoize(
    async (userId: string) => {

        const data = await fetchUserData(userId);
        return processData(data);
    },
    {
        maxSize: 100,        // Keep 100 most recent
        ttl: 60000,          // Expire after 1 minute
        generateKey: (userId) => `user:${userId}`,
        onCacheHit: (key) => metrics.increment('cache.hit'),
        onCacheMiss: (key) => metrics.increment('cache.miss')
    }
);

// Access the memoized function's cache
expensiveCalc.cache.stats();
expensiveCalc.cache.clear();
expensiveCalc.cache.delete('user:123');
expensiveCalc.cache.has('user:123');
expensiveCalc.cache.size;
expensiveCalc.cache.keys();
expensiveCalc.cache.entries();
```

**When to use:**
Expensive computations, API response caching, reducing redundant database queries.

> ⚠️ Be aware that `memoizeSync` will cache Promises if you give it an async function, not resolved values.
> ⚠️ The internal `generateKey` function might be verbose. You might have a more efficient one when you know the shape of the arguments.
> ⚠️ Internal `generateKey` will also sort keys of objects, maps, and sets. This allows for better caching of objects that have the exact same keys, but in a different order. EG: `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` will be considered the same.
> ⚠️ Does not persist across server instances.

### `clone(value)`

**What it does:**

Creates a deep copy of any value, including ES6+ types like Map, Set, typed arrays.

```ts
const original = {
    users: new Map([['john', { age: 30 }]]),
    tags: new Set(['admin', 'user']),
    created: new Date(),
    pattern: /test/gi,
    data: new Uint8Array([1, 2, 3])
};

const cloned = clone(original);
cloned.users.get('john').age = 31; // Doesn't affect original
```

**When to use:**
State management, creating test fixtures, anywhere you need true immutability.

> ⚠️ `clone` will not clone custom class instances. You need to register a handler for them via `addHandlerFor` if you need a new instance of your class.
> ⚠️ `clone` will not clone functions.
> ⚠️ Performance degrades with large graphs. Complexity of O(n). You should be OK in 90% of cases.

### `equals(a, b)`

**What it does:**
Compares any two values for deep equality, including circular references.

```ts
const obj1 = { data: new Set([1, 2, 3]), meta: { id: 'abc' } };
const obj2 = { data: new Set([1, 2, 3]), meta: { id: 'abc' } };

equals(obj1, obj2); // true

// Handles circular references
const circular = { name: 'loop' };
circular.self = circular;
const circular2 = { name: 'loop' };
circular2.self = circular2;

equals(circular, circular2); // true
```

**When to use:**
Testing, memoization keys, change detection in state management.

> ⚠️ Performance degrades with large graphs. Complexity of O(n). You should be OK in 90% of cases.

### `merge(target, source, options)`

**What it does:**
Merges two objects, arrays, maps, or sets.

**Options:**

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `mergeArrays` | `boolean` | ❌ | Whether to merge arrays. | `true` |
| `mergeSets` | `boolean` | ❌ | Whether to merge sets. | `true` |

**Example:**

```ts
const target = {
    a: 1,
    b: 2,
    c: 3,
    d: new Map([['a', 1], ['b', 2]])
};

const source = {
    b: 4,
    d: new Map([['b', 8], ['a', 9]]),
    e: new Set([1, 2, 3])
};

const merged = merge(target, source);

console.log(merged); // { a: 1, b: 4, c: 3, d: Map { 'a' => 9, 'b' => 8 }, e: Set { 1, 2, 3 } }
```

**When to use:**
When you need to merge two objects, arrays, maps, or sets.

> ⚠️ If you set `mergeArrays` or `mergeSets` to `false`, the target will be overwritten with the source.
> ⚠️ You can set `mergeDefaults` to a default configuration object for merge operations.
>
> ```ts
> import { mergeDefaults } from '@logosdx/utils';
>
> mergeDefaults.mergeArrays = false;
> mergeDefaults.mergeSets = false;
> ```
>
> ⚠️ If you need a special way to merge custom classes, you can register a handler for them via `addHandlerFor`.
> ⚠️ Performance degrades with large graphs. Complexity of O(n). You should be OK in 90% of cases.

### `addHandlerFor(fn, constructor, handler)`

**Options:**

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `fn` | `'clone' \| 'equals' \| 'merge'` | ✅ | The function to register the handler for. | - |
| `constructor` | `Function` | ✅ | The constructor of the class to register the handler for. | - |
| `handler` | `function` | ✅ | The handler function to register. | - |

**What it does:**
Registers a custom handler for clone, equals, or merge for a user-defined class or type.

```ts
class Point { constructor(public x: number, public y: number) {} }
addHandlerFor('clone', Point, (original) => new Point(original.x, original.y));
addHandlerFor('equals', Point, (a, b) => a.x === b.x && a.y === b.y);
addHandlerFor('merge', Point, (target, source) => new Point(source.x, source.y));
```

**When to use:**
When you need deep operations to support custom classes or types.

### Miscellaneous

Miscellaneous functions and utilities that you might also find useful. For the full list of what this package provides, [see the typedocs](https://typedoc.logosdx.dev/modules/_logosdx_utils.html).

```ts
import {
    assert,
    assertOptional,
    reach,
    PathNames,
    PathValue,
    wait,
    Deferred,
    noop,
    isNonIterable,
    isPrimitive,
    isNode,
    isBrowser
}

// Assertions
assert(isPrimitive(value), 'Value is required');
assertOptional(value, isNonIterable(value), 'Value is must be non-iterable');

const runsOnNodeOnly = () => {

    assert(isNode(), 'This function only runs on Node.js');
}

// Data structures
const someState = {
    user: { name: 'John', age: 30 },
    items: [1, 2, 3],
    inventory: new Map([
        ['inv001', {
            name: 'Widget',
            quantity: 100
        }],
        ['inv002', {
            name: 'Gadget',
            quantity: 200
        }]
    ]),
    tags: new Set(['admin', 'user'])
}

const StateType = typeof someState;

// Get all possible dot-notation paths for an object type.
const pathNames: PathNames<StateType>[] = [
    'user.name',
    'items.0',
    'inventory.inv001.name',
    'inventory.inv002.quantity',
    'tags.0',
    'tags.1'
];

// Get the value type at a specific string path.
const pathValue: PathValue<StateType, 'user.name'> = 'John';

// Handles maps, sets, and arrays
const pathValue: PathValue<StateType, 'inventory.inv001.name'> = 'Widget';

// Reach into a data structure with type-safe values.
const inv001Name = reach(someState, 'inventory.inv001.name');
const firstTag = reach(someState, 'tags.0');
const secondItem = reach(someState, 'items.1');

// Ignore callbacks
fetch('/api/users').catch(noop);

// Wait for time
const user = await wait(1000).then(() => fetch('/api/user/1'));

// Resolve a promise later
const deferred = new Deferred(); // Or `Promise.withResolvers()` ... This is the polyfill.

wait(1000).then(() => deferred.resolve(1));
```


## Compatibility

✅ Node 14+
✅ Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
✅ Deno
✅ Bun
⚠️ Requires ES2015+ (Map, Set, Symbol, etc.)

## FAQ

**Q: How does this differ from p-retry, p-limit, etc?**
A: We provide a cohesive API designed to work together. Our utilities share consistent options, error types, and composition patterns. Plus we handle ES6+ data structures that older libraries ignore.

**Q: Is this production-ready?**
A: Yes. These patterns come from real production systems handling hundreds of thousands of requests. The error handling approach has remedied countless 3am debugging sessions, the async utilities have prevented microservices outages, and guarded against cascading failures. It's battle-tested.

**Q: What about bundle size?**
A: Everything is tree-shakeable. Import only what you need. Fully minified and gzipped, it's ~7kb.

## Contributing

Issues or suggestions? [Open a GitHub issue](https://github.com/logos-dx/monorepo).
