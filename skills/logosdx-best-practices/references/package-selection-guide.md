# Package Selection Guide

## Decision Matrix

### "I need to make HTTP requests"

Use **@logosdx/fetch** — `FetchEngine`.

- Built-in retry with exponential backoff
- Request deduplication (prevent duplicate concurrent GETs)
- Response caching with stale-while-revalidate
- Client-side rate limiting with token bucket
- AbortablePromise for cancellation
- Typed headers, params, state, and response headers

```typescript
import { FetchEngine } from '@logosdx/fetch'
import { attempt } from '@logosdx/utils'

const api = new FetchEngine({ baseUrl: '/api', totalTimeout: 5000 })
const [{ data: users }, err] = await attempt(() => api.get<User[]>('/users'))
```

### "I need event-driven communication"

Use **@logosdx/observer** — `ObserverEngine`.

- Type-safe event definitions with interfaces
- Regex event matching for cross-cutting concerns
- Async generators for streaming consumption
- EventQueue with priority, concurrency, and rate limiting
- Component observation (extend any object with events)

```typescript
import { ObserverEngine } from '@logosdx/observer'

const observer = new ObserverEngine<AppEvents>()
const cleanup = observer.on('user:login', (data) => console.log(data.userId))
```

### "I need resilient async operations"

Use **@logosdx/utils** — flow control primitives.

- `retry` / `makeRetryable` — Retry with exponential backoff
- `circuitBreaker` — Stop calling failing services
- `withTimeout` / `runWithTimeout` — Time-bound operations
- `rateLimit` — Limit call frequency
- `withInflightDedup` — Share in-flight promises
- `composeFlow` — Layer multiple protections declaratively

```typescript
import { composeFlow } from '@logosdx/utils'

const resilientFetch = composeFlow(fetchData, {
    rateLimit: { maxCalls: 100, windowMs: 60000 },
    circuitBreaker: { maxFailures: 5, resetAfter: 30000 },
    retry: { retries: 3, delay: 1000, backoff: 2 },
})
```

### "I need to manipulate the DOM"

Use **@logosdx/dom** — `html.*` modules.

- `html.css` — Get/set computed styles with type safety
- `html.attrs` — Attribute management
- `html.events` — Event listeners with cleanup functions
- `html.behaviors` — Declarative behavior binding with MutationObserver
- Viewport utilities — scroll progress, visibility, positioning

```typescript
import { $, html } from '@logosdx/dom'

const buttons = $<HTMLButtonElement>('.btn')
html.css.set(buttons, { color: 'blue' })
const cleanup = html.events.on(buttons, 'click', handler)
```

### "I need state management"

Use **@logosdx/state-machine** — `StateMachine`.

- Reducer-based state updates
- Time travel debugging with state history
- Parent-child relationships
- Bidirectional sync between machines
- Event emission on state changes

### "I need persistent storage"

Use **@logosdx/storage** — `StorageAdapter`.

- Type-safe wrapper over localStorage/sessionStorage
- Prefixed keys to avoid collisions
- Bulk get/set/remove operations
- Event-driven change notifications

```typescript
import { StorageAdapter } from '@logosdx/storage'

const storage = new StorageAdapter<AppStore>(localStorage, 'myapp')
storage.set('theme', 'dark')
const theme = storage.get('theme') // typed as AppStore['theme']
```

### "I need internationalization"

Use **@logosdx/localize** — `LocaleManager`.

- Type-safe translation keys via `PathLeaves<T>`
- Locale switching with fallback chains
- Template interpolation
- Event notifications on locale change

### "I need React integration"

Use **@logosdx/react** — factory context providers.

- `createObserverContext` / `createFetchContext` / `createStorageContext` / `createLocalizeContext`
- Returns `[Provider, useHook]` tuples for free renaming
- `composeProviders` eliminates nested provider trees
- Auto-cleanup on unmount

## Dependency Architecture

- All packages depend on `@logosdx/utils`.
- The `@logosdx/react` package has optional peer dependencies — only install what you use.
