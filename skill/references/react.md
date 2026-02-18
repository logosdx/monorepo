---
description: Usage patterns for the @logosdx/react package.
globs: *.ts, *.tsx
---

# @logosdx/react Usage Patterns


React bindings for LogosDX engines. Factory-pattern context providers and hooks with full type inference.

## Contents

- Core Pattern
- Observer Hook
- Fetch Hook
- Storage Hook
- Localize Hook
- Why Tuples, Not Objects?
- composeProviders
- Hook Rules
- Type Inference
- Production Pattern

## Core Pattern

Every factory takes an engine instance and returns a `[Provider, useHook]` tuple:

```typescript
import { ObserverEngine } from '@logosdx/observer'
import { FetchEngine } from '@logosdx/fetch'
import { StorageAdapter } from '@logosdx/storage'
import { LocaleManager } from '@logosdx/localize'
import {
    createObserverContext,
    createFetchContext,
    createStorageContext,
    createLocalizeContext,
} from '@logosdx/react'

// Create instances
const observer = new ObserverEngine<AppEvents>()
const api = new FetchEngine({ baseUrl: '/api' })
const storage = new StorageAdapter<AppStore>(localStorage, 'app')
const i18n = new LocaleManager<Locale, 'en' | 'es'>({ current: 'en', fallback: 'en', locales })

// Create context + hook pairs — rename freely
export const [AppObserver, useAppObserver] = createObserverContext(observer)
export const [ApiFetch, useApiFetch] = createFetchContext(api)
export const [AppStorage, useAppStorage] = createStorageContext(storage)
export const [AppLocale, useAppLocale] = createLocalizeContext(i18n)
```

Compose providers into a single wrapper:

```typescript
import { composeProviders } from '@logosdx/react'

// First entry = outermost wrapper
export const Providers = composeProviders(
    AppObserver,
    ApiFetch,
    AppStorage,
    AppLocale,
)
```

```tsx
<Providers>
    <App />
</Providers>
```

Providers that need props beyond children use `[Provider, props]` tuples:

```typescript
const Providers = composeProviders(
    AppObserver,
    [ThemeProvider, { theme: 'dark' }],
    ApiFetch,
)
```

## Observer Hook

```typescript
const { on, once, oncePromise, emit, emitFactory, instance } = useAppObserver()

// Subscribe — auto-cleans on unmount, re-subscribes on callback change
const handler = useCallback((data) => console.log(data.userId), [])
on('user.login', handler)

// One-shot with callback
once('app.init', useCallback((cfg) => bootstrap(cfg), []))

// One-shot reactive tuple — no callback needed
const [waiting, data, cancel] = oncePromise('notification')
// waiting: boolean, data: Shape[E] | null, cancel: () => void

// Emit directly (stable, bound to engine)
emit('user.logout', { userId: '123' })

// Memoized emitter for a specific event
const logout = emitFactory('user.logout')
// <button onClick={() => logout({ userId: '123' })} />
```

## Fetch Hook

```typescript
const { get, post, put, del, patch, instance } = useApiFetch()

// Query — auto-fetches on mount, re-fetches when path/options change
// Returns [cancel, isLoading, response, error]
const [cancel, isLoading, res, error] = get<User[]>('/users')
const [, , res2] = get<Post, { 'x-total': string }>('/posts')  // typed response headers

// Mutation — starts idle, fires when triggered
// Returns [trigger, cancel, isLoading, response, error]
const [submit, cancelSubmit, isSubmitting, result, submitErr] = post<Comment>('/comments')
const [remove, cancelRemove, isRemoving, , removeErr] = del<void>('/items/123')

// Fire mutation
submit({ text: 'Hello' })
remove()

// Escape hatch for imperative use
const { instance } = useApiFetch()
const handleExport = async () => {
    const [res, err] = await attempt(() => instance.get('/export'))
}
```

## Storage Hook

```typescript
const { get, set, remove, assign, has, clear, wrap, keys, instance } = useAppStorage()

// Any mutation triggers a re-render automatically
const theme = get('theme')          // read single key
const all = get()                   // read all values
set('theme', 'dark')                // set single
set({ theme: 'dark', userId: '42' }) // bulk set
remove('userId')                    // remove key
assign('preferences', { lang: 'es' }) // Object.assign on value
has('theme')                        // boolean
clear()                             // remove all prefixed keys
wrap('theme')                       // { get, set, remove, assign }
keys()                              // ['theme', 'userId', ...]
```

## Localize Hook

```typescript
const { t, locale, changeTo, locales, instance } = useAppLocale()

// Translate with type-safe keys and optional interpolation
const greeting = t('home.greeting', { name: 'World' })
const logout = t('nav.logout')

// Current locale code
console.log(locale) // 'en'

// Switch locale — triggers re-render, t() returns new language
changeTo('es')

// All available locales
locales // [{ code: 'en', text: 'English' }, { code: 'es', text: 'Español' }]
```

## Why Tuples, Not Objects?

Factories return `[Provider, useHook]` tuples (like `useState`) instead of objects:

```typescript
// Tuples — rename naturally, no aliasing syntax
const [ChatObserver, useChatEvents] = createObserverContext(chatEngine)
const [ApiObserver, useApiObserver] = createObserverContext(apiEngine)

// Objects would require verbose aliasing
const { Provider: ChatObserver, useHook: useChatEvents } = createObserverContext(chatEngine)
```

Free renaming, less verbose, and follows React's own hook convention.

## composeProviders

Eliminates nested provider trees. First entry = outermost wrapper:

```typescript
import { composeProviders } from '@logosdx/react'

const Providers = composeProviders(AppObserver, ApiFetch, AppStorage, AppLocale)

// With props for providers that need configuration:
const Providers = composeProviders(
    AppObserver,
    [ThemeProvider, { theme: 'dark' }],
    ApiFetch,
)

// Empty = pass-through (children rendered as-is)
const NoOp = composeProviders()
```

## Hook Rules

All hook methods (`on`, `once`, `oncePromise`, `emitFactory`, `get`, `post`, `put`, `del`, `patch`) call React hooks internally:

- Call at the top level of your component
- Never conditionally or in loops
- Provider must be an ancestor in the component tree

## Type Inference

All generics are inferred from the engine instance — no manual type params needed:

```typescript
// Engine types flow through automatically
const api = new FetchEngine<CustomHeaders, CustomParams, ApiState>({ baseUrl: '/api' })
const [, useApiFetch] = createFetchContext(api)

// instance preserves the full FetchEngine<CustomHeaders, CustomParams, ApiState> type
const { instance } = useApiFetch()
instance.headers.set('X-Custom', 'value') // typed

// Per-call generics for response body and headers
const [, , res] = get<User[]>('/users')           // res?.data is User[]
const [, , res2] = get<Post, { 'x-total': string }>('/posts')  // res2?.headers['x-total'] typed
```

## Production Pattern

```typescript
// setup.ts
import { ObserverEngine } from '@logosdx/observer'
import { FetchEngine } from '@logosdx/fetch'
import { StorageAdapter } from '@logosdx/storage'
import { LocaleManager } from '@logosdx/localize'
import {
    createObserverContext,
    createFetchContext,
    createStorageContext,
    createLocalizeContext,
} from '@logosdx/react'

interface AppEvents {
    'auth.login': { userId: string; token: string }
    'auth.logout': { userId: string }
    'notification': { message: string; type: 'info' | 'error' }
}

interface AppStore {
    theme: 'light' | 'dark'
    userId: string
    token: string
}

const observer = new ObserverEngine<AppEvents>()

const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: { maxAttempts: 3 }
})

const storage = new StorageAdapter<AppStore>(localStorage, 'myapp')
const i18n = new LocaleManager({ current: 'en', fallback: 'en', locales })

// Wire auth state
observer.on('auth.login', ({ token, userId }) => {
    api.state.set({ token })
    storage.set({ token, userId })
})

observer.on('auth.logout', () => {
    api.state.set({ token: null })
    storage.remove(['token', 'userId'])
})

export const [AppObserver, useAppObserver] = createObserverContext(observer)
export const [ApiFetch, useApiFetch] = createFetchContext(api)
export const [AppStorage, useAppStorage] = createStorageContext(storage)
export const [AppLocale, useAppLocale] = createLocalizeContext(i18n)
```
