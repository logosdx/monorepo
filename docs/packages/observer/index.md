---
title: Observer
description: Events that understand patterns. Queues that manage themselves.
---

# Observer


Event systems get complex fast — you need pattern matching, async processing, and queue management. `@logosdx/observer` delivers all three in one package. Match events with regex patterns like `/^user:/`, consume them as async iterables, or process them through rate-limited queues with built-in retries. Every event is type-safe, every listener is trackable, and the built-in spy functionality shows you exactly what's happening. It's the event system that scales with your application.

[[toc]]

## Installation


::: code-group

```bash [npm]
npm install @logosdx/observer
```

```bash [yarn]
yarn add @logosdx/observer
```

```bash [pnpm]
pnpm add @logosdx/observer
```

:::


**CDN:**

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/observer@latest/dist/browser.min.js"></script>
<script>
  const { ObserverEngine } = LogosDx.Observer;
</script>
```

## Quick Start

```typescript
import { ObserverEngine } from '@logosdx/observer'

// Define your event shape
interface AppEvents {
    'user:login': { userId: string }
    'user:logout': { userId: string }
}

// Create observer
const observer = new ObserverEngine<AppEvents>()

// Listen with callback
observer.on('user:login', (data) => {
    console.log('User logged in:', data.userId)
})

// Or listen with async generator
const userEvents = observer.on('user:login')
for await (const data of userEvents) {
    console.log('Login event:', data.userId)
    break // Don't forget to break or cleanup!
}

// Emit events
observer.emit('user:login', { userId: '123' })
```

## Core Concepts

Observer is built around event shapes (TypeScript interfaces) and async generators. Define your events as interfaces, create an ObserverEngine instance, and use async generators for reactive event processing. The library supports both callback and generator patterns for maximum flexibility.

## ObserverEngine

The main event emitter class. Everything else is built on top of this.

### Constructor

```typescript
new ObserverEngine<Shape>(options?: ObserverEngine.Options<Shape>)
```

**Type Parameters:**

- `Shape` - Interface defining your event structure

**Options:**

- `name?: string` - Instance identifier for debugging (default: random string)
- `spy?: Spy<Shape>` - Function called on every operation
- `emitValidator?: EmitValidator<Shape>` - Function to validate emit calls
- `signal?: AbortSignal` - Aborts all listeners when signal fires

**Example:**

```typescript
interface AppEvents {
    'user:login': { userId: string }
    'user:logout': { userId: string }
}

const observer = new ObserverEngine<AppEvents>({
    name: 'app-events',
    spy: (action) => console.log(action.fn, action.event),
    emitValidator: (event, data) => {
        if (!data) throw new Error('Data required')
    }
})
```

### Properties

#### `name`

Instance identifier. Accessible as a non-enumerable property. Defaults to a random 7-character string if not provided in options.

```typescript
const observer = new ObserverEngine<AppEvents>({ name: 'app-events' })
console.log(observer.name) // 'app-events'
```

### Methods

#### `spy()`

Set or replace the spy function after construction.

```typescript
spy(spy: ObserverEngine.Spy<Shape>, force?: boolean): void
```

**Parameters:**

- `spy` - The spy function to set
- `force` - If `true`, replaces an existing spy (default: `false`, throws if spy already set)

```typescript
observer.spy((action) => {
    console.log(`${action.fn}(${String(action.event)})`)
})

// Replace existing spy
observer.spy(newSpyFn, true)
```

#### `clear()`

Remove all listeners.

#### `$has()`

Check if event has listeners.

```typescript
$has(event: Events<Shape>): boolean
$has(event: RegExp): boolean
```

#### `$facts()`

Get listener statistics.

```typescript
$facts(): {
    listeners: Events<Shape>[]
    rgxListeners: string[]
    listenerCounts: Record<string, number>
    hasSpy: boolean
}
```

#### `$internals()`

Get internal state for debugging. Returns cloned copies — safe to inspect without affecting the instance.

```typescript
$internals(): {
    listenerMap: Map<Events<Shape>, Set<Function>>
    rgxListenerMap: Map<string, Set<Function>>
    internalListener: EventTarget
    name: string
    spy: ObserverEngine.Spy<Shape> | undefined
}
```

#### `debug(on: boolean)`

Enable/disable debug tracing.

## AbortSignal Support

All listener methods accept an optional `signal` parameter for automatic cleanup via `AbortController`. When the signal aborts, the listener is removed automatically — no manual cleanup needed.

```typescript
const controller = new AbortController()

// Listeners auto-cleanup when signal aborts
observer.on('user:login', handleLogin, { signal: controller.signal })
observer.once('user:logout', handleLogout, { signal: controller.signal })

// Generator auto-cleanup
const gen = observer.on('user:login', { signal: controller.signal })

// Observed component auto-cleanup
const enhanced = observer.observe(modal, { signal: controller.signal })

// Abort everything at once
controller.abort()
```

This works with any `AbortSignal`, including `AbortSignal.timeout()`:

```typescript
// Listener that auto-removes after 30 seconds
observer.on('heartbeat', handler, {
    signal: AbortSignal.timeout(30_000)
})
```
