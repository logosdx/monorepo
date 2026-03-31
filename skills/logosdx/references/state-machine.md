---
description: Usage patterns for the @logosdx/state-machine package.
globs: '*.ts'
---

# @logosdx/state-machine Usage Patterns


Type-safe finite state machine with enforced transitions, guarded context, async invoke, and machine-to-machine coordination.

## Core Types

```ts
// Define your context (data the machine carries)
interface CheckoutContext {
    items: Item[]
    error: string | null
}

// Define your events (what the machine responds to)
interface CheckoutEvents {
    FETCH: void
    ADD_ITEM: { id: string, name: string }
    SUCCESS: { items: Item[] }
    FAILURE: { message: string }
    RETRY: void
    RESET: void
}

// Transition targets — string shorthand or object with action/guard
type TransitionTarget<Context, Data> = string | {
    target: string
    action?: (context: Context, data: Data) => Context
    guard?: (context: Context, data: Data) => boolean
}

// Per-state config
type StateConfig<Context, Events> = {
    on?: { [E in keyof Events]?: TransitionTarget<Context, Events[E]> }
    invoke?: InvokeConfig<Context>
    final?: boolean
}

// Machine config
type MachineConfig<Context, Events> = {
    initial: string
    context: Context
    transitions: Record<string, StateConfig<Context, Events>>
    debug?: boolean
}
```

## StateMachine — Core FSM

```ts
import { StateMachine } from '@logosdx/state-machine'

const machine = new StateMachine<CheckoutContext, CheckoutEvents>({
    initial: 'idle',
    context: { items: [], error: null },
    transitions: {
        idle: {
            on: {
                FETCH: 'loading',
                ADD_ITEM: {
                    target: 'idle',
                    action: (ctx, data) => ({ ...ctx, items: [...ctx.items, data] }),
                },
            },
        },
        loading: {
            on: {
                SUCCESS: {
                    target: 'idle',
                    action: (ctx, data) => ({ ...ctx, items: data.items }),
                },
                FAILURE: {
                    target: 'error',
                    action: (ctx, data) => ({ ...ctx, error: data.message }),
                },
            },
        },
        error: {
            on: {
                RETRY: 'loading',
                RESET: {
                    target: 'idle',
                    action: () => ({ items: [], error: null }),
                },
            },
        },
    },
})

// Properties
machine.state    // 'idle' — current state name
machine.context  // { items: [], error: null } — cloned, safe to read
```

## Sending Events

```ts
// Void events need no data
machine.send('FETCH')

// Typed data required for non-void events
machine.send('ADD_ITEM', { id: '1', name: 'Widget' })

// Invalid for current state — silent no-op, emits $rejected
machine.send('RETRY') // ignored when in 'idle'
```

## Guards

```ts
const machine = new StateMachine<{ count: number }, { INCREMENT: void }>({
    initial: 'idle',
    context: { count: 0 },
    transitions: {
        idle: {
            on: {
                INCREMENT: {
                    target: 'idle',
                    action: (ctx) => ({ count: ctx.count + 1 }),
                    guard: (ctx) => ctx.count < 10, // blocks when count >= 10
                },
            },
        },
    },
})
```

## Listening for Transitions

```ts
// Specific state entry
machine.on('error', ({ from, to, event, context, data }) => {
    console.error(`Entered error from ${from} via ${event}`)
})

// Wildcard — any transition
machine.on('*', (payload) => {
    console.log(`${payload.from} → ${payload.to}`)
})

// Regex matching
machine.on(/error|failed/, (payload) => { ... })

// Rejected transitions
machine.on('$rejected', ({ state, event, reason }) => {
    console.warn(`"${event}" rejected in "${state}" — ${reason}`)
    // reason: 'no_transition' | 'guard_failed'
})

// Cleanup
const cleanup = machine.on('loading', listener)
cleanup() // stop listening

machine.off('loading', listener)
```

## Invoke — Async State Transitions

> Inside invoke `src` functions, always wrap async operations with `attempt()` from `@logosdx/utils`.

```ts
const machine = new StateMachine<{ data: any, error: string | null }, { FETCH: void }>({
    initial: 'idle',
    context: { data: null, error: null },
    transitions: {
        idle: {
            on: { FETCH: 'loading' },
        },
        loading: {
            invoke: {
                src: async (ctx) => {
                    const res = await fetch('/api/items')
                    return res.json()
                },
                onDone: {
                    target: 'idle',
                    action: (ctx, result) => ({ ...ctx, data: result }),
                },
                onError: {
                    target: 'error',
                    action: (ctx, err) => ({ ...ctx, error: err.message }),
                },
            },
        },
        error: {
            on: { RETRY: 'loading' },
        },
    },
})

// Invoke with attempt() — preferred pattern for error-prone async work
loading_with_attempt: {
    invoke: {
        src: async (context) => {
            const [result, err] = await attempt(() => validateAddress(context.shippingAddress));
            if (err) throw err; // let onError handle it
            return result;
        },
        onDone: { target: 'payment', action: (ctx, data) => ({ ...ctx, validated: true }) },
        onError: { target: 'shipping_error', action: (ctx, data) => ({ ...ctx, error: data.message }) }
    },
},

// Invoke fires automatically when entering a state with invoke config.
// If the machine transitions away before the promise settles,
// the result is discarded and $invoke.cancelled is emitted.

// Observable invoke events
machine.on('$invoke.done', ({ state, result }) => { ... })
machine.on('$invoke.error', ({ state, error }) => { ... })
machine.on('$invoke.cancelled', ({ state }) => { ... })
```

## Persistence

```ts
import { StateMachine } from '@logosdx/state-machine'
import type { StorageAdapter } from '@logosdx/state-machine'

// Any adapter that implements load/save
const adapter: StorageAdapter = {
    load: async (key) => {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
    },
    save: async (key, snapshot) => {
        localStorage.setItem(key, JSON.stringify(snapshot))
    },
}

const machine = new StateMachine(config, {
    persistence: { key: 'checkout', adapter },
})

// Wait for hydration before using
await machine.ready()

// Machine auto-saves { state, context } on every transition.
// On hydration, falls back to initial if saved state no longer exists.
```

## StateHub — Machine Coordination

```ts
import { StateMachine, StateHub } from '@logosdx/state-machine'

const hub = new StateHub({
    auth: authMachine,
    checkout: checkoutMachine,
    notifications: notifMachine,
})

// Type-safe access
const auth = hub.get('auth')
auth.send('LOGIN', { user: 'admin' })

// Declarative machine-to-machine wiring
hub.connect({
    from: 'auth',
    enters: 'loggedOut',
    to: 'checkout',
    send: 'RESET',
})

hub.connect({
    from: 'checkout',
    enters: 'confirmed',
    to: 'notifications',
    send: 'NOTIFY',
    data: (ctx) => ({ message: `Order: ${ctx.items.length} items` }),
})

// Returns cleanup function
const cleanup = hub.connect({ ... })
cleanup()
```

## Internal Events Reference

| Event | When | Payload |
|-------|------|---------|
| `*` | Any successful transition | `{ from, to, event, context, data }` |
| `{stateName}` | Entering a specific state | `{ from, to, event, context, data }` |
| `$rejected` | Invalid transition attempted | `{ state, event, data, reason }` |
| `$invoke.done` | Invoke promise resolved | `{ state, result }` |
| `$invoke.error` | Invoke promise rejected | `{ state, error }` |
| `$invoke.cancelled` | Invoke discarded (state changed) | `{ state }` |

## Constructor Validation

The constructor validates at creation time:

- Every transition target references an existing state
- `initial` references an existing state
- Final states have no `on` transitions
- Invoke `onDone`/`onError` targets reference existing states

## Patterns Summary

```ts
// Create machine
const machine = new StateMachine<Context, Events>(config)

// Send events
machine.send('EVENT')
machine.send('EVENT', data)

// Listen
const cleanup = machine.on('state', listener)
machine.on('*', listener)
machine.on('$rejected', listener)
machine.on(/pattern/, listener)
machine.off('state', listener)

// Coordinate
const hub = new StateHub({ a: machineA, b: machineB })
hub.connect({ from: 'a', enters: 'done', to: 'b', send: 'START' })
```
