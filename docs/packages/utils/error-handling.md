---
title: Error Handling
description: Go-style error tuples for predictable error handling without try-catch blocks.
---

# Error Handling

## `attempt()`

Go-style error handling for async operations. Returns a tuple: `[result, error]`.

```ts
function attempt<T extends () => Promise<any>>(fn: T): Promise<ResultTuple<Awaited<ReturnType<T>>>>

type ResultTuple<T> = [T, null] | [null, Error]
```

**Parameters:**

- `fn` - Async function to execute safely

**Returns:** Promise resolving to `[result, null]` on success or `[null, error]` on failure

**Example:**

```ts
import { attempt } from '@logosdx/utils'

// Basic usage
const [user, err] = await attempt(() =>
    fetch('/api/users/123').then(r => r.json())
)

if (err) {

    console.error('Failed to fetch user:', err.message)
    return
}

console.log('User loaded:', user.name)

// With payment API
const [payment, paymentErr] = await attempt(() =>
    fetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({ amount: 10000, method: 'card' })
    }).then(r => r.json())
)

if (paymentErr) {

    if (paymentErr.message.includes('Payment details failed')) {

        showError('Payment processing failed - please check your details')
    }
    else {

        showError('Could not process your payment - please try again')
    }
    return
}

processPaymentConfirmation(payment)
```

**Best Practices:**

- Use for all I/O operations (fetch, database, file system)
- Don't use for pure business logic functions
- Always check the error before using the result

---

## `attemptSync()`

Synchronous version of `attempt()` for operations that might throw.

```ts
function attemptSync<T extends () => any>(fn: T): ResultTuple<ReturnType<T>>
```

**Parameters:**

- `fn` - Synchronous function to execute safely

**Returns:** `[result, null]` on success or `[null, error]` on failure

**Example:**

```ts
import { attemptSync } from '@logosdx/utils'

// JSON parsing (classic failure case)
const [data, parseErr] = attemptSync(() => JSON.parse(rawJson))

if (parseErr) {

    console.error('Invalid JSON:', parseErr.message)
    return defaultData
}

// Custom validation
const [validated, validationErr] = attemptSync(() => {

    if (!data.category) throw new Error('Category is required')

    if (!['premium', 'standard', 'basic'].includes(data.category)) {

        throw new Error('Invalid category')
    }

    return data
})

if (validationErr) {

    showError(`Validation failed: ${validationErr.message}`)
    return
}
```
