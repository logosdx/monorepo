---
title: State Machine — API Reference
description: Complete API reference for StateMachine, StateHub, persistence, and types.
---

# API Reference


[[toc]]

## StateMachine

### Constructor

```typescript
new StateMachine<Context, Events>(
    config: StateMachine.Config<Context, Events>,
    options?: StateMachine.Options
)
```

**Type Parameters:**

- `Context` — The shape of the data the machine carries
- `Events` — Interface mapping event names to their data (`void` for no data)

**Config:**

- `initial: string` — Starting state (must exist in `transitions`)
- `context: Context` — Initial context value
- `transitions: Record<string, StateConfig>` — State definitions
- `debug?: boolean` — Enable spy logging to console

**Options:**

- `persistence?: { key: string, adapter: StorageAdapter }` — Persist state across sessions

**Example:**

```typescript
interface AuthContext {
    user: string | null
    token: string | null
}

interface AuthEvents {
    LOGIN: { user: string, token: string }
    LOGOUT: void
    SESSION_EXPIRED: void
}

const auth = new StateMachine<AuthContext, AuthEvents>({
    initial: 'loggedOut',
    context: { user: null, token: null },
    transitions: {
        loggedOut: {
            on: {
                LOGIN: {
                    target: 'loggedIn',
                    action: (ctx, data) => ({
                        user: data.user,
                        token: data.token,
                    }),
                },
            },
        },
        loggedIn: {
            on: {
                LOGOUT: {
                    target: 'loggedOut',
                    action: () => ({ user: null, token: null }),
                },
                SESSION_EXPIRED: {
                    target: 'loggedOut',
                    action: () => ({ user: null, token: null }),
                },
            },
        },
    },
})
```

### Properties

#### `state`

Current state name.

```typescript
auth.state // 'loggedOut'
```

#### `context`

Current context, cloned on access. Safe to read without affecting internal state.

```typescript
auth.context // { user: null, token: null }
```

### `send()`

Attempt a state transition.

```typescript
send<E extends keyof Events>(
    ...args: Events[E] extends void
        ? [event: E]
        : [event: E, data: Events[E]]
): void
```

Events with `void` data don't require a second argument. Non-void events require typed data.

```typescript
auth.send('LOGIN', { user: 'admin', token: 'abc123' })
auth.send('LOGOUT') // void event, no data needed
```

If the event is not valid for the current state or a guard returns false, the transition is silently rejected. No exception is thrown — the machine emits `$rejected` instead.

### Transition Targets

Transitions can be a string shorthand (just move to a state) or an object with action and/or guard:

```typescript
transitions: {
    idle: {
        on: {
            // String shorthand — just move
            FETCH: 'loading',

            // Object — move and modify context
            INCREMENT: {
                target: 'idle',
                action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
            },

            // Object with guard — conditional transition
            WITHDRAW: {
                target: 'idle',
                action: (ctx, data) => ({
                    ...ctx,
                    balance: ctx.balance - data.amount,
                }),
                guard: (ctx, data) => ctx.balance >= data.amount,
            },
        },
    },
}
```

### Guards

Guards prevent transitions when conditions aren't met. They receive the current context and event data, returning `true` to allow or `false` to block.

```typescript
const account = new StateMachine<
    { balance: number },
    { WITHDRAW: { amount: number } }
>({
    initial: 'active',
    context: { balance: 1000 },
    transitions: {
        active: {
            on: {
                WITHDRAW: {
                    target: 'active',
                    action: (ctx, data) => ({
                        balance: ctx.balance - data.amount,
                    }),
                    guard: (ctx, data) => ctx.balance >= data.amount,
                },
            },
        },
    },
})

account.send('WITHDRAW', { amount: 500 })  // ✅ goes through
account.send('WITHDRAW', { amount: 9000 }) // ❌ guard blocks, emits $rejected
```

### `on()`

Listen for state entries, wildcards, or patterns.

```typescript
on(
    event: string | RegExp,
    listener: (payload: TransitionPayload) => void,
    options?: { signal?: AbortSignal }
): Cleanup
```

**Returns:** Cleanup function to remove the listener.

```typescript
// Specific state entry
auth.on('loggedIn', ({ from, to, event, context, data }) => {
    console.log(`Logged in as ${context.user}`)
})

// Every transition
auth.on('*', ({ from, to }) => {
    analytics.track('state_change', { from, to })
})

// Regex pattern
auth.on(/loggedOut|expired/, (payload) => {
    redirectToLogin()
})

// Rejected transitions (debugging)
auth.on('$rejected', ({ state, event, reason }) => {
    console.warn(`"${event}" rejected in "${state}": ${reason}`)
})
```

### `off()`

Remove a listener.

```typescript
auth.off('loggedIn', specificListener)
```

### `ready()`

Returns a promise that resolves when the machine is hydrated from persistence. If no persistence is configured, resolves immediately.

```typescript
await machine.ready()
```

### Rejected Transitions

Invalid transitions are **no-ops, not exceptions**. The machine silently ignores events that aren't valid for the current state. This is by design — throwing would force callers to know what's valid before sending, which defeats the purpose of the FSM.

Rejected transitions are observable via the `$rejected` event:

```typescript
machine.on('$rejected', ({ state, event, data, reason }) => {
    // reason: 'no_transition' — event not defined for current state
    // reason: 'guard_failed' — guard returned false
    console.warn(`"${event}" rejected in "${state}" — ${reason}`)
})
```

## Invoke

Some states exist only to wait for an async operation. `invoke` lets the machine own that lifecycle.

```typescript
const api = new StateMachine<
    { users: User[], error: string | null },
    { FETCH: void, RETRY: void }
>({
    initial: 'idle',
    context: { users: [], error: null },
    transitions: {
        idle: {
            on: { FETCH: 'loading' },
        },
        loading: {
            invoke: {
                src: async (ctx) => {
                    const res = await fetch('/api/users')
                    return res.json()
                },
                onDone: {
                    target: 'idle',
                    action: (ctx, result) => ({ ...ctx, users: result }),
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

api.send('FETCH') // enters 'loading', invoke fires automatically
```

### Cancellation

If the machine transitions away before the invoke promise settles (e.g., user navigates away), the result is discarded. This prevents stale async results from corrupting state.

```typescript
api.on('$invoke.cancelled', ({ state }) => {
    console.log(`Invoke in "${state}" was cancelled`)
})
```

### Invoke Events

| Event | When | Payload |
|-------|------|---------|
| `$invoke.done` | Promise resolved | `{ state, result }` |
| `$invoke.error` | Promise rejected | `{ state, error }` |
| `$invoke.cancelled` | State changed before settle | `{ state }` |

### External Approach

Invoke is sugar. You can always manage async externally:

```typescript
machine.send('FETCH')

const [data, err] = await attempt(() => fetchUsers())
if (err) {
    machine.send('FAILURE', { message: err.message })
}
else {
    machine.send('SUCCESS', { users: data })
}
```

## Persistence

Persist machine state across page reloads or sessions with any storage backend.

### Storage Adapter Interface

```typescript
type StorageAdapter = {
    load: (key: string) => Promise<{ state: string, context: any } | null>
    save: (key: string, snapshot: { state: string, context: any }) => Promise<void>
}
```

### Usage

```typescript
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
```

### Hydration Behavior

1. On construction, calls `adapter.load(key)`
2. If snapshot found and state exists in config, hydrates state and context
3. If snapshot state no longer exists (config changed between deploys), falls back to `initial`
4. If no snapshot, uses `initial` and default `context`
5. After every transition, calls `adapter.save(key, { state, context })`

## StateHub

When multiple machines need to talk to each other, `StateHub` provides type-safe access and declarative wiring.

### Constructor

```typescript
const hub = new StateHub({
    auth: authMachine,
    checkout: checkoutMachine,
    notifications: notifMachine,
})
```

### `get()`

Returns a machine by key, fully typed.

```typescript
const auth = hub.get('auth')
auth.send('LOGIN', { user: 'admin', token: 'abc' })
```

### `connect()`

Wire machines together declaratively. Reads like a sentence: "when `auth` enters `loggedOut`, send `RESET` to `checkout`."

```typescript
hub.connect({
    from: 'auth',
    enters: 'loggedOut',
    to: 'checkout',
    send: 'RESET',
})

// With data mapping
hub.connect({
    from: 'checkout',
    enters: 'confirmed',
    to: 'notifications',
    send: 'NOTIFY',
    data: (ctx) => ({ message: `Order placed: ${ctx.items.length} items` }),
})
```

Returns a cleanup function:

```typescript
const cleanup = hub.connect({ ... })
cleanup() // tear down the connection
```

Machines stay independent and testable in isolation. The hub owns the wiring because it's the only thing that knows about all the machines.

## Constructor Validation

The machine validates at creation time:

- `initial` must reference a state in `transitions`
- Every transition `target` must reference an existing state
- Final states cannot have `on` transitions
- Invoke `onDone`/`onError` targets must reference existing states

Invalid configurations throw immediately with a descriptive error message.

## Debug Mode

Enable debug logging to see every transition and observer operation:

```typescript
const machine = new StateMachine({ ...config, debug: true })
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

## Type Definitions

### Core Types

```typescript
type TransitionAction<Context, Data> = (context: Context, data: Data) => Context

type TransitionGuard<Context, Data> = (context: Context, data: Data) => boolean

type TransitionTarget<Context, Data> = string | {
    target: string
    action?: TransitionAction<Context, Data>
    guard?: TransitionGuard<Context, Data>
}

type StateConfig<Context, Events> = {
    on?: { [E in keyof Events]?: TransitionTarget<Context, Events[E]> }
    invoke?: InvokeConfig<Context>
    final?: boolean
}

type InvokeConfig<Context> = {
    src: (context: Context) => Promise<any>
    onDone: TransitionTarget<Context>
    onError: TransitionTarget<Context>
}

type MachineConfig<Context, Events> = {
    initial: string
    context: Context
    transitions: Record<string, StateConfig<Context, Events>>
    debug?: boolean
}
```

### Payloads

```typescript
type TransitionPayload<Context> = {
    from: string
    to: string
    event: string
    context: Context
    data?: any
}

type RejectedPayload = {
    state: string
    event: string
    data?: any
    reason: 'no_transition' | 'guard_failed'
}
```

### Storage

```typescript
type StorageAdapter = {
    load: (key: string) => Promise<{ state: string, context: any } | null>
    save: (key: string, snapshot: { state: string, context: any }) => Promise<void>
}

type MachineOptions = {
    persistence?: {
        key: string
        adapter: StorageAdapter
    }
}
```

### Hub

```typescript
type ConnectConfig<Machines> = {
    from: keyof Machines
    enters: string
    to: keyof Machines
    send: string
    data?: (context: any) => any
}
```
