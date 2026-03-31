---
description: Usage patterns for the @logosdx/observer package.
globs: '*.ts'
---

# @logosdx/observer Usage Patterns

Advanced type-safe event system with async iteration, queuing, and component observation.

> Use `attempt()`/`attemptSync()` from `@logosdx/utils` for any error-prone operation inside event handlers and queue processors. Never use try-catch.

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
type FuncName = 'on' | 'once' | 'off' | 'emit' | 'cleanup'
type ListenerOptions = { signal?: AbortSignal }
type ObserveOptions = { signal?: AbortSignal }

type SpyAction<Ev> = {
    event: keyof Ev | RegExp | '*'
    listener?: Function | null
    data?: unknown
    fn: FuncName
    context: ObserverEngine<any>
}
```

## ObserverEngine - Core Event Emitter

```ts
import { ObserverEngine } from '@logosdx/observer'

// Create typed observer
const controller = new AbortController()
const observer = new ObserverEngine<AppEvents>({
    name: 'app-events',
    spy: (action) => console.log(action.fn, action.event),
    emitValidator: (event, data) => { /* validate data */ },
    signal: controller.signal // aborts all listeners when signal fires
})

// Instance properties
observer.name // 'app-events' (non-enumerable, defaults to random string)

// Set/replace spy after construction
observer.spy(newSpyFn) // throws if spy already set
observer.spy(newSpyFn, true) // force replace existing spy

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

// AbortSignal cleanup — all methods accept { signal }
const ac = new AbortController()
observer.on('user:login', handler, { signal: ac.signal })
observer.once('user:logout', handler, { signal: ac.signal })
const gen = observer.on('user:login', { signal: ac.signal })
ac.abort() // removes all listeners at once

// Works with AbortSignal.timeout()
observer.on('heartbeat', handler, { signal: AbortSignal.timeout(30_000) })
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

Events are buffered internally in FIFO order. No events are dropped even if
they arrive faster than the consumer iterates.

```ts
// Generator from on() without callback
const userEvents = observer.on('user:login')

// Async iteration (events buffered while doing async work between iterations)
for await (const loginData of userEvents) {
    console.log('User logged in:', loginData.userId)
    await saveToDatabase(loginData) // buffered events won't be lost here

    if (shouldStop) {
        userEvents.cleanup()
        break
    }
}

// Manual iteration
const loginData = await userEvents.next()
console.log(loginData) // { userId: string; timestamp: number }

// Events emitted before next() is called are also buffered
observer.emit('user:login', first)
observer.emit('user:login', second)
await userEvents.next() // first
await userEvents.next() // second

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

// Queue processors should use attempt() for error-prone work
const queue = bus.queue('process', async (item) => {
    const [result, err] = await attempt(() => handleItem(item));
    if (err) console.warn('Processing failed:', err);
}, { concurrency: 1, taskTimeoutMs: 5000 });

// Queue lifecycle
queue.start()
queue.pause()
queue.resume()
queue.stop()
queue.shutdown() // drain and stop
queue.shutdown(true) // force stop

// Add items (returns boolean: true if added, false if rejected)
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
queue.on('cleanup', () => {}) // queue cleaned up

// Promise-based event waiting
const success = await queue.once('success')
const errorItem = await queue.once('error')
```

## Component Observation

```ts
// Extend any object with event capabilities
const modal = { isOpen: false }
const enhancedModal = observer.observe(modal) // accepts optional { signal } for auto-cleanup

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

## Listener Transfer & Copy

```ts
// Transfer: move listeners from source to target (source loses them)
ObserverEngine.transfer(source, target)

// Copy: duplicate listeners to target (source keeps them)
ObserverEngine.copy(source, target)

// Opt-in filter: only transfer specific events
ObserverEngine.transfer(source, target, { filter: ['analytics', /^user:/] })

// Opt-out exclude: transfer everything except these
ObserverEngine.copy(source, target, { exclude: [/^internal:/] })

// Compose: filter first, then exclude from that set
ObserverEngine.transfer(source, target, {
    filter: [/^fetch:/],
    exclude: ['fetch:debug']
})

// Stacking: target's existing listeners are untouched
target.on('analytics', existingHandler)
ObserverEngine.transfer(source, target) // existingHandler still works

// TransferOptions type
type TransferOptions<Ev> = {
    filter?: (Events<Ev> | RegExp)[]    // opt-in whitelist (applied first)
    exclude?: (Events<Ev> | RegExp)[]   // opt-out blacklist (applied second)
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
observer.$internals() // internal maps (debugging only, returns cloned copies)

// Queue exported types
import { QueueState, QueueRejectionReason, InternalQueueEvent } from '@logosdx/observer'
// QueueState: 'running' | 'paused' | 'stopped' | 'draining'
// QueueRejectionReason: 'Queue is full' | 'Queue is not running'
// InternalQueueEvent<T>: wrapper with .data property, used to mark queue events

// Error handling
import { EventError, isEventError } from '@logosdx/observer'
// EventErrors are thrown by EventGenerator methods
const generator = observer.on('user:login') // no callback = EventGenerator

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

## ObserverRelay - Cross-Boundary Event Bridge

Abstract class that bridges ObserverEngine events across network/process boundaries
via two internal engines (pub and sub). Subclasses implement `send()` for the transport
and call `receive()` when messages arrive.

```ts
import { ObserverRelay, type RelayEvents, type ObserverRelayOptions } from '@logosdx/observer'

// Event shape (same for both pub and sub sides)
interface OrderEvents {
    'order:placed': { id: string; total: number }
    'order:shipped': { id: string; trackingNo: string }
}

// Transport context (only appears on the receiving side)
interface RedisCtx {
    ack(): void
    nack(): void
}

// Subclass implements send() and calls receive()
class RedisRelay extends ObserverRelay<OrderEvents, RedisCtx> {

    #redis: RedisClient

    constructor(redis: RedisClient, channel: string) {

        super({ name: 'redis' })
        this.#redis = redis

        redis.subscribe(channel, (msg) => {

            const { event, data } = JSON.parse(msg.body)
            this.receive(event, data, {
                ack: () => msg.ack(),
                nack: () => msg.nack(),
            })
        })
    }

    protected send(event: string, data: unknown) {

        const [, err] = attemptSync(() => this.#redis.publish('orders', JSON.stringify({ event, data })))
        if (err) console.warn('Relay send failed:', err)
    }
}

// Usage — emit is pure data, on receives { data, ctx }
const relay = new RedisRelay(redisClient, 'orders')

relay.emit('order:placed', { id: '123', total: 99.99 })

relay.on('order:placed', ({ data, ctx }) => {

    const [, err] = attemptSync(() => processOrder(data))
    if (err) { ctx.nack(); return }
    ctx.ack()
})

// Queue — concurrency-controlled inbound processing
const queue = relay.queue('order:placed', async ({ data, ctx }) => {

    const [, err] = await attempt(() => fulfillOrder(data))
    if (err) { ctx.nack(); return }
    ctx.ack()
}, { name: 'order-processing', concurrency: 5 })

// Observability — spy, $has, $facts, $internals all return { pub, sub }
relay.spy((action) => telemetry.track(action))
relay.$facts() // → { pub: { listeners: [...] }, sub: { listeners: [...] } }

// Lifecycle
relay.isShutdown // false
relay.shutdown() // clears both engines, permanently inoperable
```

### RelayEvents Type

Wraps event data with transport context for the sub engine:

```ts
type RelayEvents<TEvents, TCtx> = {
    [K in keyof TEvents]: { data: TEvents[K]; ctx: TCtx }
}
```

### Public API

| Method | Delegates to | Notes |
|--------|-------------|-------|
| `emit` | `#pub.emit` | Pure `TEvents` data |
| `on` | `#sub.on` | Receives `{ data, ctx }` |
| `once` | `#sub.once` | Receives `{ data, ctx }` |
| `off` | `#sub.off` | |
| `queue` | `#sub.queue` | Processes inbound messages |
| `spy()` | both engines | Attached to both with `force: true` |
| `$has()` | both engines | Returns `{ pub: boolean, sub: boolean }` |
| `$facts()` | both engines | Returns `{ pub: Facts, sub: Facts }` |
| `$internals()` | both engines | Returns `{ pub: Internals, sub: Internals }` |
| `shutdown()` | both `.clear()` | Permanently inoperable after call |
| `isShutdown` | relay state | Getter returning `boolean` |

### Constructor Options

```ts
interface ObserverRelayOptions {
    name?: string        // auto-suffixed to name:pub and name:sub
    spy?: Spy<any>       // passed to both engines
    signal?: AbortSignal // passed to both engines + sets #isShutdown
    emitValidator?: {
        pub?: EmitValidator<any>  // validates outbound data
        sub?: EmitValidator<any>  // validates inbound data
    }
}
```

