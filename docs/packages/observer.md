---
title: Observer
description: Event emitter with async generators and advanced queue processing
---

# Observer

Event emitter with async generators and advanced queue processing for reactive programming

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

### Event Listening

#### `on()`

Listen for events with callback or return async generator.

```typescript
// Returns generator for specific event
on<E extends Events<Shape>>(event: E): EventGenerator<Shape, E>

// Listen to specific event with callback
on<E extends Events<Shape>>(event: E, listener: EventCallback<Shape[E]>): Cleanup

// Returns generator for regex events
on(event: RegExp): EventGenerator<Shape, RegExp>

// Listen to regex events with callback
on(event: RegExp, listener: EventCallback<RgxEmitData<Shape>>): Cleanup
```

**Parameters:**

- `event` - Event name (string) or regex pattern
- `listener` - Optional callback function

**Returns:**

- `EventGenerator` when no callback provided
- `Cleanup` function when callback provided

**Examples:**

```typescript
// Generator pattern
const userEvents = observer.on('user:login')
for await (const data of userEvents) {
    console.log('User logged in:', data.userId)
}

// Callback pattern
const cleanup = observer.on('user:login', (data) => {
    console.log('Login:', data.userId)
})
cleanup() // Remove listener

// Regex matching
observer.on(/^user:/, ({ event, data }) => {
    console.log(`Event ${event}:`, data)
})
```

#### `once()`

Listen for single event emission.

```typescript
// Returns promise for specific event
once<E extends Events<Shape>>(event: E): EventPromise<Shape[E]>

// Listen once with callback
once<E extends Events<Shape>>(event: E, listener: EventCallback<Shape[E]>): Cleanup

// Returns promise for regex events
once(event: RegExp): EventPromise<RgxEmitData<Shape>>

// Listen once to regex with callback
once(event: RegExp, listener: EventCallback<RgxEmitData<Shape>>): Cleanup
```

**Examples:**

```typescript
// Promise pattern
const loginData = await observer.once('user:login')
console.log('Login data:', loginData.userId)

// Callback pattern
const cleanup = observer.once('user:logout', (data) => {
    console.log('User logged out:', data.userId)
})
```

#### `off()`

Remove event listeners.

```typescript
off(event: Events<Shape> | RegExp | string, listener?: Function): void
```

**Parameters:**

- `event` - Event name or regex pattern
- `listener` - Specific listener to remove (optional, removes all if omitted)

**Examples:**

```typescript
observer.off('user:login', specificCallback) // Remove specific listener
observer.off('user:login') // Remove all listeners for event
observer.off(/^user:/) // Remove all regex listeners matching pattern
```

### Event Emission

#### `emit()`

Trigger event with data.

```typescript
emit<E extends Events<Shape> | RegExp | string>(
    event: E,
    data?: E extends Events<Shape>
        ? Shape[E]
        : E extends string
        ? Record<E, any>[E]
        : unknown
): void
```

**Parameters:**

- `event` - Event name or regex pattern
- `data` - Event data (type-safe based on event shape)

**Examples:**

```typescript
observer.emit('user:login', { userId: '123' })
observer.emit(/^user:/, { type: 'broadcast' }) // Emits to all regex listeners
```

### Advanced Features

#### `observe()`

Extend any object with event capabilities.

```typescript
observe<C>(component: C): Child<C, Shape>
```

**Returns:** Component with added event methods and cleanup function

**Example:**

```typescript
const modal = { isOpen: false }
const enhancedModal = observer.observe(modal)

enhancedModal.on('open', () => {
    enhancedModal.isOpen = true
})

enhancedModal.emit('open')
enhancedModal.cleanup() // Cleans up only the observed component's listeners
```

#### `queue()`

Create processing queue for events.

```typescript
queue<E extends Events<Shape> | RegExp>(
    event: E,
    process: (data: EventData<Shape, E>) => MaybePromise<any>,
    options: QueueOpts
): EventQueue<Shape, E>
```

**Parameters:**

- `event` - Event to queue
- `process` - Processing function
- `options` - Queue configuration

**Example:**

```typescript
const queue = observer.queue('order:process', async (data) => {
    await processOrder(data.orderId)
}, {
    name: 'order-processor',
    concurrency: 3,
    maxQueueSize: 1000,
})
```

### Utility Methods

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

#### `debug(on: boolean)`

Enable/disable debug tracing.

## EventGenerator

Async iterator for event streams with manual control.

### Properties

```typescript
class EventGenerator<S, E> {
    cleanup: Cleanup
    lastValue: EventData<S, E> | null
    done: boolean

    next(): Promise<EventData<S, E>>
    emit(data: EventData<S, E>): void

    [Symbol.asyncIterator](): AsyncGenerator<EventData<S, E>>
}
```

### Methods

#### `next()`

Get next event value.

```typescript
next(): Promise<EventData<S, E>>
```

**Throws:** `EventError` if generator is destroyed

**Example:**

```typescript
const generator = observer.on('user:login')

// Manual iteration
const loginData = await generator.next()
console.log(loginData.userId)

// Cleanup when done
generator.cleanup()
```

#### `emit()`

Emit directly to this generator's listeners.

```typescript
emit(data: EventData<S, E>): void
```

#### `cleanup()`

Stop listening and mark as destroyed.

### Async Iteration

```typescript
// Automatic iteration
for await (const data of generator) {
    console.log(data)

    if (shouldStop) {
        generator.cleanup()
        break
    }
}
```

## EventQueue

Process events with concurrency control, rate limiting, and comprehensive state management.

### Configuration Options

```typescript
interface QueueOpts {
    name: string                        // Queue identifier
    type?: 'fifo' | 'lifo'             // Processing order (default: 'fifo')
    concurrency?: number               // Parallel workers (default: 1)

    // Timing
    pollIntervalMs?: number            // Idle check interval (default: 100)
    processIntervalMs?: number         // Delay between items (default: 0)
    taskTimeoutMs?: number             // Task timeout (default: 0 = no timeout)
    jitterFactor?: number              // Timing randomization 0-1 (default: 0)

    // Limits
    maxQueueSize?: number              // Max items (default: 999_999_999)
    rateLimitCapacity?: number         // Rate limit tokens (default: 999_999_999)
    rateLimitIntervalMs?: number       // Rate limit window (default: 1000)

    // Behavior
    autoStart?: boolean                // Start immediately (default: true)
    debug?: boolean | 'info' | 'verbose' // Debug output (default: false)
}
```

### Lifecycle Methods

- `start()` Start processing queue.
- `stop()` - Stop processing immediately.
- `pause()` - Pause processing (keeps queue intact).
- `resume()` - Resume processing from pause.
- `shutdown(force?: boolean): Promise<number>` - Gracefully drain queue and stop.
  - `force` - If true, stop immediately without draining
  - **Returns:** Number of items processed during shutdown, or, if `force` is true, the number of items that were not processed before shutdown.

### Queue Operations

#### `add()`

Add item to queue.

```typescript
add(data: EventData<S, E>, priority?: number): void
```

**Parameters:**

- `data` - Item to process
- `priority` - Higher numbers processed first (default: 0)

#### `flush()`

Process specific number of items.

```typescript
flush(limit?: number): Promise<number>
```

**Parameters:**

- `limit` - Max items to process (default: Infinity)

**Returns:** Number of items processed

#### `purge()`

Clear all queued items.

```typescript
purge(): number
```

**Returns:** Number of items removed

### State Properties

```typescript
get name(): string
get isRunning(): boolean
get isPaused(): boolean
get isStopped(): boolean
get isDraining(): boolean
get isIdle(): boolean
get isWaiting(): boolean

get state(): 'running' | 'paused' | 'stopped' | 'draining'
get pending(): number
```

### Statistics

```typescript
get stats(): {
    processed: number
    processing: number
    avgProcessingTime: number
    success: number
    error: number
    rejected: number
}

get snapshot(): {
    name: string
    state: string
    pending: number
    isRunning: boolean
    isPaused: boolean
    isStopped: boolean
    isDraining: boolean
    isIdle: boolean
    isWaiting: boolean
    stats: QueueStats
}
```

### Queue Events

EventQueue inherits from ObserverEngine and emits comprehensive lifecycle events:

#### Processing Events

```typescript
queue.on('added', (item) => {})         // Item added to queue
queue.on('processing', (item) => {})    // Item being processed
queue.on('success', (item) => {})       // Item processed successfully
queue.on('error', (item) => {})         // Item processing failed
queue.on('timeout', (item) => {})       // Item processing timed out
queue.on('rejected', (item) => {})      // Item rejected (queue full, etc.)
```

#### State Events

```typescript
queue.on('start', () => {})             // Queue starting
queue.on('started', () => {})           // Queue started
queue.on('stopped', () => {})           // Queue stopped
queue.on('paused', () => {})            // Queue paused
queue.on('resumed', () => {})           // Queue resumed

queue.on('empty', () => {})             // Queue became empty
queue.on('idle', () => {})              // Queue idle (no pending items)
queue.on('rate-limited', (item) => {})  // Rate limit hit

queue.on('drain', ({ pending }) => {})        // Starting to drain
queue.on('drained', ({ drained }) => {})      // Finished draining
queue.on('flush', ({ pending }) => {})        // Starting flush
queue.on('flushed', ({ flushed }) => {})      // Finished flushing
queue.on('purged', ({ count }) => {})         // Items purged
queue.on('shutdown', ({ force }) => {})       // Queue shutdown
```

### Example Usage

```typescript
const queue = observer.queue('data:process', async (data) => {
    await processData(data)
}, {
    name: 'data-processor',
    concurrency: 5,
    rateLimitCapacity: 100,
    rateLimitIntervalMs: 1000,
    taskTimeoutMs: 30000
})

// Monitor queue
queue.on('error', (item) => {
    console.error('Processing failed:', item.error)
})

queue.on('idle', () => {
    console.log('Queue is idle')
})

// Add items with priority
queue.add(urgentData, 10)  // High priority
queue.add(normalData, 1)   // Low priority

// Control processing
await queue.flush(10)      // Process 10 items
queue.pause()              // Pause processing
queue.resume()             // Resume processing
await queue.shutdown()     // Graceful shutdown
```

## Error Types

### EventError

Error thrown by EventGenerator methods.

```typescript
class EventError extends Error {
    event?: string | RegExp
    listener?: Function
    data?: unknown

    constructor(message: string, opts?: {
        event: string | RegExp
        listener: Function
        data: unknown
    })
}

// Type guard
function isEventError(err: unknown): err is EventError
```

**Usage:**

```typescript
try {
    await generator.next()
} catch (err) {
    if (isEventError(err)) {
        console.log('Event error:', err.event, err.data)
    }
}
```

### EventTrace

Debug error with stack trace information.

```typescript
class EventTrace extends Error {
    listener: Function | null
    data: unknown | null
    func: string
    event: string
    stack: string
}
```

## Type Definitions

### Core Types

```typescript
// Event shape constraint
type Events<Shape> = keyof Shape

// Event data extraction
type EventData<S, E extends Events<S> | RegExp = Events<S>> =
    E extends Events<S>
        ? S[E]
        : E extends RegExp
            ? ObserverEngine.RgxEmitData<S>
            : S[Events<S>]
```

### ObserverEngine Types

```typescript
namespace ObserverEngine {
    // Event callback signature
    interface EventCallback<Shape> {
        (data: Shape, info?: { event: string, listener: Function }): void
    }

    // Regex emit data format
    type RgxEmitData<Shape> = {
        event: Events<Shape>
        data: Shape[Events<Shape>]
    }

    // Cleanup function
    type Cleanup = () => void

    // Component observation types
    type Component<Ev> = {
        on: ObserverEngine<Ev>['on']
        once: ObserverEngine<Ev>['once']
        emit: ObserverEngine<Ev>['emit']
        off: ObserverEngine<Ev>['off']
    }

    type Child<C, Ev> = C & Component<Ev> & {
        cleanup: Cleanup
    }

    // Configuration types
    interface Spy<Ev> {
        (action: SpyAction<Ev>): void
    }

    interface EmitValidator<Ev> {
        (event: keyof Ev, data: Ev[keyof Ev], context: ObserverEngine<Ev>): void
        (event: RegExp, data: unknown, context: ObserverEngine<Ev>): void
        (event: '*', data: unknown, context: ObserverEngine<Ev>): void
    }

    type Options<Ev> = {
        name?: string
        spy?: Spy<Ev>
        emitValidator?: EmitValidator<Ev>
    }
}
```

### Promise Extensions

```typescript
// Enhanced promise with cleanup
class EventPromise<T> extends Promise<T> {
    cleanup?: () => void
    reject?: (err: Error | string) => void
    resolve?: (value: T) => void
}

// Deferred event with cleanup
class DeferredEvent<T> extends Deferred<T> {
    promise: EventPromise<T>
    cleanup?: () => void
}
```

## Helper Functions

### makeEventTracer()

Create debug trace for event operations.

```typescript
makeEventTracer(
    event: string,
    caller: string,
    listenerOrData?: Function | unknown
): EventTrace
```

### isEventError()

Type guard for EventError instances.

```typescript
isEventError(err: unknown): err is EventError
```

## Best Practices

### Error Handling

```typescript
// Always use type guards
const [result, err] = await attempt(() => generator.next())
if (err && isEventError(err)) {
    console.log('Generator error:', err.event)
}

// Handle queue errors
queue.on('error', ({ error, data }) => {
    console.error('Queue error:', error.message, data)
})
```

### Memory Management

```typescript
// Always cleanup generators
const generator = observer.on('event')
try {
    for await (const data of generator) {
        // Process data
    }
} finally {
    generator.cleanup()
}

// Cleanup components
const enhanced = observer.observe(component)
enhanced.cleanup() // ⚠️ WARNING: Removes ALL listeners from the observer
```

### Performance Optimization

```typescript
// Use regex efficiently
const userEvents = observer.on(/^user:/)
// Better than multiple individual listeners

// Configure queues appropriately
const queue = observer.queue('event', processor, {
    concurrency: 5,              // Balance throughput vs resources
    rateLimitCapacity: 100,      // Prevent overwhelming downstream
    taskTimeoutMs: 30000,        // Prevent hanging tasks
    processIntervalMs: 10        // Avoid tight loops
})
```

**Note:** For synchronous operations, set concurrency to 1. JavaScript's single-threaded nature means synchronous work cannot be distributed across workers.

## Summary


The `@logosdx/observer` library provides powerful event-driven programming with async generators, event queues, and comprehensive state management. Use it to build reactive systems with predictable event flow and robust error handling.

