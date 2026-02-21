---
title: Generators
description: Async iterators for reactive event streams with manual control.
---

# Event Generators


Async iterator for event streams with manual control. Events are internally buffered, so none are lost even if they arrive faster than the consumer can process them.

[[toc]]

## Constructor Options

```typescript
interface EventGeneratorOptions {
    signal?: AbortSignal    // Auto-cleanup when signal aborts
}
```

When created via `observer.on(event, options)`, the options are forwarded to the generator.

## Properties

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

## Methods

### `next()`

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

### `emit()`

Emit directly to this generator's listeners.

```typescript
emit(data: EventData<S, E>): void
```

### `cleanup()`

Stop listening and mark as destroyed.

## Async Iteration

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

## Event Buffering

Events that arrive while the consumer is busy (e.g., doing async work between iterations) are buffered internally and delivered in FIFO order on the next `next()` call. This guarantees no events are dropped during async iteration.

```typescript
const generator = observer.on('job:complete')

for await (const result of generator) {
    // Even if multiple 'job:complete' events fire during this await,
    // they are buffered and delivered on subsequent iterations.
    await saveToDatabase(result)
}
```

Events emitted before any call to `next()` are also buffered:

```typescript
const generator = observer.on('status')

observer.emit('status', 'a')
observer.emit('status', 'b')
observer.emit('status', 'c')

await generator.next() // 'a'
await generator.next() // 'b'
await generator.next() // 'c'
```
