---
name: logosdx-react-integration
description: "Use when integrating LogosDX engines into React applications. Covers factory context pattern, composeProviders, hooks for observer/fetch/storage/localize, auto-cleanup, and type inference."
license: MIT
metadata:
  author: logosdx
  version: "1.0"
---

## Quick Start

```typescript
// setup.ts
import { ObserverEngine } from '@logosdx/observer'
import { FetchEngine } from '@logosdx/fetch'
import { createObserverContext, createFetchContext, composeProviders } from '@logosdx/react'

// 1. Create engines at module scope (outside components)
const observer = new ObserverEngine<AppEvents>()
const api = new FetchEngine({ baseUrl: '/api' })

// 2. Create [Provider, useHook] pairs — rename freely
export const [AppObserver, useAppObserver] = createObserverContext(observer)
export const [ApiFetch, useApiFetch] = createFetchContext(api)

// 3. Compose providers into one wrapper
export const Providers = composeProviders(AppObserver, ApiFetch)
```

```tsx
// App.tsx
<Providers>
    <App />
</Providers>
```

```typescript
// UserList.tsx
function UserList() {

    const { get } = useApiFetch()
    const { on, emit } = useAppObserver()

    // Auto-fetches on mount, re-fetches when path changes
    const [cancel, isLoading, response, error] = get<User[]>('/users')

    // Subscribe — auto-cleans on unmount
    on('user:created', useCallback(() => cancel(), []))

    if (isLoading) return <Spinner />
    if (error) return <Error message={error.message} />
    return <UserTable users={response.data} />
}
```

## Critical Rules

1. **Create engines at module scope**, not inside components. Engines are stateful singletons — creating them in a component causes re-instantiation on every render.
2. **Factories return `[Provider, useHook]` tuples.** Destructure and rename freely, like `useState`. This avoids aliasing syntax and follows React conventions.
3. **All hook methods call React hooks internally.** Call `on()`, `once()`, `get()`, `post()`, etc. at the top level of your component — never conditionally or inside loops.
4. **Types are inferred from the engine instance.** No manual generics needed — `createFetchContext(api)` propagates the engine's header/param/state types to the hook automatically.

## Hook API Overview

| Factory | Hook Returns | Auto-Cleanup |
|---------|-------------|--------------|
| `createObserverContext` | `{ on, once, oncePromise, emit, emitFactory, instance }` | Listeners removed on unmount |
| `createFetchContext` | `{ get, post, put, del, patch, instance }` | In-flight requests cancelled on unmount |
| `createStorageContext` | `{ get, set, remove, assign, has, clear, wrap, keys, instance }` | Re-renders on storage mutations |
| `createLocalizeContext` | `{ t, locale, changeTo, locales, instance }` | Re-renders on locale change |

## composeProviders

```typescript
import { composeProviders } from '@logosdx/react'

// Simple — first entry = outermost wrapper
const Providers = composeProviders(AppObserver, ApiFetch, AppStorage, AppLocale)

// With props for providers that need configuration
const Providers = composeProviders(
    AppObserver,
    [ThemeProvider, { theme: 'dark' }],
    ApiFetch,
)

// Empty = pass-through
const NoOp = composeProviders()
```

## Observer Hook Details

```typescript
const { on, once, oncePromise, emit, emitFactory, instance } = useAppObserver()

// Callback subscription — auto-cleans on unmount, re-subscribes on callback change
on('user:login', useCallback((data) => setUser(data), []))

// One-shot callback
once('app:init', useCallback((cfg) => bootstrap(cfg), []))

// Reactive promise tuple (no callback needed)
const [waiting, data, cancel] = oncePromise('notification')
// waiting: boolean, data: Shape[E] | null, cancel: () => void

// Stable emitter (bound to engine, safe in deps arrays)
emit('user:logout', { userId: '123' })

// Memoized emitter for a specific event
const logout = emitFactory('user:logout')
// <button onClick={() => logout({ userId: '123' })} />
```

See [react-provider-setup.md](references/react-provider-setup.md) and [react-hook-api-reference.md](references/react-hook-api-reference.md) for details.

## References

- [react-provider-setup.md](references/react-provider-setup.md) — Full setup pattern, engine wiring, and production architecture
- [react-hook-api-reference.md](references/react-hook-api-reference.md) — Complete hook API for all four factories
