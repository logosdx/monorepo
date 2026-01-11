---
title: Hooks
description: A lightweight, type-safe hook system for extending function behavior.
---

# Hooks

Functions do one thing well — until you need to add logging, validation, caching, or metrics. `@logosdx/hooks` lets you extend function behavior without modifying the original code. Wrap any function, add before/after/error extensions, modify arguments, change results, or abort execution entirely. Every extension is type-safe, every hook is trackable, and cleanup is automatic. It's aspect-oriented programming that actually makes sense.

[[toc]]

## Installation


::: code-group

```bash [npm]
npm install @logosdx/hooks
```

```bash [yarn]
yarn add @logosdx/hooks
```

```bash [pnpm]
pnpm add @logosdx/hooks
```

:::


**CDN:**

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/hooks@latest/dist/browser.min.js"></script>
<script>
    const { HookEngine } = LogosDx.Hooks;
</script>
```

## Quick Start

```typescript
import { HookEngine } from '@logosdx/hooks'

// Define your hookable interface
interface UserService {
    save(user: User): Promise<User>
    delete(id: string): Promise<void>
}

// Create engine and wrap methods
const hooks = new HookEngine<UserService>()
const service = new UserServiceImpl()

hooks.wrap(service, 'save')

// Add validation before save
hooks.extend('save', 'before', async (ctx) => {
    const [user] = ctx.args
    if (!user.email) {
        ctx.fail('Email is required')
    }
})

// Add logging after save
hooks.extend('save', 'after', async (ctx) => {
    console.log('User saved:', ctx.results)
})

// Add error handling
hooks.extend('save', 'error', async (ctx) => {
    console.error('Save failed:', ctx.error)
    // Could retry, transform error, or notify
})

// Use normally - hooks run automatically
await service.save({ name: 'John', email: 'john@example.com' })
```

## Core Concepts

Hooks is built around three ideas:

1. **Wrapping** - Transform any function into a hookable function
2. **Extension Points** - Add behavior at `before`, `after`, or `error` stages
3. **Context Control** - Modify arguments, results, or abort execution

Extensions are registered with `extend()` and run in insertion order. Each extension receives a context object with full control over the hook lifecycle.

## HookEngine

The main class for creating and managing hooks.

### Constructor

```typescript
new HookEngine<Shape>()
```

**Type Parameters:**

- `Shape` - Interface defining your hookable functions

**Example:**

```typescript
interface PaymentService {
    charge(amount: number, cardId: string): Promise<Receipt>
    refund(receiptId: string): Promise<void>
}

const hooks = new HookEngine<PaymentService>()
```

### Creating Hooks

#### `wrap()`

Wrap an object method in-place to make it hookable.

```typescript
wrap<K extends FunctionProps<Shape>>(
    instance: Shape,
    name: K,
    opts?: MakeHookOptions
): void
```

**Parameters:**

- `instance` - Object containing the method to wrap
- `name` - Name of the method to wrap
- `opts` - Optional configuration

**Example:**

```typescript
class OrderService {
    async process(order: Order) {
        // processing logic
    }
}

const service = new OrderService()
const hooks = new HookEngine<OrderService>()

hooks.wrap(service, 'process')

// Now service.process() is hookable
hooks.extend('process', 'before', async (ctx) => {
    console.log('Processing order:', ctx.args[0])
})
```

#### `make()`

Create a hookable function without modifying the original.

```typescript
make<K extends FunctionProps<Shape>>(
    name: K,
    cb: Function,
    opts?: MakeHookOptions
): Function
```

**Parameters:**

- `name` - Unique name for this hook
- `cb` - The original function to wrap
- `opts` - Optional configuration (e.g., `bindTo` for `this` context)

**Returns:** Wrapped function with hook support

**Example:**

```typescript
const hooks = new HookEngine<{ fetch: typeof fetch }>()

const hookedFetch = hooks.make('fetch', fetch)

hooks.extend('fetch', 'before', async (ctx) => {
    console.log('Fetching:', ctx.args[0])
})

await hookedFetch('/api/users')
```

### Adding Extensions

#### `extend()`

Add an extension to a registered hook.

```typescript
extend<K extends FunctionProps<Shape>>(
    name: K,
    extensionPoint: 'before' | 'after' | 'error',
    cbOrOpts: HookFn | HookExtOptions
): Cleanup
```

**Parameters:**

- `name` - Name of the registered hook
- `extensionPoint` - When to run: `before`, `after`, or `error`
- `cbOrOpts` - Extension callback or options object

**Returns:** Cleanup function to remove the extension

**Extension Points:**

| Point | When it runs | Can modify |
|-------|--------------|------------|
| `before` | Before original function | Arguments, can return early |
| `after` | After successful execution | Results |
| `error` | When original throws | Can handle/transform errors |

**Examples:**

```typescript
// Simple callback
const cleanup = hooks.extend('save', 'before', async (ctx) => {
    console.log('About to save:', ctx.args)
})

// With options
hooks.extend('save', 'after', {
    callback: async (ctx) => { console.log('Saved!') },
    once: true,           // Remove after first run
    ignoreOnFail: true    // Don't throw if this extension fails
})

// Remove extension later
cleanup()
```

### Utility Methods

#### `clear()`

Remove all registered hooks and extensions.

```typescript
clear(): void
```

**Example:**

```typescript
hooks.wrap(service, 'save')
hooks.extend('save', 'before', validator)

// Reset for testing
hooks.clear()

// service.save() still works, but validator no longer runs
```

## HookContext

Context object passed to every extension callback.

### Properties

```typescript
interface HookContext<F> {
    args: Parameters<F>           // Current arguments
    results?: ReturnType<F>       // Results (in after/error)
    point: 'before' | 'after' | 'error'  // Current extension point
    error?: unknown               // Error (only in error extensions)
}
```

### Methods

#### `setArgs()`

Replace the arguments passed to the original function.

```typescript
setArgs(next: Parameters<F>): void
```

**Example:**

```typescript
hooks.extend('save', 'before', async (ctx) => {
    const [user] = ctx.args

    // Add timestamp to user
    ctx.setArgs([{ ...user, updatedAt: new Date() }])
})
```

#### `setResult()`

Replace the result returned from the hook chain.

```typescript
setResult(next: ReturnType<F>): void
```

**Example:**

```typescript
hooks.extend('fetch', 'after', async (ctx) => {
    // Transform response
    ctx.setResult({
        ...ctx.results,
        cached: true,
        fetchedAt: new Date()
    })
})
```

#### `returnEarly()`

Skip the original function and return with current results.

```typescript
returnEarly(): void
```

**Example:**

```typescript
hooks.extend('fetch', 'before', async (ctx) => {
    const [url] = ctx.args
    const cached = cache.get(url)

    if (cached) {
        ctx.setResult(cached)
        ctx.returnEarly()  // Skip actual fetch
    }
})
```

#### `fail()`

Abort execution and throw a HookError.

```typescript
fail(error?: unknown): never
```

**Example:**

```typescript
hooks.extend('save', 'before', async (ctx) => {
    const [user] = ctx.args

    if (!user.email) {
        ctx.fail('Email is required')
    }

    if (!isValidEmail(user.email)) {
        ctx.fail(new ValidationError('Invalid email format'))
    }
})
```

#### `removeHook()`

Remove the current extension from future executions.

```typescript
removeHook(): void
```

**Example:**

```typescript
let attempts = 0

hooks.extend('connect', 'error', async (ctx) => {
    attempts++

    if (attempts >= 3) {
        console.log('Max retries reached, removing retry handler')
        ctx.removeHook()
    }
})
```

## Extension Options

When using the options object form of `extend()`:

```typescript
interface HookExtOptions {
    callback: HookFn           // The extension function
    once?: true                // Remove after first execution
    ignoreOnFail?: true        // Don't throw if extension fails
}
```

### `once`

Extension runs only once, then removes itself.

```typescript
hooks.extend('init', 'before', {
    callback: async (ctx) => {
        console.log('First-time initialization')
    },
    once: true
})
```

### `ignoreOnFail`

If the extension throws, continue execution instead of failing.

```typescript
hooks.extend('save', 'after', {
    callback: async (ctx) => {
        await analytics.track('user_saved', ctx.results)  // Non-critical
    },
    ignoreOnFail: true  // Don't fail the save if analytics fails
})
```

## Error Handling

### HookError

Error thrown when `fail()` is called or hook execution fails.

```typescript
class HookError extends Error {
    hookName?: string          // Name of the hook
    extPoint?: string          // Extension point: 'before', 'after', 'error'
    originalError?: Error      // Original error if fail() was called with one
    aborted: boolean           // Whether explicitly aborted via fail()
}
```

### isHookError()

Type guard to check if an error is a HookError.

```typescript
isHookError(error: unknown): error is HookError
```

**Example:**

```typescript
import { attempt } from '@logosdx/utils'
import { isHookError } from '@logosdx/hooks'

const [result, err] = await attempt(() => service.save(user))

if (isHookError(err)) {
    console.log(`Hook "${err.hookName}" failed at "${err.extPoint}"`)
    console.log('Reason:', err.message)

    if (err.originalError) {
        console.log('Caused by:', err.originalError)
    }
}
```

## Patterns & Examples

### Validation

```typescript
hooks.extend('createUser', 'before', async (ctx) => {
    const [userData] = ctx.args

    const errors: string[] = []

    if (!userData.email) errors.push('Email required')
    if (!userData.password) errors.push('Password required')
    if (userData.password?.length < 8) errors.push('Password too short')

    if (errors.length > 0) {
        ctx.fail(new ValidationError(errors.join(', ')))
    }
})
```

### Caching

```typescript
const cache = new Map()

hooks.extend('fetchUser', 'before', async (ctx) => {
    const [userId] = ctx.args
    const cached = cache.get(userId)

    if (cached && !isExpired(cached)) {
        ctx.setResult(cached.data)
        ctx.returnEarly()
    }
})

hooks.extend('fetchUser', 'after', async (ctx) => {
    const [userId] = ctx.args
    cache.set(userId, {
        data: ctx.results,
        expiresAt: Date.now() + 60000
    })
})
```

### Logging & Metrics

```typescript
hooks.extend('processOrder', 'before', async (ctx) => {
    const [order] = ctx.args
    console.log(`Processing order ${order.id}`)
    ctx.args[0] = { ...order, startedAt: Date.now() }
    ctx.setArgs(ctx.args)
})

hooks.extend('processOrder', 'after', async (ctx) => {
    const duration = Date.now() - ctx.args[0].startedAt
    metrics.record('order.processing.duration', duration)
})

hooks.extend('processOrder', 'error', async (ctx) => {
    metrics.increment('order.processing.failures')
    console.error('Order processing failed:', ctx.error)
})
```

### Authentication

```typescript
hooks.extend('secureEndpoint', 'before', async (ctx) => {
    const token = getAuthToken()

    if (!token) {
        ctx.fail(new AuthError('Not authenticated'))
    }

    const user = await validateToken(token)

    if (!user) {
        ctx.fail(new AuthError('Invalid token'))
    }

    // Inject user into args
    ctx.setArgs([...ctx.args, { user }])
})
```

### Retry Logic

```typescript
hooks.extend('unreliableService', 'error', async (ctx) => {
    const maxRetries = 3
    let retries = ctx.args[ctx.args.length - 1]?.retries ?? 0

    if (retries < maxRetries) {
        console.log(`Retry attempt ${retries + 1}/${maxRetries}`)

        // Modify args to track retries
        ctx.setArgs([...ctx.args.slice(0, -1), { retries: retries + 1 }])

        // Note: This doesn't actually retry - you'd need external retry logic
        // This pattern is better suited for logging/metrics in error handlers
    }
})
```

## Type Definitions

### Core Types

```typescript
// Hook function signature
type HookFn<F extends AsyncFunc> = (ctx: HookContext<F>) => Promise<void>

// Extension options
interface HookExtOptions<F extends AsyncFunc> {
    callback: HookFn<F>
    once?: true
    ignoreOnFail?: true
}

// Make options
interface MakeHookOptions {
    bindTo?: any  // `this` context for the wrapped function
}
```

### HookContext

```typescript
interface HookContext<F extends AsyncFunc> {
    args: Parameters<F>
    results?: Awaited<ReturnType<F>>
    point: 'before' | 'after' | 'error'
    error?: unknown

    fail: (error?: unknown) => never
    setArgs: (next: Parameters<F>) => void
    setResult: (next: Awaited<ReturnType<F>>) => void
    returnEarly: () => void
    removeHook: () => void
}
```

## Best Practices

### Keep Extensions Focused

```typescript
// Good: Single responsibility
hooks.extend('save', 'before', validateUser)
hooks.extend('save', 'before', sanitizeInput)
hooks.extend('save', 'after', logSuccess)

// Avoid: Multiple responsibilities in one extension
hooks.extend('save', 'before', async (ctx) => {
    // validation AND sanitization AND logging...
})
```

### Use `ignoreOnFail` for Non-Critical Extensions

```typescript
// Critical: validation must succeed
hooks.extend('save', 'before', validateUser)

// Non-critical: analytics can fail silently
hooks.extend('save', 'after', {
    callback: trackAnalytics,
    ignoreOnFail: true
})
```

### Clean Up When Done

```typescript
// Store cleanup functions
const cleanups = [
    hooks.extend('save', 'before', validator),
    hooks.extend('save', 'after', logger)
]

// Clean up all at once
cleanups.forEach(cleanup => cleanup())
```

### Type Your Hook Shapes

```typescript
// Define clear interfaces for hookable services
interface OrderService {
    create(order: OrderInput): Promise<Order>
    update(id: string, updates: Partial<OrderInput>): Promise<Order>
    cancel(id: string, reason: string): Promise<void>
}

const hooks = new HookEngine<OrderService>()
// Now all hook names and argument types are enforced
```

## Summary

The `@logosdx/hooks` library provides a clean way to extend function behavior without modifying original code. Use it for cross-cutting concerns like validation, caching, logging, and error handling while keeping your core logic clean and focused.
