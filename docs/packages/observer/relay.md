---
title: Relay
description: Bridge ObserverEngine events across network and process boundaries with ObserverRelay.
---

# Relay


ObserverRelay bridges events across network and process boundaries — Redis Pub/Sub, RabbitMQ, Kafka, WebSockets, WorkerThreads, or any transport. You emit and subscribe as if working with a single local engine. The subclass wires the transport.

[[toc]]

## How It Works


Two hidden `ObserverEngine` instances sit behind a unified API:

@startuml
skinparam backgroundColor transparent
skinparam componentStyle rectangle
skinparam defaultFontColor #6b6b6b
skinparam packageBorderColor #f2a3b3
skinparam packageFontColor #e94465
skinparam packageBackgroundColor transparent
skinparam componentBorderColor #f2a3b3
skinparam componentBackgroundColor #fdf0f3
skinparam componentFontColor #6b6b6b
skinparam arrowColor #e94465

package "Your Code" {
    [relay.emit()] as emit
    [relay.on()] as on
}

package "ObserverRelay" {
    [#pub engine\n/.+/ catch-all → send()] as pub
    [#sub engine\nreceive() → sub.emit()] as sub
}

package "Transport" {
    [redis.publish\nrabbit.send\nkafka.produce] as push
    [redis.subscribe\nworker.onmsg] as pull
}

emit --> pub
pub --> push
pull --> sub
sub --> on
@enduml

- **`emit(event, data)`** — pure `TEvents` data, forwarded to the abstract `send()` method
- **`on(event, ({ data, ctx }) => {})`** — receives event data plus transport context

## Creating a Subclass


Implement `send()` for outbound events. Call `receive()` when the transport delivers inbound messages. The relay absorbs all your queue wiring — the rest of your backend just works with event emitters.

```typescript
import { ObserverRelay } from '@logosdx/observer'

interface OrderEvents {
    'order:placed': { id: string; total: number }
    'order:shipped': { id: string; trackingNo: string }
}

interface AmqpCtx {
    ack(): void
    nack(): void
}

interface QueueBinding {
    queue: string
    config?: { noAck?: boolean; priority?: number }
}

class AmqpRelay extends ObserverRelay<OrderEvents, AmqpCtx> {

    #channel: AmqpChannel

    constructor(channel: AmqpChannel, queues: QueueBinding[]) {

        super({ name: 'amqp' })
        this.#channel = channel

        for (const q of queues) {

            channel.consume(q.queue, (msg) => {

                if (!msg) return

                const { event, data } = JSON.parse(msg.content.toString())
                this.receive(event, data, {
                    ack: () => channel.ack(msg),
                    nack: () => channel.nack(msg),
                })
            }, q.config)
        }
    }

    protected send(event: string, data: unknown) {

        this.#channel.sendToQueue(
            event,
            Buffer.from(JSON.stringify(data))
        )
    }
}
```

## Usage


Once you have a subclass, the API is familiar — it's just `ObserverEngine` split across a boundary.

### Emitting Events

```typescript
const relay = new AmqpRelay(channel, [
    { queue: 'orders.placed', config: { noAck: false } },
    { queue: 'orders.shipped', config: { noAck: false } },
])

// Pure data — no transport concerns
relay.emit('order:placed', { id: '123', total: 99.99 })
```

### Subscribing to Events

```typescript
// Callback receives { data, ctx }
relay.on('order:placed', ({ data, ctx }) => {

    processOrder(data)
    ctx.ack()
})

// once() also wraps with { data, ctx }
const { data, ctx } = await relay.once('order:shipped')
```

### Regex Listeners

Regex listeners follow standard ObserverEngine nesting — the `data` field contains the wrapped `{ data, ctx }`:

```typescript
relay.on(/^order:/, ({ event, data }) => {

    // event: 'order:placed' | 'order:shipped' | ...
    // data: { data: OrderEvents[event], ctx: AmqpCtx }
    console.log(`${event}:`, data.data)
    data.ctx.ack()
})
```

### Queue Processing

`queue()` delegates to the sub engine for concurrency-controlled inbound processing:

```typescript
const orderQueue = relay.queue('order:placed', async ({ data, ctx }) => {

    await fulfillOrder(data)
    ctx.ack()
}, {
    name: 'order-processing',
    concurrency: 5,
    rateLimitCapacity: 100,
    rateLimitIntervalMs: 60_000,
})
```

## Constructor Options


```typescript
new ObserverRelay<TEvents, TCtx>(options?: ObserverRelayOptions)
```

```typescript
interface ObserverRelayOptions {
    name?: string        // auto-suffixed to name:pub and name:sub
    spy?: Spy<any>       // passed to both engines
    signal?: AbortSignal // passed to both engines, sets isShutdown on abort
    emitValidator?: {
        pub?: EmitValidator<any>  // validates outbound data
        sub?: EmitValidator<any>  // validates inbound data
    }
}
```

### Split Validators

Validate outbound and inbound data independently:

```typescript
class ValidatedRelay extends ObserverRelay<OrderEvents, AmqpCtx> {

    constructor(channel: AmqpChannel, queue: string) {

        super({
            name: 'validated',
            emitValidator: {
                pub: (event, data) => {
                    // Validate before sending to transport
                    if (!data.id) throw new Error('Missing order ID')
                },
                sub: (event, data) => {
                    // Validate data arriving from transport
                    if (!data.data?.id) throw new Error('Malformed inbound payload')
                },
            },
        })

        // ... wire transport
    }

    protected send(event: string, data: unknown) { /* ... */ }
}
```

## Observability


All inspection methods return `{ pub, sub }` objects so you can see both engines:

```typescript
// Spy on all operations
relay.spy((action) => {

    // action.context.name is 'amqp:pub' or 'amqp:sub'
    telemetry.track(action)
})

// Check listeners
relay.$has('order:placed')
// → { pub: false, sub: true }

// Get listener statistics
relay.$facts()
// → { pub: { listeners: [...], ... }, sub: { listeners: [...], ... } }

// Inspect internals
relay.$internals()
// → { pub: { name: 'amqp:pub', ... }, sub: { name: 'amqp:sub', ... } }
```

## Shutdown


`shutdown()` permanently tears down the relay. Both internal engines are cleared and all further operations are silently ignored.

```typescript
relay.shutdown()

relay.isShutdown // true
relay.emit('order:placed', { id: '456', total: 10 }) // silently ignored
```

Shutdown is idempotent — safe to call multiple times.

You can also shut down via `AbortSignal`:

```typescript
const controller = new AbortController()
const relay = new AmqpRelay(channel, queues, { signal: controller.signal })

// Later — shuts down the relay the same as calling relay.shutdown()
controller.abort()
```

::: warning Transport lifecycle is your responsibility
`shutdown()` only tears down the relay's internal engines. It does **not** close connections, release channels, or clean up any external resources. Your subclass is responsible for managing the lifecycle of whatever transport it connects to.
:::

## API Reference


| Method | Delegates to | Notes |
|--------|-------------|-------|
| `emit(event, data)` | `#pub.emit` | Pure `TEvents` data |
| `on(event, callback)` | `#sub.on` | Receives `{ data, ctx }` |
| `once(event, callback?)` | `#sub.once` | Receives `{ data, ctx }` |
| `off(event, callback?)` | `#sub.off` | |
| `queue(event, handler, opts)` | `#sub.queue` | Processes inbound messages |
| `spy(fn)` | both engines | Force-set on both |
| `$has(event)` | both engines | Returns `{ pub: boolean, sub: boolean }` |
| `$facts()` | both engines | Returns `{ pub: Facts, sub: Facts }` |
| `$internals()` | both engines | Returns `{ pub: Internals, sub: Internals }` |
| `shutdown()` | both `.clear()` | Permanently inoperable |
| `isShutdown` | relay state | Getter returning `boolean` |

## Type Reference


```typescript
// Wraps each event's data with transport context
type RelayEvents<TEvents extends Record<string, any>, TCtx extends object> = {
    [K in keyof TEvents]: { data: TEvents[K]; ctx: TCtx }
}

// Class signature
abstract class ObserverRelay<
    TEvents extends Record<string, any>,
    TCtx extends object
> {
    protected abstract send(event: string, data: unknown): void
    protected receive(event: string, data: unknown, ctx: TCtx): void
}
```

- **`TEvents`** — the event shape, same for both pub and sub sides
- **`TCtx extends object`** — the transport context shape (e.g. `{ ack(), nack() }`), only appears on the receiving side
