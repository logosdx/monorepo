---
title: Queues
description: Process events with concurrency control, rate limiting, and state management.
---

# Event Queues


Process events with concurrency control, rate limiting, and comprehensive state management.

[[toc]]

## Creating a Queue

```typescript
const queue = observer.queue<E extends Events<Shape> | RegExp>(
    event: E,
    process: (data: EventData<Shape, E>) => MaybePromise<any>,
    options: QueueOpts
): EventQueue<Shape, E>
```

**Parameters:**

- `event` - Event to queue
- `process` - Processing function
- `options` - Queue configuration

## Configuration Options

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

## Lifecycle Methods

- `start()` Start processing queue.
- `stop()` - Stop processing immediately.
- `pause()` - Pause processing (keeps queue intact).
- `resume()` - Resume processing from pause.
- `shutdown(force?: boolean): Promise<number>` - Gracefully drain queue and stop.
  - `force` - If true, stop immediately without draining
  - **Returns:** Number of items processed during shutdown, or, if `force` is true, the number of items that were not processed before shutdown.

## Queue Operations

### `add()`

Add item to queue.

```typescript
add(data: EventData<S, E>, priority?: number): boolean
```

**Returns:** `true` if item was added, `false` if rejected (queue full or not running)

**Parameters:**

- `data` - Item to process
- `priority` - Higher numbers processed first (default: 0)

### `flush()`

Process specific number of items.

```typescript
flush(limit?: number): Promise<number>
```

**Parameters:**

- `limit` - Max items to process (default: Infinity)

**Returns:** Number of items processed

### `purge()`

Clear all queued items.

```typescript
purge(): number
```

**Returns:** Number of items removed

## State Properties

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

## Statistics

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

## Queue Events

EventQueue inherits from ObserverEngine and emits comprehensive lifecycle events:

### Processing Events

```typescript
queue.on('added', (item) => {})         // Item added to queue
queue.on('processing', (item) => {})    // Item being processed
queue.on('success', (item) => {})       // Item processed successfully
queue.on('error', (item) => {})         // Item processing failed
queue.on('timeout', (item) => {})       // Item processing timed out
queue.on('rejected', (item) => {})      // Item rejected (queue full, etc.)
```

### State Events

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
queue.on('cleanup', () => {})                // Queue cleaned up
```

## Example Usage

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

**Note:** For synchronous operations, set concurrency to 1. JavaScript's single-threaded nature means synchronous work cannot be distributed across workers.

## Queue Types

### `QueueState`

Enum representing queue lifecycle states.

```typescript
enum QueueState {
    running = 'running'
    paused = 'paused'
    stopped = 'stopped'
    draining = 'draining'
}
```

### `QueueRejectionReason`

Enum for why an item was rejected from the queue.

```typescript
enum QueueRejectionReason {
    full = 'Queue is full'
    notRunning = 'Queue is not running'
}
```

### `InternalQueueEvent<T>`

Wrapper class for internal queue event payloads. Used to distinguish queue-emitted events from user events so regex listeners can skip them.

```typescript
class InternalQueueEvent<T = unknown> {
    readonly data: T
    constructor(data: T)
}
```
