# React Hook API Reference

## Observer Hook

```typescript
const { on, once, oncePromise, emit, emitFactory, instance } = useAppObserver()
```

### on(event, callback)

Subscribe to events. Auto-cleans on unmount, re-subscribes when callback changes.

```typescript
// Wrap callback in useCallback for stable reference
const handler = useCallback((data: AppEvents['user:login']) => {

    setUser(data)
}, [])

on('user:login', handler)
```

### once(event, callback)

Subscribe to a single event occurrence. Auto-cleans on unmount.

```typescript
once('app:init', useCallback((config) => {

    initializeApp(config)
}, []))
```

### oncePromise(event)

Reactive tuple for one-shot events — no callback needed.

```typescript
const [waiting, data, cancel] = oncePromise('notification')

// waiting: boolean — true while waiting for event
// data: AppEvents['notification'] | null — payload when received
// cancel: () => void — stop waiting

if (waiting) return <Spinner />
if (data) return <Toast message={data.message} type={data.type} />
```

### emit(event, data)

Emit events. Stable reference — safe in dependency arrays.

```typescript
emit('auth:logout', { userId: '123' })

// Safe in onClick handlers
<button onClick={() => emit('auth:logout', { userId })}>Logout</button>
```

### emitFactory(event)

Create a memoized emitter for a specific event.

```typescript
const logout = emitFactory('auth:logout')

// Stable reference — safe in child component props
<LogoutButton onLogout={logout} />
```

### instance

Direct access to the `ObserverEngine` instance.

```typescript
const { instance } = useAppObserver()
// instance.on(), instance.emit(), instance.$facts(), etc.
```

## Fetch Hook

```typescript
const { get, post, put, del, patch, instance } = useApiFetch()
```

### Queries: get(path, options?)

Auto-fetches on mount, re-fetches when `path` or `options` change.

```typescript
const [cancel, isLoading, response, error] = get<User[]>('/users')

// cancel: () => void — abort the request
// isLoading: boolean
// response: FetchResponse<User[]> | null
// error: FetchError | null

if (isLoading) return <Spinner />
if (error) return <Error message={error.message} />
return <UserTable users={response.data} />
```

### Type response headers

```typescript
interface UserHeaders {
    'x-total-count': string
}

const [, , response] = get<User[], UserHeaders>('/users')
response?.headers['x-total-count']  // typed
```

### Mutations: post, put, del, patch

Start idle. Fire with the trigger function.

```typescript
const [submit, cancel, isSubmitting, result, error] = post<Comment>('/comments')

// submit: (payload?) => void — fire the mutation
// cancel: () => void — abort
// isSubmitting: boolean
// result: FetchResponse<Comment> | null
// error: FetchError | null

<form onSubmit={() => submit({ text: 'Hello' })}>
```

```typescript
const [remove, cancelRemove, isRemoving, , error] = del<void>(`/items/${id}`)

<button onClick={() => remove()} disabled={isRemoving}>Delete</button>
```

### instance (escape hatch)

Direct `FetchEngine` access for imperative use:

```typescript
const { instance } = useApiFetch()

const handleExport = async () => {

    const [res, err] = await attempt(() => instance.get('/export'))
    if (err) return showError(err)
    downloadFile(res.data)
}
```

## Storage Hook

```typescript
const { get, set, remove, assign, has, clear, wrap, keys, instance } = useAppStorage()
```

Any mutation triggers a re-render automatically.

```typescript
// Read
const theme = get('theme')          // single key, typed
const all = get()                   // all values

// Write
set('theme', 'dark')                // single
set({ theme: 'dark', userId: '42' }) // bulk

// Object merge
assign('preferences', { lang: 'es' }) // Object.assign on value

// Delete
remove('userId')
clear()                             // remove all prefixed keys

// Check
has('theme')                        // boolean
keys()                              // ['theme', 'userId', ...]

// Wrap — returns { get, set, remove, assign } for a single key
const themeStore = wrap('theme')
themeStore.get()      // current value
themeStore.set('dark') // update
```

## Localize Hook

```typescript
const { t, locale, changeTo, locales, instance } = useAppLocale()
```

```typescript
// Translate — type-safe keys, optional interpolation
const greeting = t('home.greeting', { name: 'World' })
const logout = t('nav.logout')

// Current locale
console.log(locale)  // 'en'

// Switch locale — triggers re-render, t() returns new translations
changeTo('es')

// Available locales
locales  // [{ code: 'en', text: 'English' }, { code: 'es', text: 'Espanol' }]
```

## Hook Rules Reminder

All hook methods (`on`, `once`, `oncePromise`, `emitFactory`, `get`, `post`, `put`, `del`, `patch`) call React hooks internally:

- Call at the **top level** of your component
- **Never** conditionally or in loops
- The matching Provider **must be an ancestor** in the tree

```typescript
// WRONG
function User({ showPosts }) {
    const { get } = useApiFetch()
    const [, , user] = get('/user')

    if (showPosts) {
        const [, , posts] = get('/posts')  // WRONG: conditional hook call
    }
}

// RIGHT
function User({ showPosts }) {
    const { get } = useApiFetch()
    const [, , user] = get('/user')
    const [, , posts] = get('/posts')  // always call, conditionally render

    return (
        <>
            <UserProfile data={user?.data} />
            {showPosts && <PostList data={posts?.data} />}
        </>
    )
}
```
