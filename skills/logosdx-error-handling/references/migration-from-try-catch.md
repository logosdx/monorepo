# Migration from try-catch

Step-by-step guide for replacing try-catch blocks with LogosDX error tuples.

## Step 1: Identify the Operation Type

| Operation | Pattern | Example |
|-----------|---------|---------|
| Async I/O | `attempt()` | Network calls, file reads, DB queries |
| Sync I/O | `attemptSync()` | JSON.parse, regex on untrusted input |
| Business logic | Direct call | Math, transforms, validations |

## Step 2: Apply the Pattern

### Async I/O Migration

```typescript
// Before
try {
    const response = await fetch('/api/users')
    const data = await response.json()
    return data
}
catch (err) {
    if (err instanceof TimeoutError) {
        return fallbackData
    }
    throw err
}

// After
const [response, err] = await attempt(() => api.get<User[]>('/users'))

if (err) {

    if (isTimeoutError(err)) return fallbackData
    throw err
}

return response.data
```

### Sync I/O Migration

```typescript
// Before
let config
try {
    config = JSON.parse(rawString)
}
catch {
    config = defaultConfig
}

// After
const [config, err] = attemptSync(() => JSON.parse(rawString))
if (err) config = defaultConfig
// or more concisely:
const [parsed] = attemptSync(() => JSON.parse(rawString))
const config = parsed ?? defaultConfig
```

### Business Logic — Remove the try-catch

```typescript
// Before — unnecessary try-catch hides bugs
try {
    const total = items.reduce((sum, item) => sum + item.price, 0)
    const tax = total * taxRate
    return total + tax
}
catch (err) {
    console.error('Calculation failed:', err)
    return 0
}

// After — if this throws, it's a bug that should surface
const total = items.reduce((sum, item) => sum + item.price, 0)
const tax = total * taxRate
return total + tax
```

## Step 3: Replace Error Type Checks

```typescript
// Before
catch (err) {
    if (err instanceof TypeError) { /* ... */ }
    if (err.message.includes('timeout')) { /* ... */ }
    if (err.code === 'ECONNREFUSED') { /* ... */ }
}

// After — use typed guards
if (err) {

    if (isTimeoutError(err)) { /* typed TimeoutError */ }
    if (isRetryError(err)) { /* typed RetryError */ }
    if (isFetchError(err)) { /* typed FetchError with .status, .method, .path */ }
}
```

## Step 4: Handle Sequential Operations

```typescript
// Before — nested try-catch
try {
    const user = await fetchUser(id)
    try {
        await updateProfile(user, changes)
        try {
            await sendNotification(user)
        }
        catch { /* ignore notification errors */ }
    }
    catch (err) {
        throw new Error('Profile update failed')
    }
}
catch (err) {
    console.error(err)
}

// After — flat, readable chain
const [user, fetchErr] = await attempt(() => fetchUser(id))
if (fetchErr) return console.error(fetchErr)

const [, updateErr] = await attempt(() => updateProfile(user, changes))
if (updateErr) throw new Error('Profile update failed')

// Fire-and-forget: ignore notification errors
attempt(() => sendNotification(user))
```

## Common Patterns After Migration

### Early return on error

```typescript
const [data, err] = await attempt(() => fetchData())
if (err) return handleError(err)
// continue with data...
```

### Rethrow with context

```typescript
const [data, err] = await attempt(() => fetchData())
if (err) throw new Error(`Failed to load dashboard: ${err.message}`)
```

### Fallback value

```typescript
const [data] = await attempt(() => fetchCachedData())
const result = data ?? computeFreshData()
```

### Multiple sequential operations

```typescript
const [user, userErr] = await attempt(() => fetchUser(id))
if (userErr) throw userErr

const [posts, postsErr] = await attempt(() => fetchPosts(user.id))
if (postsErr) throw postsErr

return { user, posts }
```
