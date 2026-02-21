---
description: Usage patterns for the @logosdx/react package.
globs: '*.ts, *.tsx'
---

# @logosdx/react Usage Patterns


React bindings for LogosDX engines. Factory-pattern context providers and hooks with full type inference.

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
    createStateMachineContext,
} from '@logosdx/react'

// Create instances
const observer = new ObserverEngine<AppEvents>()
const api = new FetchEngine({ baseUrl: '/api' })
const storage = new StorageAdapter<AppStore>({
    driver: new WebStorageDriver(localStorage),
    prefix: 'app',
})
const i18n = new LocaleManager<Locale, 'en' | 'es'>({ current: 'en', fallback: 'en', locales })
const machine = new StateMachine<Ctx, Events, States>({ initial: 'idle', context: {}, transitions: {} })

// Create context + hook pairs — rename freely
export const [AppObserver, useAppObserver] = createObserverContext(observer)
export const [ApiFetch, useApiFetch] = createFetchContext(api)
export const [AppStorage, useAppStorage] = createStorageContext(storage)
export const [AppLocale, useAppLocale] = createLocalizeContext(i18n)
export const [GameProvider, useGame] = createStateMachineContext(machine)
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
    GameProvider,
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
const { get, set, remove, assign, has, clear, scope, keys, instance } = useAppStorage()

// Any mutation triggers a re-render automatically
const theme = get('theme')          // read single key
const all = get()                   // read all values
set('theme', 'dark')                // set single
set({ theme: 'dark', userId: '42' }) // bulk set
remove('userId')                    // remove key
assign('preferences', { lang: 'es' }) // Object.assign on value
has('theme')                        // boolean
clear()                             // remove all prefixed keys
scope('theme')                      // scoped adapter for a single key
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

## State Machine Hook

Two options: `createStateMachineContext` for context-based sharing, or `useStateMachine` as a standalone hook.

```typescript
// Context + hook tuple (shared via Provider)
const [GameProvider, useGame] = createStateMachineContext(machine)

// Usage in component
const { state, context, send, instance } = useGame()
send('SCORE', 10)

// Standalone hook (no Provider needed)
import { useStateMachine } from '@logosdx/react/state-machine'
const { state, context, send } = useStateMachine(machine)

// Selector — only re-renders when selected value changes
const { context: score } = useGame((ctx) => ctx.score)
const { context: score } = useStateMachine(machine, (ctx) => ctx.score)
```

## Subpath Imports

Each binding is available as a standalone subpath export. Peer deps only required for imported bindings:

```typescript
import { createStorageContext } from '@logosdx/react/storage'
import { useStateMachine } from '@logosdx/react/state-machine'
import { createObserverContext } from '@logosdx/react/observer'
import { createFetchContext } from '@logosdx/react/fetch'
import { createLocalizeContext } from '@logosdx/react/localize'
import { composeProviders } from '@logosdx/react/compose'
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

