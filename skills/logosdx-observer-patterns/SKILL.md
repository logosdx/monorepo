---
name: logosdx-observer-patterns
description: "Use when implementing event-driven patterns with @logosdx/observer. Covers typed events, regex matching, async generators, EventQueue with priority/concurrency/rate limiting, and component observation."
license: MIT
metadata:
  author: logosdx
  version: "1.0"
---

## Quick Start

```typescript
import { ObserverEngine } from '@logosdx/observer'

// Define typed events
interface AppEvents {
    'user:login': { userId: string; timestamp: number }
    'user:logout': { userId: string }
    'data:update': any[]
}

// Create observer
const observer = new ObserverEngine<AppEvents>({ name: 'app-events' })

// Subscribe — returns cleanup function
const cleanup = observer.on('user:login', (data) => {
    console.log('Login:', data.userId)  // data is typed
})

// Emit
observer.emit('user:login', { userId: '123', timestamp: Date.now() })

// Cleanup when done
cleanup()
```

## Critical Rules

1. **Define event interfaces.** Always type your events with an interface mapping event names to their payload types. This gives you autocomplete and compile-time safety.
2. **Always call cleanup functions.** Every `on()` returns a cleanup function. Store it and call it on teardown to prevent listener leaks.
3. **Use regex for cross-cutting concerns.** `observer.on(/^user:/, handler)` captures all user events — great for logging, analytics, and debugging.
4. **Generator events are buffered.** When using async generators (`on()` without a callback), events emitted while your async code runs between iterations are queued in FIFO order — no data loss.
5. **Use `observer.clear()` or `engine.destroy()` for full cleanup** when tearing down the observer itself, not just individual listeners.

## Event Consumption Patterns

| Pattern | API | Use Case |
|---------|-----|----------|
| Callback | `on(event, fn)` → cleanup | React to events as they arrive |
| One-shot callback | `once(event, fn)` → cleanup | Initialize on first occurrence |
| Promise | `once(event)` → Promise | Await a single event |
| Async generator | `on(event)` → EventGenerator | Stream processing, for-await loops |
| Queue | `queue(event, processor, opts)` → EventQueue | Concurrent processing with rate limiting |
| Component | `observe(object)` → enhanced object | Add events to any plain object |

## Regex Matching

```typescript
// Listen to all user events
observer.on(/^user:/, ({ event, data }) => {
    console.log(`${event}:`, data)  // event is string, data is any
})

// Listen to all error events
observer.on(/error$/, ({ event, data }) => {
    reportError(event, data)
})

// Broadcast to all matching listeners
observer.emit(/^user:/, { type: 'broadcast' })
```

## Async Generator

```typescript
// on() without callback returns an EventGenerator
const events = observer.on('data:update')

for await (const data of events) {

    await processData(data)  // events buffered while this runs

    if (shouldStop) {

        events.cleanup()
        break
    }
}
```

## EventQueue

```typescript
const queue = observer.queue('data:process', async (item) => {

    await processItem(item)
}, {
    concurrency: 3,
    rateLimitCapacity: 100,
    rateLimitIntervalMs: 1000,
    taskTimeoutMs: 30000,
    maxQueueSize: 1000,
})

queue.on('error', (item) => console.error('Failed:', item))
queue.on('idle', () => console.log('All done'))

// Graceful shutdown
await queue.shutdown()
```

See [observer-event-architecture.md](references/observer-event-architecture.md) and [observer-queue-recipes.md](references/observer-queue-recipes.md) for details.

## References

- [observer-event-architecture.md](references/observer-event-architecture.md) — Event types, lifecycle, spy/validation, and component observation
- [observer-queue-recipes.md](references/observer-queue-recipes.md) — Queue configuration, lifecycle events, and processing patterns
