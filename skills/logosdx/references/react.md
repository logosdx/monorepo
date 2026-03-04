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
// Returns { data, loading, error, response, refetch, cancel }
const { data, loading, error, response, refetch, cancel } = get<User[]>('/users')
const { response: res2 } = get<Post, { 'x-total': string }>('/posts')  // typed response headers

// Mutation — starts idle, fires when mutate() is called
// Returns { data, loading, error, response, mutate, reset, cancel, called }
const { mutate: submit, loading: isSubmitting, data: result, error: submitErr } = post<Comment>('/comments')
const { mutate: remove, loading: isRemoving, error: removeErr } = del<void>('/items/123')

// mutate() returns Promise<T> — await in handlers
const comment = await submit({ text: 'Hello' })
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

## API Hooks (Apollo-Style)


Higher-level hooks for API interactions. Return `{ data, loading, error }` objects. Auto-refetch on reactive config changes. ObserverEngine integration for event-driven invalidation.

### Setup

```typescript
import { FetchEngine } from '@logosdx/fetch'
import { ObserverEngine } from '@logosdx/observer'
import { createApiHooks } from '@logosdx/react/api'

interface LoanEvents {
    'loan.created': { id: string; amount: number }
    'loan.deleted': { id: string }
}

const api = new FetchEngine({ baseUrl: '/api' })
const events = new ObserverEngine<LoanEvents>()

const { useQuery, useMutation, useAsync, createQuery, createMutation } = createApiHooks(api, events)
```

### useQuery — Auto-Fetch with Reactive Config

```typescript
const { data, loading, error, refetch, cancel } = useQuery<Loan[]>('/loans', {
    defaults: { headers: { 'X-Api-Version': '2' } },    // Fixed — no re-fetch
    reactive: { params: { page, limit: 20 } },           // Watched — changes trigger re-fetch
    skip: !isReady,                                       // Conditional execution
    pollInterval: 30000,                                  // Re-fetch every 30s
    invalidateOn: ['loan.created', 'loan.deleted'],       // Re-fetch on observer event
})
```

### useMutation — Fire on Demand

```typescript
const { mutate, loading, error, data, called, reset, cancel } = useMutation<Loan>('post', '/loans', {
    defaults: { headers: { 'Content-Type': 'application/json' } },
    emitOnSuccess: 'loan.created',                        // Emit observer event on success
})

// mutate() returns Promise<T> — await in handlers
const loan = await mutate({ amount: 50000, borrower: 'Alice' })

// emitOnSuccess supports: string | { event, payload? } | array of either
emitOnSuccess: [
    'loan.created',
    { event: 'audit.log', payload: (data) => ({ action: 'create', entity: data }) },
]
```

### useAsync — Wrap Any Async Function

```typescript
class LoanApi extends FetchEngine {
    getLoans(page: number) { return this.get<Loan[]>('/loans', { params: { page } }) }
}

const { data, loading, error } = useAsync<Loan[]>(
    () => loanApi.getLoans(page),
    [page],                                                // React deps — re-executes on change
    { invalidateOn: ['loan.created'] },
)
// Auto-unwraps FetchResponse — data is Loan[], not FetchResponse<Loan[]>
```

### Factory Functions — Reusable Hooks

```typescript
// Define once at module level
const useLoans = createQuery<Loan[]>('/loans', {
    invalidateOn: ['loan.created', 'loan.deleted'],
})
const useCreateLoan = createMutation<Loan>('post', '/loans', {
    emitOnSuccess: 'loan.created',
})

// Use in any component
const { data } = useLoans({ reactive: { params: { page: 1 } } })
const { mutate } = useCreateLoan()
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
import { createApiHooks, useQuery, useMutation, useAsync } from '@logosdx/react/api'
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
const { data } = get<User[]>('/users')                         // data is User[] | null
const { response } = get<Post, { 'x-total': string }>('/posts')  // response?.headers['x-total'] typed
```

