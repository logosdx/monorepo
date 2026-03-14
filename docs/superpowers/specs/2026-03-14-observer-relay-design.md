# ObserverRelay Design Spec

**Date**: 2026-03-14
**Package**: `@logosdx/observer`
**Status**: Draft


## Motivation

ObserverEngine provides a type-safe, event-driven API for local pub/sub — listeners, generators, queues, regex matching, spying. But it operates within a single process boundary.

Many real-world systems need the same event semantics across a network boundary: Redis Pub/Sub, RabbitMQ, Kafka, SQS, Postgres LISTEN/NOTIFY, WorkerThreads, database RPC SDKs. Each transport has its own connection API, but the pattern is always the same: send events out, receive events in.

ObserverRelay abstracts this into a single class that hides two internal ObserverEngines behind a unified API. The consumer emits and subscribes as if working with a single local engine. The subclass wires the transport.

**ObserverEngine at scale.**


## Design


### Class Signature

```ts
abstract class ObserverRelay<
    TEvents extends Record<string, any>,
    TCtx extends object
> {}
```

- `TEvents` — the event shape. Same for both pub and sub sides.
- `TCtx extends object` — the transport context shape. Only appears on the receiving side. Represents transport-specific handles like ack, nack, dead letter routing, etc. Constrained to `object` because transport contexts are always structured (methods like `ack()`, `nack()`, properties like `channel`).


### Internal Architecture

Two `ObserverEngine` instances, hidden from the consumer:

```
Your Code                  ObserverRelay<TEvents, TCtx>                   Transport
┌─────────────────┐    ┌──────────────────────────────────────┐    ┌─────────────────┐
│                  │    │  #pub — ObserverEngine<TEvents>      │    │                 │
│  relay.emit() ──────► │    /.+/ catch-all → send(ev, data) ────► │  redis.publish   │
│                  │    │                                      │    │  rabbit.send     │
│                  │    │  #sub — ObserverEngine<RelayEvents>  │    │  kafka.produce   │
│  relay.on()  ◄──────  │    receive(ev, data, ctx) → sub.emit ◄── │  worker.onmsg    │
│                  │    │                                      │    │                 │
└─────────────────┘    └──────────────────────────────────────┘    └─────────────────┘
```

- **Pub engine**: `ObserverEngine<TEvents>` — receives `emit()` calls. A `/.+/` regex catch-all forwards every emission to the abstract `send()` method.
- **Sub engine**: `ObserverEngine<RelayEvents<TEvents, TCtx>>` — surfaces events to consumer listeners. Fed by the protected `receive()` method.


### Type Wrapping

The sub engine wraps every event's data with the transport context:

```ts
type RelayEvents<TEvents extends Record<string, any>, TCtx> = {
    [K in keyof TEvents]: { data: TEvents[K]; ctx: TCtx }
}
```

This means:
- `emit(event, data)` — `data` is `TEvents[event]` (pure)
- `on(event, ({ data, ctx }) => {})` — `data` is `TEvents[event]`, `ctx` is `TCtx`

Regex listeners follow standard ObserverEngine nesting — no flattening:
- `on(/pattern/, ({ event, data }) => {})` — `data` is `{ data: TEvents[event], ctx: TCtx }`


### Abstract and Protected Methods

#### `send(event, data)` — abstract

Called by the pub engine's `/.+/` catch-all whenever `emit()` fires. The catch-all receives the regex-wrapped `{ event, data }` envelope and destructures it before calling `send()`:

```ts
this.#pub.on(/.+/, ({ event, data }) => this.send(event as string, data))
```

The subclass implements this to push the event to the transport. Returns `void` — this is fire-and-forget. If the transport is async, the subclass is responsible for scheduling its own async work and handling errors internally (e.g., buffering, retrying, logging).

```ts
protected abstract send(event: string, data: unknown): void
```

#### `receive(event, data, ctx)` — protected concrete

The subclass calls this when the transport delivers a message. Feeds the sub engine.

```ts
protected receive(event: string, data: unknown, ctx: TCtx): void {
    this.#sub.emit(event, { data, ctx })
}
```

Both `event` and `data` are intentionally untyped (`string` and `unknown`). The subclass is the trust boundary — it parses raw transport payloads and constructs the ctx. The relay does not validate that event names or data shapes match `TEvents`. Type safety is enforced at the consumer-facing API layer (the sub engine's generics), not at the transport ingestion layer.


### Constructor Options

```ts
interface ObserverRelayOptions {
    name?: string
    spy?: ObserverEngine.Spy<any>
    signal?: AbortSignal
    emitValidator?: {
        pub?: ObserverEngine.EmitValidator<any>
        sub?: ObserverEngine.EmitValidator<any>
    }
}
```

- `name` — auto-suffixed to `name:pub` and `name:sub` for the internal engines. The relay passes `{ name: '${name}:pub' }` and `{ name: '${name}:sub' }` to each engine's constructor.
- `spy` — passed to both engines. Typed as `Spy<any>` because the pub engine is `ObserverEngine<TEvents>` and the sub engine is `ObserverEngine<RelayEvents<TEvents, TCtx>>` — a single spy function cannot satisfy both type constraints. The spy distinguishes sides via `action.context.name` (`name:pub` vs `name:sub`).
- `signal` — `AbortSignal` passed to both engine constructors. ObserverEngine already handles signal-driven cleanup natively. The relay also listens to the signal to set its own `#isShutdown` flag.
- `emitValidator` — optional validators for each side, provided as `{ pub?, sub? }`:
    - `pub` — validates outbound data before it hits the transport. Catches bad emissions at the source.
    - `sub` — validates inbound data from the transport before it reaches listeners. Catches external systems sending malformed payloads.
    - Both typed as `EmitValidator<any>` for the same cross-engine typing reason as `spy`.


### Public API Surface

| Method | Delegates to | Signature notes |
|--------|-------------|-----------------|
| `emit` | `#pub.emit` | Pure `TEvents` data |
| `on` | `#sub.on` | Returns `Cleanup` or `EventGenerator` |
| `once` | `#sub.once` | Returns `Cleanup` or `EventPromise` |
| `off` | `#sub.off` | |
| `queue` | `#sub.queue` | Full `EventQueue` with concurrency, rate limiting, etc. |
| `shutdown()` | both `.clear()` | Tears down both engines |
| `spy()` | both engines | Same function attached to both; always passes `force: true` internally so it can set on both engines even if a constructor spy was provided. Distinguished by engine name. |
| `$has()` | both engines | Returns `{ pub: boolean, sub: boolean }` |
| `$facts()` | both engines | Returns `{ pub: Facts, sub: Facts }` |
| `$internals()` | both engines | Returns `{ pub: Internals, sub: Internals }` |
| `get isShutdown` | relay state | Returns `boolean` — whether `shutdown()` has been called |

**Not exposed**: `observe()`, `clear()`, `debug()`, `transfer()`, `copy()`.

- `observe()` — component observation is a local concern; doesn't apply to relays
- `clear()` — removed in favor of `shutdown()` for clarity
- `debug()` — use `spy()` directly
- `transfer()` / `copy()` — static methods that operate on raw engines; not applicable to relays


### Lifecycle

ObserverRelay does not manage transport connections. The subclass is responsible for:
- Connecting to the transport
- Setting up subscriptions (calling `this.receive()` when messages arrive)
- Disconnecting / cleaning up transport resources

`shutdown()` sets an internal `#isShutdown` flag and clears both internal ObserverEngines (removing the pub catch-all and all sub listeners). After shutdown, the relay is permanently inoperable:

- `emit()` — silently ignored
- `on()` / `once()` / `off()` / `queue()` — silently ignored, return no-op cleanups where applicable
- `spy()` — silently ignored
- `$has()` / `$facts()` / `$internals()` — return empty/default values reflecting the cleared state
- `shutdown()` — idempotent, safe to call multiple times

The `isShutdown` getter reflects this state. Transport teardown is the subclass's responsibility.


### Queue Behavior

`queue()` delegates to the sub engine. This means:
- Queues process **inbound** messages from the transport
- `queue.add()` emits on the observer the queue was constructed with (`#sub`), so the event stays local and does **not** reach the pub engine or transport. This is standard queue behavior, not relay-specific logic.
- This is the expected behavior: you queue received messages for controlled processing


### Request/Response

Out of scope. Transports that support request/reply (RabbitMQ `replyTo`, Kafka request topics, etc.) already have native patterns for this. The relay does not duplicate them.


## Example Implementation

```ts
// ── Event shape ──
interface OrderEvents {
    'order:placed': { id: string; total: number }
    'order:shipped': { id: string; trackingNo: string }
    'order:cancelled': { id: string; reason: string }
}

// ── Transport context ──
interface RedisCtx {
    ack(): void
    nack(): void
    dlq(reason: string): void
}

// ── Subclass ──
class RedisRelay extends ObserverRelay<OrderEvents, RedisCtx> {

    #redis: RedisClient
    #channel: string

    constructor(redis: RedisClient, channel: string) {

        super({ name: 'redis' })
        this.#redis = redis
        this.#channel = channel

        redis.subscribe(this.#channel, (msg) => {

            const { event, data } = JSON.parse(msg.body)
            this.receive(event, data, {
                ack: () => msg.ack(),
                nack: () => msg.nack(),
                dlq: (reason) => msg.moveToDeadLetter(reason),
            })
        })
    }

    protected send(event: string, data: unknown) {

        this.#redis.publish(this.#channel, JSON.stringify({ event, data }))
    }
}

// ── Usage ──
const relay = new RedisRelay(redisClient, 'orders')

// Emit — pure data, no transport concerns
relay.emit('order:placed', { id: '123', total: 99.99 })

// Subscribe — data + transport context
relay.on('order:placed', ({ data, ctx }) => {

    processOrder(data)
    ctx.ack()
})

// Queue — concurrency-controlled processing over the relay
const orderQueue = relay.queue('order:placed', async ({ data, ctx }) => {

    await fulfillOrder(data)
    ctx.ack()
}, {
    name: 'order-processing',
    concurrency: 5,
    rateLimitCapacity: 100,
    rateLimitIntervalMs: 60_000,
})

// Debugging — observability on both engines
relay.spy((action) => {
    // action.context.name is 'redis:pub' or 'redis:sub'
    telemetry.track(action)
})

relay.$facts()
// → { pub: { listeners: [...], ... }, sub: { listeners: [...], ... } }
```


## File Placement

New files within `packages/observer/src/`:

- `relay.ts` — `ObserverRelay` class, `RelayEvents` type
- Exported from `packages/observer/src/index.ts`

No new packages. No new dependencies.
