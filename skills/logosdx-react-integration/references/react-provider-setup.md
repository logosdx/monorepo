# React Provider Setup

## Complete Setup Pattern

```typescript
// setup.ts — create at module scope
import { ObserverEngine } from '@logosdx/observer'
import { FetchEngine } from '@logosdx/fetch'
import { StorageAdapter } from '@logosdx/storage'
import { LocaleManager } from '@logosdx/localize'
import {
    createObserverContext,
    createFetchContext,
    createStorageContext,
    createLocalizeContext,
    composeProviders,
} from '@logosdx/react'

// Define types
interface AppEvents {
    'auth:login': { userId: string; token: string }
    'auth:logout': { userId: string }
    'notification': { message: string; type: 'info' | 'error' }
}

interface AppStore {
    theme: 'light' | 'dark'
    userId: string
    token: string
}

// Create engines
const observer = new ObserverEngine<AppEvents>()

const api = new FetchEngine({
    baseUrl: 'https://api.example.com',
    retry: { maxAttempts: 3 },
    modifyConfig: (opts, state) => {

        if (state.token) opts.headers.Authorization = `Bearer ${state.token}`
        return opts
    },
})

const storage = new StorageAdapter<AppStore>(localStorage, 'myapp')
const i18n = new LocaleManager({ current: 'en', fallback: 'en', locales })

// Wire cross-engine communication
observer.on('auth:login', ({ token, userId }) => {

    api.state.set({ token })
    storage.set({ token, userId })
})

observer.on('auth:logout', () => {

    api.state.set({ token: null })
    storage.remove(['token', 'userId'])
})

// Export [Provider, useHook] pairs
export const [AppObserver, useAppObserver] = createObserverContext(observer)
export const [ApiFetch, useApiFetch] = createFetchContext(api)
export const [AppStorage, useAppStorage] = createStorageContext(storage)
export const [AppLocale, useAppLocale] = createLocalizeContext(i18n)

// Compose into single provider
export const Providers = composeProviders(
    AppObserver,
    ApiFetch,
    AppStorage,
    AppLocale,
)
```

## Root Component

```tsx
// main.tsx
import { Providers } from './setup'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <Providers>
        <App />
    </Providers>
)
```

## Why Module Scope?

Engines are **stateful singletons**. Creating them inside a component means:
- New instance on every render
- Lost state (headers, auth tokens, listeners)
- Memory leaks (old instances not cleaned up)

```typescript
// WRONG — inside component
function App() {
    const api = new FetchEngine({ baseUrl: '/api' })  // new instance every render!
    const [Provider, useHook] = createFetchContext(api) // new context every render!
}

// RIGHT — module scope
const api = new FetchEngine({ baseUrl: '/api' })
const [ApiFetch, useApiFetch] = createFetchContext(api)
```

## Why Tuples, Not Objects?

Factories return `[Provider, useHook]` like React's `useState`:

```typescript
// Tuples — rename naturally
const [ChatObserver, useChatEvents] = createObserverContext(chatEngine)
const [ApiObserver, useApiObserver] = createObserverContext(apiEngine)

// Objects would need verbose aliasing
const { Provider: ChatObserver, useHook: useChatEvents } = createObserverContext(chatEngine)
```

## composeProviders Details

Eliminates nested provider trees. First entry = outermost wrapper:

```typescript
// Without composeProviders
<AppObserver>
    <ApiFetch>
        <AppStorage>
            <AppLocale>
                <App />
            </AppLocale>
        </AppStorage>
    </ApiFetch>
</AppObserver>

// With composeProviders
const Providers = composeProviders(AppObserver, ApiFetch, AppStorage, AppLocale)
<Providers><App /></Providers>
```

### Providers with Props

Some providers need configuration beyond `children`:

```typescript
const Providers = composeProviders(
    AppObserver,
    [ThemeProvider, { theme: 'dark' }],  // tuple: [Component, props]
    ApiFetch,
)
```

### Empty Providers

```typescript
const NoOp = composeProviders()
// Renders children as-is — useful for conditional composition
```

## Multiple Contexts of the Same Type

```typescript
// Two observer engines for different domains
const chatObserver = new ObserverEngine<ChatEvents>()
const systemObserver = new ObserverEngine<SystemEvents>()

const [ChatProvider, useChatEvents] = createObserverContext(chatObserver)
const [SystemProvider, useSystemEvents] = createObserverContext(systemObserver)

// Both can be composed together
const Providers = composeProviders(ChatProvider, SystemProvider)
```
