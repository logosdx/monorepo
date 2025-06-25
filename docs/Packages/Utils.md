---
permalink: '/packages/utils'
aliases: ["@logosdx/utils", "Utils", "utilities"]
---

> Let there be structure. This is your runtime survival kit for real-world JavaScript.

A precision toolkit for apps that hit production and start bleeding:

* Transient API failures?
* Deep state trees that mutate unexpectedly?
* Flaky async logic no one wants to debug?

`@logosdx/utils` is a hardened set of utilities designed to replace the broken standard library. Built for infrastructure engineers, backend workers, frontend state logic, and everything in between.

Works in: Node, browsers, Cloudflare Workers, React Native.

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

With jsdeliver:

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/utils@latest/dist/browser/bundle.js"></script>
```

```html
<script>
	const { attempt, retry, clone, equals, assert, isPlainObject } = LogosDx.Utils;
</script>
```

## Why This Exists

JavaScript has no built-in retry, no proper deep equality, no safe clone, and no consistent runtime type safety. Other libraries give you pieces — Lodash, Ramda, p-retry — but nothing that actually **holds up across domains**.

This package solves that:

* Resilience primitives: `retry`, `attempt`, `rateLimit`, `circuitBreaker`, `batch`, `withTimeout`, `memoize`
* State-safe tools: `clone`, `equals`, `merge`
* Runtime guards: `assert`, `assertObject`, `isDefined`, `isPlainObject`
* Composable wrappers: `composeFlow`
* Escape hatches: `addHandlerFor`, `mergeDefaults`

Every function here is designed to be:

* **Composable** (wrappable and layerable)
* **Safe** (edge-case aware)
* **Predictable** (no side effects, clear contracts)

## Quick Start

```ts
import { attempt, retry, clone, equals, assert, isPlainObject } from '@logosdx/utils';

const fetchUser = async () => {

    // Load data from flaky API
    const [user, err] = await attempt(() =>
      retry(() => fetch('/api/user/123').then(res => res.json()), {
        retries: 3,
        delay: 100,
        shouldRetry: (e) => !e.message.includes('Unauthorized'),
      })
    );

    if (err) throw err;

    return user;
}

const updateUserName = async (user: User, name: string) => {

    // Validate the input
    assert(isPlainObject(user), 'User must be an object');
    assert(user.id, 'User must have an id');
    assert(user.name, 'User must have a name');
    assert(typeof name === 'string', 'Name must be a string');

    // Clone for local editing
    const draft = clone(user);
    draft.name = name;

    // Compare before saving
    if (!equals(user, draft)) {
        await fetch('/api/user/123', { method: 'PUT', body: JSON.stringify(draft) });
    }
}
```

## Common Use Cases

### Composing Resilience

The real power is composability. Use `composeFlow` to apply retry, rate limit, timeout, and circuit breaker behavior in one layer.

```ts
const getUser = composeFlow(() => fetch('/api/user'), {
    retry: { retries: 3, delay: 100 },
    rateLimit: { maxCalls: 10, windowMs: 1000 },
    circuitBreaker: { maxFailures: 2, resetAfter: 5000 },
    withTimeout: { timeout: 500 },
});

const [user, err] = await attempt(() => getUser());
```

This is how you build **fault-tolerant systems** that degrade gracefully.

### Customizing Behavior

For custom data structures, you can register your own clone/equality/merge logic:

```ts
class MyId {
  constructor(readonly value: string) {}
}

addHandlerFor('clone', MyId, (x) => new MyId(x.value));
addHandlerFor('equals', MyId, (a, b) => a.value === b.value);
addHandlerFor('merge', MyId, (a, b) => b);
```

You can also set global defaults:

```ts
import { mergeDefaults } from '@logosdx/utils';
mergeDefaults.mergeArrays = false;
mergeDefaults.mergeSets = false;
```

### Flaky APIs, Retry Logic, Resilience

| Use case                        | Solution                                              |
| ------------------------------- | ----------------------------------------------------- |
| Replace nested try/catch        | `attempt(fn)` / `attemptSync(fn)`                     |
| Debounce function calls         | `debounce(fn, opts)`                                  |
| Throttle function calls         | `throttle(fn, opts)`                                  |
| Retry transient failures        | `retry(fn, opts)`                                     |
| Wrap functions with retry logic | `makeRetryable(fn, opts)`                             |
| Prevent overload                | `rateLimit(fn, opts)`                                 |
| Circuit breaker fallback        | `circuitBreaker(fn, opts)` / `circuitBreakerSync(fn)` |
| Enforce timeouts                | `withTimeout(fn, opts)`                               |
| Run batched async work          | `batch(fn, opts)`                                     |
| Cache stable outputs            | `memoize(fn, opts)` / `memoizeSync(fn)`               |
| Wrap all of the above           | `composeFlow(fn, opts)`                               |

### Deep State, Immutable Ops

| Use case                             | Solution                           |
| ------------------------------------ | ---------------------------------- |
| Clone complex values (Map, Set, etc) | `clone(value)`                     |
| Compare deeply with circular refs    | `equals(a, b)`                     |
| Merge config/state safely            | `merge(a, b)`                      |
| Customize merge/clone                | `addHandlerFor(fn, ctor, handler)` |

### Runtime Type Guards

| Use case                      | Solution                                                  |
| ----------------------------- | --------------------------------------------------------- |
| Validate function arguments   | `assert`, `assertObject`, `assertOptional`                |
| Check type at runtime         | `isDefined`, `isPlainObject`, `isFunction`, `isPrimitive` |
| Validate data structure shape | `allKeysValid`, `allItemsValid`, `hasSameConstructor`     |
| Traverse safely               | `reach(obj, path)`, `PathValue<T, P>`, `PathNames<T>`     |

### Meta Utilities

| Use case                 | Solution                                          |
| ------------------------ | ------------------------------------------------- |
| Delay execution          | `wait(ms)`                                        |
| Define hidden properties | `definePrivateProps()` / `definePrivateGetters()` |
| Ensure noop fallback     | `noop()`                                          |
| Environment detection    | `isBrowser()`, `isReactNative()`, `isCloudflare()`, `isNode()` |


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

> ⚠️ Always define shouldRetry. Blindly retrying on 401s or 404s is wasteful and delays the user.
> ⚠️ Long backoff with many retries means long waits. If the user gets no feedback during this, that's your design flaw.

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

Ensures a function isn't called more than N times per time window. Throws a `RateLimitError` if the limit is exceeded, or waits for the next time token if `throws` is false.

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

> ⚠️ Always define `shouldTripOnError` since not all errors are due to the service being down.

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

> ⚠️ The order of the flow control functions matters. `retry` before `timeout` behaves differently than the reverse. This is intentional.

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
> ⚠️ If you know your argument shape, use a custom `generateKey`. It's faster and less error-prone than deep serialization.
> ⚠️ The default key generator canonicalizes key order — so `{ a: 1, b: 2 }` is the same as `{ b: 2, a: 1 }`.
> ⚠️ All caching is in-memory. No persistence across server instances.

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

> ⚠️ Custom class instances aren't cloned by default. Register a handler for them via `addHandlerFor` if you need a new instance of your class.
> ⚠️ Functions aren't cloned. They're not serializable.
> ⚠️ This walks your entire value graph. It's O(n), like every real deep clone.

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

> ⚠️ This walks your entire value graph. It's O(n), like every real deep equals.

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
> ⚠️ Override `mergeDefaults` to your own default configuration for consistency.
>
> ```ts
> import { mergeDefaults } from '@logosdx/utils';
>
> mergeDefaults.mergeArrays = false;
> mergeDefaults.mergeSets = false;
> ```
>
> ⚠️ If you need a special way to merge custom classes, register a handler for them via `addHandlerFor`.
> ⚠️ This walks your entire value graph. It's O(n), like every real deep merge.

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



## Error Taxonomy

All control flow utilities return **typed errors** so you can react programmatically:

* `AssertError` — thrown when an assertion fails
* `CircuitBreakerError` — thrown when breaker is open
* `RateLimitError` — thrown when rate limit is exceeded
* `RetryError` — thrown when all retry attempts fail
* `ThrottleError` — thrown when a throttle operation fails
* `TimeoutError` — thrown when a timeout occurs

You should **check error type explicitly**:

```ts
// These helpers are all exported by the package. They are type-safe and type-assert against the error class.
if (isAssertError(err)) handleAssertFailure();
if (isRetryError(err)) handleRetryFailure();
if (isCircuitBreakerError(err)) handleCircuitBreakerFailure();
if (isRateLimitError(err)) handleRateLimitFailure();
if (isThrottleError(err)) handleThrottleFailure();
if (isTimeoutError(err)) handleTimeoutFailure();
```

Don't blanket-catch unless you're logging and rethrowing.

## Compatibility

✅ Node 14+
✅ Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
✅ Deno
✅ Bun
⚠️ Requires ES2015+ (Map, Set, Symbol, etc.)

## FAQ

**Q: How big is this thing?**
A: Tree-shakeable. Fully minified + gzipped, it's ~7kb. Use only what you import. But if you need utility, you shouldn't be too worried about bundle size.

**Q: How is this different from p-retry, p-limit, or p-whatever?**
A: Those are single-purpose tools. @logosdx/utils is a composable system. Our primitives — retry, timeout, memoize, circuit breaker, etc. — share a similar options shape, a similar error taxonomy, and were designed to be layered. Plus: we support Maps, Sets, circular refs, and modern JS out of the box.

**Q: Is this production-ready?**
A: These patterns are extracted from real systems running at scale. They've prevented outages, eliminated race conditions, and debugged 3am alerts so you don't have to. If it's in here, it's been battle-tested in live environments — not just unit tests.

**Q: Why not just use Lodash or Ramda?**
A: Because they don't handle retries, timeouts, memoization, deep clone, and modern JavaScript types like Map/Set/WeakMap. Lodash is great for array transforms. Ramda is FP academic hell that wasn't built for async javascript. This is not a Lodash replacement — it's the runtime toolkit Lodash never was. Also: Ramda hasn't been updated in years.

**Q: What about Zod / Joi / io-ts / schema validation?**
A: This isn't that. Use this for function-level validation and runtime guards — especially when schema libraries are overkill. These are fast, surgical checks, perfect for validating options, arguments, and internal state. Not for API contracts.

## Contributing

Issues or suggestions? [Open a GitHub issue](https://github.com/logos-dx/monorepo).
