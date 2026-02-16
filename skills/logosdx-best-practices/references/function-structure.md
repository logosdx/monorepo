# The 4-Block Function Structure

Every non-trivial function in LogosDX follows this structure in order.

## The Blocks

1. **Declaration** — Declare variables and resources needed for execution
2. **Validation** — Validate inputs to prevent failures in business logic
3. **Business Logic** — The core transformation or computation
4. **Commit** — Side effects that change application state (I/O, persistence)

## Full Example

```typescript
async function updateUserEmail(userID: string, newEmail: string): Promise<User> {

    // Declaration
    const normalizedEmail = newEmail.trim().toLowerCase()

    // Validation
    if (!userID) throw new Error('userID is required')
    if (!normalizedEmail.includes('@')) throw new Error('Invalid email format')

    // Business Logic
    const [user, err] = await attempt(() => fetchUser(userID))
    if (err) throw err

    const updatedUser = { ...user, email: normalizedEmail }

    // Commit
    const [, saveErr] = await attempt(() => saveUser(updatedUser))
    if (saveErr) throw saveErr

    return updatedUser
}
```

## When Blocks Are Optional

Not every function has all four blocks. Use only what applies:

### Pure function (Business Logic only)

```typescript
function calculateDiscount(price: number, tier: CustomerTier): number {

    const rates = { bronze: 0.05, silver: 0.10, gold: 0.15 }
    return price * (rates[tier] ?? 0)
}
```

### Validation + Business Logic

```typescript
function parseConfig(raw: unknown): AppConfig {

    assert(isObject(raw), 'Config must be an object')
    assert(typeof raw.baseUrl === 'string', 'baseUrl is required')

    return {
        baseUrl: raw.baseUrl,
        timeout: raw.timeout ?? 5000,
        retries: raw.retries ?? 3,
    }
}
```

### All four blocks

```typescript
async function processOrder(orderId: string, payment: PaymentInfo): Promise<Receipt> {

    // Declaration
    const timestamp = Date.now()

    // Validation
    assert(orderId, 'orderId is required')
    assert(payment.amount > 0, 'Payment amount must be positive')

    // Business Logic
    const [order, fetchErr] = await attempt(() => fetchOrder(orderId))
    if (fetchErr) throw fetchErr

    const receipt = buildReceipt(order, payment, timestamp)

    // Commit
    const [, chargeErr] = await attempt(() => chargePayment(payment))
    if (chargeErr) throw chargeErr

    const [, saveErr] = await attempt(() => saveReceipt(receipt))
    if (saveErr) throw saveErr

    return receipt
}
```
