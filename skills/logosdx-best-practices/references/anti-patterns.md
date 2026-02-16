# Anti-Patterns

Common mistakes when writing LogosDX code and their corrections.

## Error Handling

### Using try-catch instead of attempt

```typescript
// WRONG
try {
    const response = await fetch('/api/users')
    const data = await response.json()
    return data
}
catch (err) {
    console.error('Failed:', err)
    return null
}

// RIGHT
const [response, err] = await attempt(() => api.get<User[]>('/users'))
if (err) {
    console.error('Failed:', err)
    return null
}
return response.data
```

### Wrapping business logic in error tuples

```typescript
// WRONG — business logic should not fail; wrapping hides bugs
const [total, err] = attemptSync(() => items.reduce((s, i) => s + i.price, 0))

// RIGHT — let pure logic throw naturally (it's a bug if it fails)
const total = items.reduce((s, i) => s + i.price, 0)
```

### Not checking error before using result

```typescript
// WRONG — result is null when err exists
const [user, err] = await attempt(() => fetchUser(id))
console.log(user.name) // TypeError if err!

// RIGHT
const [user, err] = await attempt(() => fetchUser(id))
if (err) throw err
console.log(user.name) // safe
```

## Resource Management

### Forgetting cleanup functions

```typescript
// WRONG — listener leaks, never removed
observer.on('user:login', handleLogin)
html.events.on(button, 'click', handleClick)

// RIGHT — store and call on teardown
const cleanups = [
    observer.on('user:login', handleLogin),
    html.events.on(button, 'click', handleClick),
]
onTeardown(() => cleanups.forEach(fn => fn()))
```

### Not destroying engines

```typescript
// WRONG — engine lives forever, leaks memory
function createApi() {
    return new FetchEngine({ baseUrl: '/api' })
}

// RIGHT — destroy when done
const api = new FetchEngine({ baseUrl: '/api' })
// ... use it ...
api.destroy()
```

## Function Structure

### Missing validation block

```typescript
// WRONG — business logic operates on potentially invalid data
async function updateEmail(userId: string, email: string): Promise<void> {

    const [user, err] = await attempt(() => fetchUser(userId))
    if (err) throw err
    user.email = email
    await saveUser(user)
}

// RIGHT — validate before business logic
async function updateEmail(userId: string, email: string): Promise<void> {

    if (!userId) throw new Error('userId is required')
    if (!email.includes('@')) throw new Error('Invalid email')

    const [user, err] = await attempt(() => fetchUser(userId))
    if (err) throw err

    user.email = email

    const [, saveErr] = await attempt(() => saveUser(user))
    if (saveErr) throw saveErr
}
```

### Mixing declaration, validation, and logic blocks

```typescript
// WRONG — blocks are interleaved
async function process(items: Item[]) {

    const result = []                    // declaration
    for (const item of items) {          // logic
        if (!item.id) throw new Error()  // validation inside logic!
        result.push(transform(item))
    }
    return result
}

// RIGHT — validate all inputs up front, then process
async function process(items: Item[]) {

    if (!items.every(i => i.id)) throw new Error('All items need IDs')

    return items.map(transform)
}
```

## TypeScript

### Not using typed error guards

```typescript
// WRONG — loses type information
const [result, err] = await attempt(() => resilientCall())
if (err) {
    if (err.message.includes('timeout')) { /* ... */ }  // fragile
}

// RIGHT — use provided type guards
import { isTimeoutError, isCircuitBreakerError, isRetryError } from '@logosdx/utils'

if (err) {
    if (isTimeoutError(err)) { /* typed TimeoutError */ }
    else if (isCircuitBreakerError(err)) { /* typed CircuitBreakerError */ }
    else if (isRetryError(err)) { /* typed RetryError */ }
}
```

### Not using package imports in production code

```typescript
// WRONG — relative imports in production code
import { attempt } from '../../../utils/src/index.ts'

// RIGHT — package imports in production
import { attempt } from '@logosdx/utils'

// NOTE: Tests use relative imports to validate implementation
// import { attempt } from '../../../../packages/utils/src/index.ts'
```
