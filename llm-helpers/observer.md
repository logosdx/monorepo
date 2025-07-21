---
description: Usage patterns for the @logosdx/observer package.
globs: *.ts
---

# @logosdx/observer Usage Patterns

Advanced type-safe event system with async iteration, queuing, and component observation.

## Core Types

```ts
// Define your event shape
interface AppEvents {
    'user:login': { userId: string; timestamp: number }
    'user:logout': { userId: string }
    'data:update': any[]
    'system:error': Error
}

// Generic types for constraints
type Events<Shape> = keyof Shape
type EventData<Shape, E extends Events<Shape>> = Shape[E]
type EventCallback<T> = (data: T, info?: { event: string, listener: Function }) => void
type Cleanup = () => void
```

## ObserverEngine - Core Event Emitter

```ts
import { ObserverEngine } from '@logosdx/observer'

// Create typed observer
const observer = new ObserverEngine<AppEvents>({
    name: 'app-events',
    spy: (action) => console.log(action.fn, action.event),
    emitValidator: (event, data) => { /* validate data */ }
})

// Basic event patterns
observer.on('user:login', (data) => {
    // data is { userId: string; timestamp: number }
})

observer.once('user:logout', (data) => {
    // fires once, data is { userId: string }
})

observer.emit('user:login', { userId: '123', timestamp: Date.now() })

// Cleanup patterns
const cleanup = observer.on('data:update', callback)
cleanup() // remove listener

observer.off('user:login', specificCallback)
observer.off('user:login') // remove all listeners
observer.clear() // remove all listeners
```

## Regex Event Matching

```ts
// Listen to patterns
observer.on(/^user:/, ({ event, data }) => {
    // Matches 'user:login', 'user:logout', etc.
    // event: string, data: any
})

observer.on(/error$/, ({ event, data }) => {
    // Matches 'system:error', 'validation:error', etc.
})

// Emit to regex (matches all matching listeners)
observer.emit(/^user:/, { type: 'broadcast' })
```

## EventGenerator - Async Iteration

```ts
// Generator from on() without callback
const userEvents = observer.on('user:login')

// Async iteration
for await (const loginData of userEvents) {
    console.log('User logged in:', loginData.userId)

    if (shouldStop) {
        userEvents.cleanup()
        break
    }
}

// Manual iteration
const loginData = await userEvents.next()
console.log(loginData) // { userId: string; timestamp: number }

// Generator properties
userEvents.lastValue // last received value
userEvents.done // boolean
userEvents.emit(data) // emit to underlying observer
userEvents.cleanup() // stop listening

// Regex generators
const allUserEvents = observer.on(/^user:/)
for await (const { event, data } of allUserEvents) {
    console.log(`${event}:`, data)
}
```

## Promise-Based once()

```ts
// Promise without callback
const loginPromise = observer.once('user:login')
const userData = await loginPromise
loginPromise.cleanup() // optional cleanup

// Promise with timeout
const userData = await Promise.race([
    observer.once('user:login'),
    new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
    )
])
```

## EventQueue - Processing Pipeline

```ts
// Create queue from observer
const queue = observer.queue('data:process', async (data) => {
    // Process each data item - can return Promise<any> or any (MaybePromise)
    await processData(data)
    return result // optional return value
}, {
    name: 'data-processor',
    concurrency: 3,
    type: 'fifo', // or 'lifo'

    // Rate limiting
    rateLimitCapacity: 100,
    rateLimitIntervalMs: 1000,

    // Timing
    pollIntervalMs: 100,
    processIntervalMs: 50,
    taskTimeoutMs: 30000,
    jitterFactor: 0.1,

    // Limits
    maxQueueSize: 1000,
    autoStart: true,
    debug: 'verbose'
})

// Queue lifecycle
queue.start()
queue.pause()
queue.resume()
queue.stop()
queue.shutdown() // drain and stop
queue.shutdown(true) // force stop

// Add items
queue.add(data, priority) // higher priority = processed first
observer.emit('data:process', data) // also adds to queue

// Queue operations
queue.flush(10) // process 10 items
queue.purge() // clear all items
await queue.shutdown() // drain and stop

// Queue state
queue.isRunning
queue.isPaused
queue.isStopped
queue.isDraining
queue.isIdle
queue.isWaiting
queue.pending // items in queue
queue.state // 'running' | 'paused' | 'stopped' | 'draining'
```

## Queue Events

```ts
// Lifecycle events
queue.on('start', () => {})
queue.on('started', () => {})
queue.on('stopped', () => {})
queue.on('paused', () => {})
queue.on('resumed', () => {})

// Processing events
queue.on('added', (item) => {}) // item added to queue
queue.on('processing', (item) => {}) // item being processed
queue.on('success', (item) => {}) // item processed successfully
queue.on('error', (item) => {}) // item processing failed
queue.on('timeout', (item) => {}) // item processing timed out
queue.on('rejected', (item) => {}) // item rejected (queue full, etc.)

// Queue state events
queue.on('empty', () => {}) // queue became empty
queue.on('idle', () => {}) // queue idle (no pending items)
queue.on('rate-limited', (item) => {}) // rate limit hit
queue.on('drain', ({ pending }) => {}) // starting to drain
queue.on('drained', ({ drained }) => {}) // finished draining
queue.on('flush', ({ pending }) => {}) // starting flush
queue.on('flushed', ({ flushed }) => {}) // finished flushing
queue.on('purged', ({ count }) => {}) // items purged
queue.on('shutdown', ({ force }) => {}) // queue shutdown

// Promise-based event waiting
const success = await queue.once('success')
const errorItem = await queue.once('error')
```

## Component Observation

```ts
// Extend any object with event capabilities
const modal = { isOpen: false }
const enhancedModal = observer.observe(modal)

// Now modal has event methods (returns C & Component<Events> & { cleanup: () => void })
enhancedModal.on('open', () => enhancedModal.isOpen = true)
enhancedModal.on('close', () => enhancedModal.isOpen = false)
enhancedModal.emit('open')

// Two cleanup methods available
enhancedModal.clear() // clears all listeners for this component
enhancedModal.cleanup() // cleans up and removes internal tracking

// Component types from the package
type Component<Events> = {
    on: ObserverEngine<Events>['on']
    once: ObserverEngine<Events>['once']
    emit: ObserverEngine<Events>['emit']
    off: ObserverEngine<Events>['off']
}

type Child<C, Events> = C & Component<Events> & {
    cleanup: () => void
}
```

## Advanced Features

```ts
// Debugging and tracing
observer.debug(true) // enable stack traces
observer.debug(false) // disable

// Spy on all operations
const spy = (action) => {
    console.log(`${action.fn}(${action.event})`, action.data)
}
const observer = new ObserverEngine({ spy })

// Emit validation
const emitValidator = (event, data, context) => {
    if (!isValid(data)) throw new Error('Invalid data')
}
const observer = new ObserverEngine({ emitValidator })

// Inspector methods
observer.$has('event') // check if event has listeners
observer.$has(/pattern/) // check if regex has matches
observer.$facts() // listener counts and state
observer.$internals() // internal maps (debugging only)

// Error handling
import { EventError, isEventError } from '@logosdx/observer'
// EventErrors are thrown by EventGenerator methods
const generator = observer.generator('user:login')

try {
    generator.cleanup() // Mark as destroyed
    await generator.next() // This will throw EventError
} catch (err) {
    if (isEventError(err)) {
        console.log(err.event, err.data, err.listener)
    }
}

// EmitValidator can also throw (but not EventError)
const observer = new ObserverEngine({
    emitValidator: (event, data) => {
        if (event === 'restricted') throw new Error('Access denied')
    }
})

try {
    observer.emit('restricted', {})
} catch (err) {
    console.log('Validation failed:', err.message)
}
```

## Patterns Summary

```ts
// Basic event emitter
const obs = new ObserverEngine<Events>()
obs.on('event', callback)
obs.emit('event', data)

// Async iteration
for await (const data of obs.on('event')) { }

// Promise-based
const data = await obs.once('event')

// Queue processing
const queue = obs.queue('event', processor, options)
queue.add(data, priority)

// Component extension
const component = obs.observe(object)
component.on('event', callback)

// Regex matching
obs.on(/pattern/, ({ event, data }) => {})

// Resource cleanup
const cleanup = obs.on('event', callback)
cleanup()
```