---
title: State Machine — Practical Guide
description: A complete checkout flow walkthrough showing how the three layers work together.
---

# Practical Guide: The Checkout Flow


This guide walks through a real checkout flow to show how actions, invoke, and listeners work together. It's the mental model for thinking about state machines in practice.

[[toc]]

## The Core Idea

A state machine has three jobs:

1. **Know where you are** — a single, named state at any point in time
2. **Enforce what's possible** — only certain events are valid in certain states
3. **Carry data** — context that can only change through valid transitions

Everything else — notifications, side effects, async work — layers on top of these three.

## The Three Layers

Every interaction with the machine falls into one of these categories:

**Actions** — Pure functions. Transform context during a transition. `(ctx, data) => newCtx`. No side effects. No async. Just data in, data out.

**Invoke** — Async operations that feed results back into the machine as new transitions. The machine owns the lifecycle — it starts the work, waits, and transitions itself when the promise settles.

**Listeners** — Fire-and-forget. React to transitions but never touch the machine. Logging, analytics, updating the DOM, notifying other machines. One-way, outward.

**The rule is simple: actions transform, invoke feeds back, listeners observe.**

## The Checkout Flow

Here's what we're building:

1. User browses and adds items to cart
2. Each add triggers an inventory check (async)
3. User goes to checkout
4. Checkout loads their saved payment methods (async)
5. If no payment method exists, prompt them to add one
6. User pays
7. Payment processes (async), retrieves receipt
8. Show success with receipt

### The States

```
browsing → checkingInventory → browsing (loop)
                             → outOfStock

browsing → loadingPaymentMethods → readyToPay
                                 → addingPaymentMethod → readyToPay

readyToPay → processingPayment → success
                               → paymentFailed
```

### The Machine Definition

```typescript
interface CheckoutContext {
    items: CartItem[]
    inventory: Record<string, number>
    paymentMethods: PaymentMethod[]
    selectedPayment: PaymentMethod | null
    receipt: Receipt | null
    error: string | null
}

interface CheckoutEvents {
    ADD_ITEM: { id: string, name: string, price: number }
    REMOVE_ITEM: { id: string }
    CHECKOUT: void
    SELECT_PAYMENT: { method: PaymentMethod }
    ADD_PAYMENT_METHOD: { method: PaymentMethod }
    PAY: void
    RETRY: void
    BACK_TO_CART: void
}

const checkout = new StateMachine<CheckoutContext, CheckoutEvents>({
    initial: 'browsing',
    context: {
        items: [],
        inventory: {},
        paymentMethods: [],
        selectedPayment: null,
        receipt: null,
        error: null
    },
    transitions: {

        browsing: {
            on: {
                ADD_ITEM: {
                    target: 'checkingInventory',
                    action: (ctx, data) => ({
                        ...ctx,
                        items: [...ctx.items, data]
                    })
                },
                REMOVE_ITEM: {
                    target: 'browsing',
                    action: (ctx, data) => ({
                        ...ctx,
                        items: ctx.items.filter(i => i.id !== data.id)
                    })
                },
                CHECKOUT: {
                    target: 'loadingPaymentMethods',
                    guard: (ctx) => ctx.items.length > 0
                }
            }
        },

        checkingInventory: {
            invoke: {
                src: async (ctx) => {
                    const lastItem = ctx.items[ctx.items.length - 1]
                    const res = await fetch(`/api/inventory/${lastItem.id}`)
                    return res.json()
                },
                onDone: {
                    target: 'browsing',
                    action: (ctx, result) => ({
                        ...ctx,
                        inventory: {
                            ...ctx.inventory,
                            [result.id]: result.quantity
                        }
                    })
                },
                onError: {
                    target: 'outOfStock',
                    action: (ctx, err) => ({
                        ...ctx,
                        items: ctx.items.slice(0, -1),
                        error: err.message
                    })
                }
            }
        },

        outOfStock: {
            on: {
                BACK_TO_CART: {
                    target: 'browsing',
                    action: (ctx) => ({ ...ctx, error: null })
                }
            }
        },

        loadingPaymentMethods: {
            invoke: {
                src: async () => {
                    const res = await fetch('/api/payment-methods')
                    return res.json()
                },
                onDone: {
                    target: 'decidingPayment',
                    action: (ctx, methods) => ({
                        ...ctx,
                        paymentMethods: methods
                    })
                },
                onError: {
                    target: 'browsing',
                    action: (ctx, err) => ({ ...ctx, error: err.message })
                }
            }
        },

        decidingPayment: {
            on: {
                SELECT_PAYMENT: {
                    target: 'readyToPay',
                    guard: (ctx) => ctx.paymentMethods.length > 0,
                    action: (ctx, data) => ({
                        ...ctx,
                        selectedPayment: data.method
                    })
                },
                ADD_PAYMENT_METHOD: 'addingPaymentMethod'
            }
        },

        addingPaymentMethod: {
            on: {
                ADD_PAYMENT_METHOD: {
                    target: 'readyToPay',
                    action: (ctx, data) => ({
                        ...ctx,
                        paymentMethods: [...ctx.paymentMethods, data.method],
                        selectedPayment: data.method
                    })
                },
                BACK_TO_CART: 'browsing'
            }
        },

        readyToPay: {
            on: {
                PAY: 'processingPayment',
                BACK_TO_CART: 'browsing'
            }
        },

        processingPayment: {
            invoke: {
                src: async (ctx) => {
                    const res = await fetch('/api/pay', {
                        method: 'POST',
                        body: JSON.stringify({
                            items: ctx.items,
                            paymentMethod: ctx.selectedPayment
                        })
                    })
                    if (!res.ok) throw new Error('Payment failed')
                    return res.json()
                },
                onDone: {
                    target: 'success',
                    action: (ctx, receipt) => ({ ...ctx, receipt })
                },
                onError: {
                    target: 'paymentFailed',
                    action: (ctx, err) => ({ ...ctx, error: err.message })
                }
            }
        },

        paymentFailed: {
            on: {
                RETRY: {
                    target: 'processingPayment',
                    action: (ctx) => ({ ...ctx, error: null })
                },
                BACK_TO_CART: {
                    target: 'browsing',
                    action: (ctx) => ({ ...ctx, error: null })
                }
            }
        },

        success: {
            final: true
        }
    }
})
```

## How Invoke Actually Works

This is the most important thing to understand. Invoke does **not** transition during execution. There are always two separate transitions with an async gap between them.

Here's what happens when the user clicks "Pay":

```
1. UI calls:  machine.send('PAY')

2. TRANSITION #1 (synchronous, instant):
   readyToPay ──PAY──▶ processingPayment
   - State is now 'processingPayment'
   - Context is unchanged
   - Listeners fire (UI shows spinner)
   - This transition is COMPLETE

3. INVOKE STARTS (async, after transition settles):
   - Machine calls src(context)
   - fetch('/api/pay', ...) begins
   - Machine is sitting in 'processingPayment'
   - Anyone reading machine.state gets 'processingPayment'
   - Time passes...

4. PROMISE SETTLES:
   - If resolved: machine internally handles '$invoke.done'
   - If rejected: machine internally handles '$invoke.error'

5. TRANSITION #2 (synchronous, instant):
   processingPayment ──$invoke.done──▶ success
   - State is now 'success'
   - Context updated with receipt (via onDone action)
   - Listeners fire (UI shows receipt)
   - This transition is COMPLETE
```

The machine is **never between states**. It's always in exactly one state. The async operation runs in the background while the machine waits.

### What If The User Navigates Away?

If the machine transitions out of `processingPayment` before the promise settles (e.g. the user hits "Cancel" and a `BACK_TO_CART` transition fires), the invoke result is **discarded**:

```
1. machine.send('PAY')          → enters processingPayment, invoke starts
2. machine.send('BACK_TO_CART') → enters browsing, invoke is now stale
3. ...time passes...
4. Promise resolves             → machine checks: am I still in processingPayment?
                                   No → discard result, emit $invoke.cancelled
```

This prevents stale API responses from corrupting your state. The machine tracks whether it's still in the state that started the invoke.

## Applying The Three Layers

### Actions (pure context transformations)

Actions run **during** a transition. They take the current context and event data, and return a new context. No side effects, no async, no DOM manipulation.

```typescript
// ADD_ITEM action — pure data transformation
action: (ctx, data) => ({
    ...ctx,
    items: [...ctx.items, data]
})

// onDone action for payment — just stores the receipt
action: (ctx, receipt) => ({
    ...ctx,
    receipt
})
```

You can test these in isolation:

```typescript
const ctx = { items: [{ id: '1', name: 'Shirt', price: 25 }], error: null }
const newCtx = addItemAction(ctx, { id: '2', name: 'Hat', price: 15 })
assert(newCtx.items.length === 2) // pure function, easy to test
```

### Invoke (async operations that feed back)

Invoke is for operations where **the machine needs the result to decide what to do next**. In the checkout flow, there are three:

```
checkingInventory     → GET /api/inventory/:id    → browsing or outOfStock
loadingPaymentMethods → GET /api/payment-methods   → decidingPayment
processingPayment     → POST /api/pay              → success or paymentFailed
```

Each one follows the same pattern: enter the state, kick off the promise, wait, transition based on the outcome. The machine owns the entire lifecycle.

### Listeners (fire-and-forget side effects)

Listeners react to transitions but **never send events back into the machine**. They're for everything that happens *because of* a transition but doesn't affect the machine's flow.

```typescript
// Analytics
checkout.on('success', ({ context }) => {
    analytics.track('purchase_completed', {
        items: context.items.length,
        total: context.items.reduce((sum, i) => sum + i.price, 0)
    })
})

// Notifications via hub
hub.connect({
    from: 'checkout',
    enters: 'success',
    to: 'notifications',
    send: 'NOTIFY',
    data: (ctx) => ({ message: 'Order confirmed!' })
})

// Error logging
checkout.on('paymentFailed', ({ context }) => {
    errorService.report('Payment failed', { error: context.error })
})

// Debug observability
checkout.on('$rejected', ({ state, event, reason }) => {
    console.warn(`[checkout] "${event}" rejected in "${state}" — ${reason}`)
})
```

## What The UI Sees

A React component consuming this machine only needs two things: the current state (to know what to render) and the send function (to dispatch events).

```tsx
function CheckoutPage() {
    const { state, selected: ctx, send } = useStateMachine(hub, 'checkout')

    switch (state) {
        case 'browsing':
            return <ProductList
                items={ctx.items}
                onAdd={(item) => send('ADD_ITEM', item)}
                onCheckout={() => send('CHECKOUT')}
            />

        case 'checkingInventory':
            return <ProductList items={ctx.items} checking />

        case 'outOfStock':
            return <OutOfStockMessage
                error={ctx.error}
                onBack={() => send('BACK_TO_CART')}
            />

        case 'loadingPaymentMethods':
            return <Spinner message="Loading payment methods..." />

        case 'decidingPayment':
            return ctx.paymentMethods.length > 0
                ? <PaymentPicker
                    methods={ctx.paymentMethods}
                    onSelect={(m) => send('SELECT_PAYMENT', { method: m })}
                  />
                : <AddPaymentForm
                    onAdd={(m) => send('ADD_PAYMENT_METHOD', { method: m })}
                  />

        case 'addingPaymentMethod':
            return <AddPaymentForm
                onAdd={(m) => send('ADD_PAYMENT_METHOD', { method: m })}
                onBack={() => send('BACK_TO_CART')}
            />

        case 'readyToPay':
            return <OrderSummary
                items={ctx.items}
                payment={ctx.selectedPayment}
                onPay={() => send('PAY')}
                onBack={() => send('BACK_TO_CART')}
            />

        case 'processingPayment':
            return <Spinner message="Processing payment..." />

        case 'paymentFailed':
            return <PaymentError
                error={ctx.error}
                onRetry={() => send('RETRY')}
                onBack={() => send('BACK_TO_CART')}
            />

        case 'success':
            return <Receipt receipt={ctx.receipt} />
    }
}
```

Notice: **no `if (isLoading && !isError && data)` checks.** The state is a single string. Each branch is one state. The machine guarantees you're only ever in one of these at a time, and the context is always consistent with the state you're in.

## What Can't Happen

This is where the machine earns its keep. These are all impossible:

- **Paying without items** — the `CHECKOUT` transition has a guard: `ctx.items.length > 0`. If the cart is empty, the event is ignored.
- **Double-paying** — once you're in `processingPayment`, there's no `PAY` event defined. Clicking the pay button again does nothing.
- **Stale inventory check corrupting the cart** — if the user navigates away from `checkingInventory` before the check completes, the invoke result is discarded.
- **Showing a receipt while payment is still processing** — you can only reach `success` through `processingPayment`'s invoke `onDone`. There's no shortcut.
- **Getting stuck in a loading state** — every invoke has both `onDone` and `onError`. The promise always settles, and the machine always transitions.

You don't have to think about these cases. The machine's transition map makes them structurally impossible.

## The Full Picture

```
┌──────────────────────────────────────────────────────────┐
│                     StateMachine                         │
│                                                          │
│  ┌─────────┐   ADD_ITEM   ┌───────────────────┐         │
│  │browsing │──────────────▶│checkingInventory  │         │
│  │         │◀──────────────│  invoke: GET      │         │
│  │         │   (onDone)    │  /api/inventory   │         │
│  └────┬────┘               └────────┬──────────┘         │
│       │                             │ (onError)          │
│       │ CHECKOUT                    ▼                    │
│       │                    ┌──────────────┐              │
│       │                    │ outOfStock   │              │
│       │                    └──────────────┘              │
│       ▼                                                  │
│  ┌────────────────────────┐                              │
│  │loadingPaymentMethods   │                              │
│  │  invoke: GET           │                              │
│  │  /api/payment-methods  │                              │
│  └────────┬───────────────┘                              │
│           │ (onDone)                                     │
│           ▼                                              │
│  ┌──────────────────┐    ┌──────────────────────┐        │
│  │ decidingPayment  │───▶│ addingPaymentMethod  │        │
│  └────────┬─────────┘    └──────────┬───────────┘        │
│           │ SELECT_PAYMENT          │ ADD_PAYMENT_METHOD  │
│           ▼                         │                    │
│  ┌──────────────┐◀──────────────────┘                    │
│  │ readyToPay   │                                        │
│  └──────┬───────┘                                        │
│         │ PAY                                            │
│         ▼                                                │
│  ┌─────────────────────┐                                 │
│  │ processingPayment   │                                 │
│  │   invoke: POST      │                                 │
│  │   /api/pay          │                                 │
│  └───┬─────────────┬───┘                                 │
│      │ (onDone)    │ (onError)                           │
│      ▼             ▼                                     │
│  ┌─────────┐  ┌───────────────┐                          │
│  │ success │  │ paymentFailed │──RETRY──▶ processing     │
│  │ (final) │  └───────────────┘                          │
│  └─────────┘                                             │
│                                                          │
│  Observer (internal)                                     │
│  ├── emits state name on every transition                │
│  ├── emits '*' for wildcard listeners                    │
│  ├── emits '$rejected' for invalid events                │
│  ├── emits '$invoke.done/error/cancelled'                │
│  └── powers machine.on() / machine.off()                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```
