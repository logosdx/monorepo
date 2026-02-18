---
title: State Machine
description: States that enforce themselves. Transitions that carry meaning.
---

# State Machine


Most state management libraries let you put anything anywhere. `@logosdx/state-machine` takes the opposite approach — you define which states exist, which events are valid in each state, and how context changes on transition. The machine enforces the rules so your code doesn't have to.

[[toc]]

## Installation


::: code-group

```bash [npm]
npm install @logosdx/state-machine
```

```bash [yarn]
yarn add @logosdx/state-machine
```

```bash [pnpm]
pnpm add @logosdx/state-machine
```

:::


**CDN:**

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/state-machine@latest/dist/browser.min.js"></script>
<script>
    const { StateMachine, StateHub } = LogosDx.StateMachine;
</script>
```

## Quick Start

```typescript
import { StateMachine } from '@logosdx/state-machine'

interface OrderContext {
    items: string[]
    error: string | null
}

interface OrderEvents {
    ADD_ITEM: { name: string }
    SUBMIT: void
    SUCCESS: { orderId: string }
    FAILURE: { message: string }
    RETRY: void
}

const order = new StateMachine<OrderContext, OrderEvents>({
    initial: 'draft',
    context: { items: [], error: null },
    transitions: {
        draft: {
            on: {
                ADD_ITEM: {
                    target: 'draft',
                    action: (ctx, data) => ({
                        ...ctx,
                        items: [...ctx.items, data.name],
                    }),
                },
                SUBMIT: 'submitting',
            },
        },
        submitting: {
            on: {
                SUCCESS: {
                    target: 'confirmed',
                    action: (ctx) => ({ ...ctx, error: null }),
                },
                FAILURE: {
                    target: 'error',
                    action: (ctx, data) => ({ ...ctx, error: data.message }),
                },
            },
        },
        error: {
            on: { RETRY: 'submitting' },
        },
        confirmed: { final: true },
    },
})

order.send('ADD_ITEM', { name: 'Widget' })
order.send('SUBMIT')
order.send('SUCCESS', { orderId: 'ORD-123' })

console.log(order.state)   // 'confirmed'
console.log(order.context) // { items: ['Widget'], error: null }
```

## Core Concepts

A `StateMachine` has three things: a **current state** (a string), a **context** (typed data), and a **transition map** that defines which events are valid in each state and what happens when they fire.

- **States** are strings like `'idle'`, `'loading'`, `'error'`
- **Events** are typed messages like `'FETCH'` or `'ADD_ITEM: { id: string }'`
- **Transitions** connect states through events, optionally modifying context via actions and preventing invalid moves via guards
- **Observer** powers the notification layer internally — you get `on()`, `off()`, regex matching, and cleanup functions for free

## The Three Layers

Every interaction with the machine falls into one of these categories:

### Actions

Pure functions that transform context during a transition. `(ctx, data) => newCtx`. No side effects. No async. Just data in, data out.

```typescript
// String shorthand — just move, don't touch context
FETCH: 'loading'

// Object — move and modify context
INCREMENT: {
    target: 'idle',
    action: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
}

// With guard — conditional transition
WITHDRAW: {
    target: 'idle',
    action: (ctx, data) => ({ ...ctx, balance: ctx.balance - data.amount }),
    guard: (ctx, data) => ctx.balance >= data.amount,
}
```

### Invoke

Async operations that feed results back into the machine as new transitions. The machine owns the lifecycle — it starts the work, waits, and transitions itself when the promise settles. If the machine leaves the state before the promise resolves, the result is discarded.

```typescript
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
}
```

### Listeners

Fire-and-forget. React to transitions but never touch the machine. Logging, analytics, updating the DOM, notifying other machines. One-way, outward.

```typescript
machine.on('error', ({ context }) => {
    errorService.report(context.error)
})

machine.on('*', ({ from, to }) => {
    analytics.track('state_change', { from, to })
})
```

**The rule is simple: actions transform, invoke feeds back, listeners observe.**

## What's Next

- **[API Reference](./api)** — Full details on `StateMachine`, `StateHub`, persistence, types, and every method
- **[Practical Guide](./guide)** — A complete checkout flow walkthrough showing how the three layers work together in a real application
