---
title: Advanced
description: Object observation, listener transfer, error handling, and type definitions.
---

# Advanced


[[toc]]

## `observe()`

Extend any object with event capabilities.

```typescript
observe<C>(component: C, options?: ObserveOptions): Child<C, Shape>
```

**Parameters:**

- `component` - Any object to extend with event methods
- `options` - Optional `{ signal?: AbortSignal }` for automatic cleanup

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

## Listener Transfer & Copy

Move or duplicate listeners between observer instances. Useful when cloning engines (e.g. a FetchEngine) and carrying over observability listeners to the new instance.

```typescript
    const source = new ObserverEngine<AppEvents>();
    const target = new ObserverEngine<AppEvents>();

    source.on('analytics', trackEvent);
    source.on('user:login', logLogin);

    // Transfer: source loses listeners, target gains them
    ObserverEngine.transfer(source, target);

    // Copy: source keeps listeners, target also gets them
    ObserverEngine.copy(source, target);
```

Both methods stack with existing target listeners — they won't overwrite what's already there.

### Filtering

Use `filter` (opt-in) and `exclude` (opt-out) to selectively transfer:

```typescript
    // Only transfer specific events
    ObserverEngine.transfer(source, target, {
        filter: ['analytics', /^user:/]
    });

    // Transfer everything except internal events
    ObserverEngine.transfer(source, target, {
        exclude: [/^internal:/]
    });

    // Compose: filter narrows first, exclude removes from that set
    ObserverEngine.transfer(source, target, {
        filter: [/^fetch:/],
        exclude: ['fetch:debug']
    });
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
const [result, err] = await attempt(() => generator.next())
if (err && isEventError(err)) {
    console.log('Event error:', err.event, err.data)
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

## Helper Functions

### `makeEventTracer()`

Create debug trace for event operations.

```typescript
makeEventTracer(
    event: string,
    caller: string,
    listenerOrData?: Function | unknown
): EventTrace
```

### `isEventError()`

Type guard for EventError instances.

```typescript
isEventError(err: unknown): err is EventError
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

    // Listener options (AbortSignal support)
    type ListenerOptions = {
        signal?: AbortSignal
    }

    // Observe options (AbortSignal support)
    type ObserveOptions = {
        signal?: AbortSignal
    }

    // Transfer/copy options
    type TransferOptions<Ev> = {
        filter?: (Events<Ev> | RegExp)[]
        exclude?: (Events<Ev> | RegExp)[]
    }

    // Spy function names
    type FuncName = 'on' | 'once' | 'off' | 'emit' | 'cleanup'

    // Spy action payload
    type SpyAction<Ev> = {
        event: keyof Ev | RegExp | '*'
        listener?: Function | null
        data?: unknown
        fn: FuncName
        context: ObserverEngine<any>
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
        signal?: AbortSignal
    }

    // Full component with observe and $observer access
    type Instance<Ev> = Component<Ev> & {
        observe: ObserverEngine<Ev>['observe']
        $observer: ObserverEngine<Ev>
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
