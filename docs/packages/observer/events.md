---
title: Events
description: Listening, emitting, and pattern matching with ObserverEngine events.
---

# Events


[[toc]]

## Event Listening

### `on()`

Listen for events with callback or return async generator.

```typescript
// Returns generator for specific event
on<E extends Events<Shape>>(event: E, options?: ListenerOptions): EventGenerator<Shape, E>

// Listen to specific event with callback
on<E extends Events<Shape>>(event: E, listener: EventCallback<Shape[E]>, options?: ListenerOptions): Cleanup

// Returns generator for regex events
on(event: RegExp, options?: ListenerOptions): EventGenerator<Shape, RegExp>

// Listen to regex events with callback
on(event: RegExp, listener: EventCallback<RgxEmitData<Shape>>, options?: ListenerOptions): Cleanup
```

**Parameters:**

- `event` - Event name (string) or regex pattern
- `listener` - Optional callback function
- `options` - Optional `{ signal?: AbortSignal }` for automatic cleanup

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

### `once()`

Listen for single event emission.

```typescript
// Returns promise for specific event
once<E extends Events<Shape>>(event: E, options?: ListenerOptions): EventPromise<Shape[E]>

// Listen once with callback
once<E extends Events<Shape>>(event: E, listener: EventCallback<Shape[E]>, options?: ListenerOptions): Cleanup

// Returns promise for regex events
once(event: RegExp, options?: ListenerOptions): EventPromise<RgxEmitData<Shape>>

// Listen once to regex with callback
once(event: RegExp, listener: EventCallback<RgxEmitData<Shape>>, options?: ListenerOptions): Cleanup
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

### `off()`

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

## Event Emission

### `emit()`

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
