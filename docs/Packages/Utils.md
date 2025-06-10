---
permalink: '/packages/utils'
aliases: ["@logosdx/utils", "Utils", "utilities"]
---

# @logosdx/utils

**Modern JavaScript utilities for the real world**

Building applications today means dealing with complex data structures, unreliable networks, and performance constraints. The `@logosdx/utils` package provides battle-tested utilities that solve common problems you'll encounter when building production applications.

This package is designed to work on all platforms, including browsers, React Native, and Cloudflare Workers.

> 📚 **Detailed API Reference**: For complete function signatures, parameters, and technical details, visit [typedoc.logosdx.dev](https://typedoc.logosdx.dev)

```bash
npm install @logosdx/utils
yarn add @logosdx/utils
pnpm add @logosdx/utils
```

## Why This Package Exists

Modern JavaScript has evolved beyond simple objects and arrays. We now work with `Map`, `Set`, `WeakMap`, and other complex data structures. Yet most utility libraries were built for a simpler time and don't handle these modern types properly.

Consider this common scenario: You're building a real-time dashboard that receives updates from an API. The data comes as arrays of objects with IDs, but you need to efficiently add, remove, and update items. Arrays are slow for lookups and removals. Objects lose helpful methods like `.size`. Maps and Sets solve these problems, but existing utilities can't clone, compare, or merge them properly.

Let's consider a backend scenario: You're building an ETL process that needs to process thousands of records from a third-party API. The data needs to be transformed and stored in your database. During this process, you might encounter disk failures, database connection drops, or hit API rate limits. Traditional error handling with try-catch blocks would make this code hard to read and maintain, especially when you need to handle retries, logging, and cleanup.

This package bridges that gap.

## Core Philosophy

### 1. **Go-Style Error Handling**

Instead of try-catch blocks that are hard to read, nest horizontally, and always force you to handle errors:

```typescript

// ❌ Creates a mess of variables to flow control your processing
let theProcessError: Error | undefined;

// ❌ Annoying to read and hard to understand
try {
    const result = await riskyOperation();

	// ❌ You might have nested try-catch blocks
    try {
        await processResult(result);
    }
	catch (error) {
        // ❌ Often forgotten or poorly handled
		theProcessError = error;
    }
} catch (error) {
    // ❌ Or you might want to completely ignore the error
}

if (theProcessError) {
    handleError(theProcessError);
}
```

We use go-style tuple returns that make error handling more elegant and keep your code cleaner:

```typescript

// ✅ Vertical, optional error handling
const [riskyResult, riskyError] = await attempt(() => riskyOperation());

if (riskyError) {

	handleError(riskyError); // ✅ Error handling
    return;
}

// You might not care about the error, but you don't want to crash your app
const [processedResult] = await attempt(() => processResult(riskyResult));

// Or maybe you only care about the error
const [, processedError] = await attempt(() => processResult(riskyResult));

if (processedError) {
    handleError(processedError);
    return;
}

// Or maybe you don't care about either
await attempt(() => processResult(riskyResult));
```

### 2. **Modern Data Structure Support**

Most utility libraries were built when JavaScript only had objects and arrays. Today's apps use Maps, Sets, and other modern types, but existing tools break:

```typescript
// ❌ Traditional utilities fail with modern data structures
const userPermissions = new Map([
    ['user-1', new Set(['read', 'write'])],
    ['user-2', new Set(['read'])]
]);

// Lodash and others can't handle this properly
const broken = _.cloneDeep(userPermissions); // Returns {}
const stillBroken = JSON.parse(JSON.stringify(userPermissions)); // Returns {}

// ❌ You're forced to convert everything to objects/arrays
const uglyWorkaround = {
    'user-1': ['read', 'write'], // Lost Set benefits
    'user-2': ['read']
};
```

Our utilities understand modern JavaScript:

```typescript
// ✅ Works seamlessly with any data structure
import { deepClone, deepEqual, deepMerge } from '@logosdx/utils';

const cloned = deepClone(userPermissions); // Perfect Map<string, Set<string>>
const hasChanged = !deepEqual(userPermissions, cloned); // Proper deep comparison
const merged = deepMerge(userPermissions, newPermissions); // Intelligent merging

// ✅ Keep the performance benefits of modern data structures
userPermissions.get('user-1')?.has('write'); // O(1) lookup
userPermissions.size; // Instant count
```

### 3. **Production-Ready Resilience**

Real applications and serious backend systems deal with network failures, overloaded servers, and unpredictable third-party APIs. Most developers end up writing the same error handling patterns over and over:

```typescript
// ❌ Fragile code that breaks in production
async function fetchUserData(id: string) {
    const response = await fetch(`/api/users/${id}`); // What if this times out?
    return response.json(); // What if the server is down?
}

// ❌ Manual retry logic that's hard to get right
async function fetchWithRetry(id: string, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fetchUserData(id);
        } catch (error) {
            if (i === attempts - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * i)); // Linear backoff?
        }
    }
}

// ❌ No protection against cascading failures
// If the API is down, every request will still try and fail
```

We provide battle-tested resilience patterns:

```typescript
// ✅ Comprehensive protection with minimal code
import { attempt, retry, circuitBreaker, withTimeout } from '@logosdx/utils';

const resilientFetch = circuitBreaker(
    retry(
        withTimeout(fetchUserData, { timeout: 5000 }), // Timeout protection
        { retries: 3, delay: 1000, backoff: 2 } // Exponential backoff
    ),
    { maxFailures: 5, resetAfter: 30000 } // Circuit breaker
);

// ✅ Graceful error handling
const [userData, error] = await attempt(() => resilientFetch('user-123'));
if (error) {
    // Fallback to cache, show friendly message, etc.
    return getCachedUserData('user-123');
}
```

---

## Problem-Solving Utilities

### 🔄 **State Management & Data Manipulation**

#### The Problem: Complex State Updates

You're building a shopping cart. Items come from an API as an array, but you need to efficiently add, remove, and update quantities. Traditional approaches are either slow or lose useful functionality.

```typescript
import { deepClone, deepEqual, deepMerge } from '@logosdx/utils';

// Start with a Map for O(1) lookups
const cart = new Map([
    ['item-1', { id: 'item-1', name: 'Laptop', quantity: 1, price: 999 }],
    ['item-2', { id: 'item-2', name: 'Mouse', quantity: 2, price: 25 }]
]);

// Clone the entire cart state for undo functionality
const previousCart = deepClone(cart);

// Update an item
const updatedItem = { ...cart.get('item-1'), quantity: 2 };
cart.set('item-1', updatedItem);

// Check if anything actually changed (avoid unnecessary re-renders)
if (!deepEqual(cart, previousCart)) {
    updateUI(cart);
    saveToLocalStorage(cart);
}

// Merge in bulk updates from the server
const serverUpdates = new Map([
    ['item-1', { price: 899 }], // Price drop!
    ['item-3', { id: 'item-3', name: 'Keyboard', quantity: 1, price: 75 }]
]);

const mergedCart = deepMerge(cart, serverUpdates);
```



#### The Problem: API Data Transformation

Your API returns nested objects with arrays, but your UI needs a different structure. You need to transform without losing data or creating bugs.

```typescript
import { deepMerge, reach } from '@logosdx/utils';

// API response
const apiData = {
    user: {
        profile: { name: 'John', preferences: { theme: 'dark' } },
        permissions: ['read', 'write']
    },
    settings: {
        notifications: { email: true, push: false }
    }
};

// Your app's default configuration
const defaultConfig = {
    user: {
        profile: { avatar: '/default-avatar.png', preferences: { theme: 'light', language: 'en' } },
        permissions: [],
        isActive: true
    },
    settings: {
        notifications: { email: false, push: false, sms: false },
        privacy: { analytics: false }
    }
};

// Safely merge, preserving structure and defaults
const userConfig = deepMerge(defaultConfig, apiData);

// Safely access nested values without crashes
const theme = reach(userConfig, 'user.profile.preferences.theme'); // 'dark'
const language = reach(userConfig, 'user.profile.preferences.language'); // 'en'
const missing = reach(userConfig, 'user.profile.nonexistent.value'); // undefined (no crash)
```

### 🛡️ **Resilient Operations**

#### The Problem: Unreliable Network Calls

APIs fail, networks are unreliable, and servers get overloaded. Instead of building the same retry/timeout logic everywhere, compose resilient functions once:

```typescript
import { attempt, retry, circuitBreaker, withTimeout } from '@logosdx/utils';

// Build a resilient API client by composing utilities
const resilientFetch = circuitBreaker(
    retry(
        withTimeout(fetch, { timeout: 5000 }),
        { retries: 3, delay: 1000, backoff: 2 }
    ),
    {
        maxFailures: 5,
        resetAfter: 30000,
        shouldTripOnError: (error) => error.message.includes('HTTP 5')
    }
);

// Use it safely with explicit error handling
const [response, error] = await attempt(() =>
    resilientFetch('/api/users/123')
);

if (error) {
    return getCachedUserData('123'); // Graceful fallback
}

return response.json();
```

#### The Problem: Rate Limiting & Performance

Processing large datasets or making many API calls can overwhelm servers and hit rate limits. Control the flow:

```typescript
import { rateLimit, batch, throttle, debounce } from '@logosdx/utils';

// Rate-limited API calls (10 calls per second)
const rateLimitedFetch = rateLimit(fetch, { maxCalls: 10, windowMs: 1000 });

// Process 1000 users in controlled batches
const processUsers = async (userIds: string[]) => {

	// ✅ Will return a flat array of results, in the same order they were passed in
    return await batch(
		// ✅ The function that will handle a single item
		async (userId: string) => {

			const response = await rateLimitedFetch(`/api/users/${userId}`);
			return response.json();
		},
		{
			// ✅ The array of items to process
			items: userIds.map(id => [id]),
			concurrency: 5,

			// ✅ What to do if a single item fails
			failureMode: 'continue'
		}
	);
};

// Debounced search + throttled scroll
const debouncedSearch = debounce(searchAPI, 300); // Wait for user to stop typing
const throttledScroll = throttle(updateScrollPosition, 16); // ~60fps

// Usage
searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
document.addEventListener('scroll', throttledScroll);
```

### 🧠 **Performance Optimization**

#### The Problem: Expensive Computations

Functions that do heavy calculations or API calls get called repeatedly with the same inputs. Simple caching breaks with complex arguments:

```typescript
import { memoize, memoizeSync } from '@logosdx/utils';

// Expensive calculation that takes 500ms
const calculateMetrics = (data: DataPoint[], filters: FilterConfig) => {
    return data
        .filter(point => matchesFilters(point, filters))
        .reduce((metrics, point) => computeMetrics(metrics, point), {});
};

// Intelligent caching that handles complex arguments
const memoizedCalculation = memoizeSync(calculateMetrics, {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100,
    useWeakRef: true, // Prevent memory leaks
    onError: (error, args) => console.error('Calculation failed:', error)
});

// First call: 500ms, subsequent calls: ~0ms
const metrics = memoizedCalculation(largeDataset, complexFilters);

// Monitor cache performance
console.log(memoizedCalculation.cache.stats());
// { hits: 1, misses: 1, hitRate: 0.5, size: 1, evictions: 0 }
```

### 🔧 **Development & Debugging**

#### The Problem: Validation & Environment Detection

Assertions and environment detection are unreliable out of the box. Get better validation and reliable environment checks:

```typescript
import { assert, assertObject, isBrowser, isReactNative, isCloudflare } from '@logosdx/utils';

// Simple assertions with custom error types
assert(user.age >= 18, 'User must be 18 or older', ValidationError);

// Complex object validation with path-based checks
assertObject(profile, {
    'name': (val) => [typeof val === 'string' && val.length > 0, 'Name is required'],
    'preferences.theme': (val) => [['light', 'dark'].includes(val), 'Invalid theme'],
    'permissions': (val) => [Array.isArray(val) && val.length > 0, 'Need permissions']
});

// Reliable environment detection
if (isBrowser()) {
    const theme = localStorage.getItem('theme');
} else if (isReactNative()) {
    const theme = await AsyncStorage.getItem('theme');
} else if (isCloudflare()) {
    const theme = await env.THEME_KV.get('user-theme');
}
```

> 💡 **Note**: These assertion helpers are for simple use cases. When you need something more robust, use a library like [Zod](https://zod.dev/) or [Joi](https://joi.dev/).
>
> In the case of this library, I use them for simple validation blocks to assert proper utility usage and configurations.

---

## Advanced Patterns

### Custom Data Type Handlers

Sometimes you work with custom classes or data types that need special handling for cloning, comparison, or merging.

```typescript
import { addHandlerFor, deepClone, deepEqual, deepMerge } from '@logosdx/utils';

class Money {
    constructor(public amount: number, public currency: string) {}

    toString() {
        return `${this.amount} ${this.currency}`;
    }
}

// Teach the utilities how to handle Money objects
addHandlerFor('deepClone', Money, (money) =>
    new Money(money.amount, money.currency)
);

addHandlerFor('deepEqual', Money, (a, b) =>
    a.amount === b.amount && a.currency === b.currency
);

addHandlerFor('deepMerge', Money, (target, source) =>
    source.currency === target.currency
        ? new Money(target.amount + source.amount, target.currency)
        : source // Different currencies, use source
);

// Now they work seamlessly
const price1 = new Money(100, 'USD');
const price2 = deepClone(price1); // Creates new Money instance
const isSame = deepEqual(price1, price2); // true
const total = deepMerge(price1, new Money(50, 'USD')); // Money(150, 'USD')
```

### Building Resilient Data Pipelines

Combine multiple utilities to create robust data processing pipelines:

```typescript
import {
    attempt, retry, circuitBreaker, rateLimit, batch,
    memoize, deepEqual, deepMerge
} from '@logosdx/utils';

// Create a resilient data processing pipeline
class DataPipeline {
    private fetchData = circuitBreaker(
        retry(
            rateLimit(
                memoize(async (source: string) => {
                    const response = await fetch(source);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                }, { ttl: 60000, maxSize: 100 }),
                { maxCalls: 10, windowMs: 1000 }
            ),
            { retries: 3, delay: 1000 }
        ),
        { maxFailures: 5, resetAfter: 30000 }
    );

    private async processInBatches(items: DataItem[]) {
        return await batch(async (item: DataItem) => {
            return this.processItem(item);
        }, {
            items: items.map(item => [item]), // Convert to argument arrays
            concurrency: 10,
            failureMode: 'continue'
        });
    }

    async processDataSources(sources: string[]) {
        const results = [];

        for (const source of sources) {
            const [data, error] = await attempt(() => this.fetchData(source));

            if (error) {
                console.warn(`Failed to fetch ${source}:`, error.message);
                continue;
            }

            // Process items in controlled batches
            if (data.items && data.items.length > 0) {
                await this.processInBatches(data.items);
            }

            results.push(data);
        }

        return results;
    }
}
```

---

## Migration Guide

### From Lodash

```typescript
// Lodash
import { cloneDeep, isEqual, merge } from 'lodash';

// @logosdx/utils - with modern data structure support
import { deepClone, deepEqual, deepMerge } from '@logosdx/utils';

// Works with Maps, Sets, and other modern types
const map = new Map([['key', new Set([1, 2, 3])]]);
const cloned = deepClone(map); // Lodash can't do this properly
```

### From Ramda

```typescript
// Ramda
import { memoizeWith, retry } from 'ramda';

// @logosdx/utils - with better error handling and modern features
import { memoize, retry, attempt } from '@logosdx/utils';

const memoizedFn = memoize(expensiveFunction, {
    ttl: 60000,
    maxSize: 100,
    onError: (error) => console.error(error)
});

const [result, error] = await attempt(() => retry(riskyFunction, { retries: 3 }));
```

---

## Performance Considerations

### Memory Management

- Use `useWeakRef: true` in memoization for large objects
- Set appropriate `maxSize` limits on caches
- Circuit breakers prevent memory leaks from failed operations

### Async Operations

- `batch()` prevents overwhelming servers with concurrent requests
- `rateLimit()` ensures you stay within API limits
- `withTimeout()` prevents hanging operations

### Development vs Production

- Assertions can be stripped in production builds where tree-shaking is enabled
- Memoization TTL should be shorter in development to prevent stale data
- Circuit breaker thresholds might be more aggressive in production to prevent cascading failures

---

## TypeScript Support

Full TypeScript support with intelligent type inference:

```typescript
// Types are preserved through transformations
const typedMap = new Map<string, { id: string; value: number }>();
const cloned = deepClone(typedMap); // Type: Map<string, { id: string; value: number }>

// Path-based type safety
const config = { user: { profile: { name: 'John' } } };
const name = reach(config, 'user.profile.name'); // Type: string
const invalid = reach(config, 'user.invalid.path'); // Type: undefined
```

---

## Best Practices

1. **Always handle errors explicitly** with `attempt()` for async operations. It's verbose, but it's a good way to ensure you're handling errors properly.
2. **Take advantage of circuit breakers** for external service calls when you're dealing with unreliable services. They'll help you prevent cascading failures and keep your system resilient.
3. **Memoize expensive computations** but set appropriate TTL and size limits.
4. **Batch operations** when processing large datasets.
5. **Validate inputs** with assertions in development.
6. **Choose the right data structure** - Maps for lookups, Sets for uniqueness, WeakMaps for caching, etc.
7. **Handle modern data types** - don't assume everything is an object or array


---

**Ready to build more resilient applications?** Install `@logosdx/utils` and start using these patterns in your projects today.

For complete API documentation, visit [typedoc.logosdx.dev](https://typedoc.logosdx.dev).
