---
title: React
description: React bindings for LogosDX — context providers, Apollo-style API hooks, and hooks for Observer, Fetch, Storage, Localize, and StateMachine.
---

# React

React bindings for LogosDX. Each factory takes an engine instance, infers all generics, and returns a `[Provider, useHook]` tuple you can rename to whatever fits your domain. Install only the peer dependencies you actually use — they're all optional.

[[toc]]

## Installation

::: code-group

```bash [npm]
npm install @logosdx/react
```

```bash [yarn]
yarn add @logosdx/react
```

```bash [pnpm]
pnpm add @logosdx/react
```

:::

Then install the engine packages you need:

```bash
pnpm add @logosdx/observer @logosdx/fetch @logosdx/storage @logosdx/localize @logosdx/state-machine
```

### Subpath Imports

Each binding is available as a standalone subpath export. This means peer dependencies are only required for the bindings you actually import:

```typescript
// Only requires @logosdx/storage as a peer dep
import { createStorageContext } from '@logosdx/react/storage';

// Only requires @logosdx/state-machine as a peer dep
import { useStateMachine } from '@logosdx/react/state-machine';

// Only requires @logosdx/fetch (+ optional @logosdx/observer) as peer deps
import { createApiHooks, useQuery, useMutation, useAsync } from '@logosdx/react/api';

// Barrel import still works — requires all used peer deps
import { createStorageContext, useStateMachine } from '@logosdx/react';
```

## Quick Start

```typescript
// setup.ts — run once, types inferred from instances
import { ObserverEngine } from '@logosdx/observer';
import { FetchEngine } from '@logosdx/fetch';
import { StorageAdapter, WebStorageDriver } from '@logosdx/storage';
import { LocaleManager } from '@logosdx/localize';
import { StateMachine } from '@logosdx/state-machine';
import {
    createObserverContext,
    createFetchContext,
    createStorageContext,
    createLocalizeContext,
    createStateMachineContext,
    composeProviders,
} from '@logosdx/react';

// Create your engine instances
const observer = new ObserverEngine<AppEvents>();
const api = new FetchEngine({ baseUrl: 'https://api.example.com' });
const storage = new StorageAdapter<AppStore>({
    driver: new WebStorageDriver(localStorage),
    prefix: 'myapp',
});
const i18n = new LocaleManager({ current: 'en', fallback: 'en', locales });
const game = new StateMachine<GameContext, GameEvents, GameStates>({ ... });

// Create context + hook pairs — rename freely
export const [AppObserver, useAppObserver] = createObserverContext(observer);
export const [ApiFetch, useApiFetch] = createFetchContext(api);
export const [AppStorage, useAppStorage] = createStorageContext(storage);
export const [AppLocale, useAppLocale] = createLocalizeContext(i18n);
export const [GameProvider, useGame] = createStateMachineContext(game);

// Compose into a single wrapper — no nesting required
export const Providers = composeProviders(
    AppObserver,
    ApiFetch,
    AppStorage,
    AppLocale,
    GameProvider,
);
```

```tsx
// App.tsx — one wrapper, done
<Providers>
    <App />
</Providers>
```

## Pattern

Every factory follows the same pattern:

1. Pass an engine instance — TypeScript infers all generics
2. Get back `[Provider, useHook]` — rename to match your domain
3. Compose providers with `composeProviders` or nest them manually
4. Call the hook in components to get a typed API

The provider captures the instance at creation time. No props needed.

## Observer

`createObserverContext` binds an `ObserverEngine` to React's lifecycle. Subscriptions are managed via `useEffect` — they clean up automatically on unmount or when the callback identity changes.

```typescript
import { createObserverContext } from '@logosdx/react';
import { ObserverEngine } from '@logosdx/observer';

interface AppEvents {
    'user.login': { userId: string; token: string };
    'user.logout': { userId: string };
    'notification': { message: string };
}

const engine = new ObserverEngine<AppEvents>();
export const [AppObserver, useAppObserver] = createObserverContext(engine);
```

### `on(event, callback)`

Subscribes to an event. Re-subscribes when the callback identity changes, so wrap handlers with `useCallback` to keep them stable.

```typescript
function UserStatus() {

    const { on } = useAppObserver();

    const handler = useCallback((data) => {
        console.log('logged in:', data.userId);
    }, []);

    on('user.login', handler);

    return <div>...</div>;
}
```

### `once(event, callback)`

One-shot listener. Fires once and cleans up.

```typescript
const { once } = useAppObserver();

const initHandler = useCallback((cfg) => {
    console.log('app initialized:', cfg);
}, []);

once('app.init', initHandler);
```

### `oncePromise(event)`

Reactive one-shot — no callback needed. Returns a `[waiting, data, cancel]` tuple that updates when the event fires.

```typescript
const { oncePromise } = useAppObserver();

const [waiting, data, cancel] = oncePromise('notification');

if (waiting) return <Spinner />;

return <p>{data?.message}</p>;
```

### `emit(event, data)` and `emitFactory(event)`

Fire events directly or get a memoized emitter for a specific event.

```typescript
const { emit, emitFactory } = useAppObserver();

// Direct
emit('user.logout', { userId: '123' });

// Memoized — stable reference, safe for onClick
const logout = emitFactory('user.logout');

return <button onClick={() => logout({ userId: '123' })}>Log out</button>;
```

### `instance`

Raw engine access for imperative use cases.

```typescript
const { instance } = useAppObserver();

// Use in event handlers where you need the full engine API
const handleExport = async () => {
    instance.emit('export.started', { format: 'csv' });
};
```

## Fetch

`createFetchContext` provides auto-fetching queries and on-demand mutations. Queries fire on mount and re-fetch when the path or options change. Mutations start idle and fire when triggered.

```typescript
import { createFetchContext } from '@logosdx/react';
import { FetchEngine } from '@logosdx/fetch';

const api = new FetchEngine({
    baseUrl: 'https://rainbow-loans.com',
    retry: { maxAttempts: 3 },
});

export const [ApiFetch, useApiFetch] = createFetchContext(api);
```

### Queries — `get(path, options?)`

Auto-fetches on mount. Returns `{ data, loading, error, response, refetch, cancel }`. `data` is the unwrapped `T`. `response` provides full `FetchResponse` access (status, headers).

```typescript
function UserList() {

    const { get } = useApiFetch();

    const { data, loading, error, refetch } = get<User[]>('/users');

    if (loading) return <Spinner />;
    if (error) return <Error status={error.status} message={error.message} />;

    return (
        <ul>
            {data?.map(u => <li key={u.id}>{u.name}</li>)}
        </ul>
    );
}
```

With typed response headers via the `response` field:

```typescript
const { response } = get<Post[], { 'x-total': string }>('/posts');
// response?.headers['x-total'] is typed as string
```

### Mutations — `post`, `put`, `del`, `patch`

Start idle. Returns `{ data, loading, error, response, mutate, reset, cancel, called }`. `mutate()` returns `Promise<T>` so you can await the result in handlers.

```typescript
function CreateComment() {

    const { post, del } = useApiFetch();

    const { mutate: submit, loading: isSubmitting, data: result, error: submitErr } =
        post<Comment>('/comments');

    const { mutate: remove, loading: isRemoving, error: removeErr } =
        del<void>('/comments/123');

    return (
        <form onSubmit={async () => {
            const comment = await submit({ text: 'Hello' });
            if (comment) navigate(`/comments/${comment.id}`);
        }}>
            <button disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Submit'}
            </button>
            {result && <p>Created: {result.id}</p>}
            {submitErr && <p>Failed: {submitErr.message}</p>}
        </form>
    );
}
```

### Escape Hatch — `instance`

For imperative one-off requests in event handlers:

```typescript
import { attempt } from '@logosdx/utils';

function ExportButton() {

    const { instance } = useApiFetch();

    const handleExport = async () => {
        const [res, err] = await attempt(() => instance.get('/export'));
        if (err) return console.error(err);
        downloadBlob(res.data);
    };

    return <button onClick={handleExport}>Export</button>;
}
```

## API Hooks


Apollo-style hooks for API interactions. Like `createFetchContext`, these return `{ data, loading, error }` objects — familiar to anyone who's used Apollo Client or TanStack Query. Auto-refetch on reactive config changes, polling, and ObserverEngine-driven cache invalidation built in.

```typescript
import { FetchEngine } from '@logosdx/fetch';
import { ObserverEngine } from '@logosdx/observer';
import { createApiHooks } from '@logosdx/react/api';

interface LoanEvents {
    'loan.created': { id: string; amount: number };
    'loan.deleted': { id: string };
    'audit.log': { action: string; entity: unknown };
}

const api = new FetchEngine({ baseUrl: 'https://rainbow-loans.com/api' });
const events = new ObserverEngine<LoanEvents>();

// Pre-bind engine + observer — no need to pass them in components
const {
    useQuery,
    useMutation,
    useAsync,
    createQuery,
    createMutation,
} = createApiHooks(api, events);
```

### `useQuery` — Auto-Fetch with Reactive Config

Fires on mount and re-fetches when reactive options change. `data` is the parsed response body — not the full `FetchResponse`.

```typescript
function LoanList({ page }: { page: number }) {

    const { data, loading, error, refetch, cancel } = useQuery<Loan[]>('/loans', {
        defaults: { headers: { 'X-Api-Version': '2' } },     // Fixed — won't trigger re-fetch
        reactive: { params: { page, limit: 20 } },            // Watched — changes trigger re-fetch
        skip: !isAuthenticated,                                // Conditional execution
        pollInterval: 30_000,                                  // Re-fetch every 30s
        invalidateOn: ['loan.created', 'loan.deleted'],        // Re-fetch on observer events
    });

    if (loading) return <Spinner />;
    if (error) return <Error status={error.status} />;

    return (
        <ul>
            {data?.map(loan => <li key={loan.id}>{loan.borrower}</li>)}
        </ul>
    );
}
```

### `useMutation` — Fire on Demand

Stays idle until `mutate()` is called. Returns a promise so you can `await` the result in handlers.

```typescript
function CreateLoan() {

    const { mutate, loading, error, data, called, reset, cancel } =
        useMutation<Loan>('post', '/loans', {
            defaults: { headers: { 'Content-Type': 'application/json' } },
            emitOnSuccess: 'loan.created',   // Emit event on observer after success
        });

    const handleSubmit = async (form: LoanForm) => {

        const loan = await mutate(form);
        if (loan) navigate(`/loans/${loan.id}`);
    };

    return (
        <form onSubmit={handleSubmit}>
            <button disabled={loading}>{loading ? 'Creating...' : 'Create Loan'}</button>
            {error && <p>Failed: {error.message}</p>}
        </form>
    );
}
```

`emitOnSuccess` supports three forms — use whichever fits your case:

```typescript
// String — emit with response data as payload
emitOnSuccess: 'loan.created'

// Object — transform the payload
emitOnSuccess: { event: 'audit.log', payload: (data) => ({ action: 'create', entity: data }) }

// Array — emit multiple events
emitOnSuccess: [
    'loan.created',
    { event: 'audit.log', payload: (data) => ({ action: 'create', entity: data }) },
]
```

### `useAsync` — Wrap Any Async Function

For when you need more than simple GET/POST — wrap any async function with loading/error/data state. If the function returns a `FetchResponse` (from FetchEngine methods), `data` is automatically unwrapped.

```typescript
class LoanApi extends FetchEngine {

    getLoans(page: number) {
        return this.get<Loan[]>('/loans', { params: { page } });
    }
}

function LoanDashboard({ page }: { page: number }) {

    const { data, loading, error, refetch } = useAsync<Loan[]>(
        () => loanApi.getLoans(page),
        [page],                                                // React deps — re-executes on change
        { invalidateOn: ['loan.created'] },                    // Observer-driven invalidation
    );

    if (loading) return <Spinner />;

    return <LoanTable loans={data ?? []} onRefresh={refetch} />;
}
```

### Factory Functions — Reusable Hooks

Define hooks at module level, use them in any component. Factories close over the engine and observer so components stay clean:

```typescript
// hooks/loans.ts — define once
const useLoans = createQuery<Loan[]>('/loans', {
    invalidateOn: ['loan.created', 'loan.deleted'],
});

const useCreateLoan = createMutation<Loan>('post', '/loans', {
    emitOnSuccess: 'loan.created',
});

// LoanPage.tsx — use anywhere
function LoanPage({ page }: { page: number }) {

    const { data, loading } = useLoans({ reactive: { params: { page } } });
    const { mutate } = useCreateLoan();

    return (
        <>
            {loading ? <Spinner /> : <LoanTable loans={data ?? []} />}
            <button onClick={() => mutate({ amount: 5000 })}>New Loan</button>
        </>
    );
}
```

### API Hooks vs Fetch Context

Both `createFetchContext` and `createApiHooks` wrap the same `FetchEngine`. Choose based on your needs:

| | `createFetchContext` | `createApiHooks` |
|---|---|---|
| Return shape | `{ data, loading, error, response, ... }` objects | `{ data, loading, error, ... }` objects |
| Response | Both `data` (unwrapped `T`) and `response` (`FetchResponse<T>`) | Unwrapped `T` (just the data) |
| Requires Provider | Yes | No |
| Observer integration | Manual | Built-in (`invalidateOn`, `emitOnSuccess`) |
| Polling | Manual | Built-in (`pollInterval`) |
| Factory functions | No | Yes (`createQuery`, `createMutation`) |

Use `createFetchContext` when you need Provider-scoped sharing and full response access. Use `createApiHooks` when you want Apollo-style ergonomics with automatic cache invalidation.

### Type Definitions

**Fetch Context return types** (from `createFetchContext`):

```typescript
type FetchContextQueryResult<T, RH> = {
    data: T | null;
    loading: boolean;
    error: FetchError | null;
    response: FetchResponse<T, any, any, RH> | null;
    refetch: () => void;
    cancel: () => void;
};

type FetchContextMutationResult<T, RH> = {
    data: T | null;
    loading: boolean;
    error: FetchError | null;
    response: FetchResponse<T, any, any, RH> | null;
    mutate: <Payload = unknown>(payload?: Payload) => Promise<T>;
    reset: () => void;
    cancel: () => void;
    called: boolean;
};
```

**API Hooks return types** (from `createApiHooks`):

```typescript
type QueryResult<T> = {
    data: T | null;
    loading: boolean;
    error: FetchError | null;
    refetch: () => void;
    cancel: () => void;
};

type MutationResult<T> = {
    data: T | null;
    loading: boolean;
    error: FetchError | null;
    mutate: <Payload = unknown>(payload?: Payload) => Promise<T>;
    reset: () => void;
    cancel: () => void;
    called: boolean;
};

type QueryOptions<H, P, E> = {
    defaults?: CallConfig<H, P>;
    reactive?: CallConfig<H, P>;
    skip?: boolean;
    pollInterval?: number;
    invalidateOn?: (keyof E)[];
};

type MutationOptions<H, P, E> = {
    defaults?: CallConfig<H, P>;
    emitOnSuccess?: EmitConfig<E>;
};
```

## Storage

`createStorageContext` wraps a `StorageAdapter`. Any mutation (`set`, `remove`, `assign`, `clear`) triggers a re-render automatically via internal event subscriptions.

```typescript
import { createStorageContext } from '@logosdx/react/storage';
import { StorageAdapter, WebStorageDriver } from '@logosdx/storage';

interface AppStore {
    theme: 'light' | 'dark';
    userId: string;
    preferences: { lang: string; notifications: boolean };
}

const storage = new StorageAdapter<AppStore>({
    driver: new WebStorageDriver(localStorage),
    prefix: 'myapp',
});
export const [AppStorage, useAppStorage] = createStorageContext(storage);
```

### Usage

```typescript
function ThemeSwitcher() {

    const { get, set } = useAppStorage();

    const theme = get('theme');

    return (
        <button onClick={() => set('theme', theme === 'dark' ? 'light' : 'dark')}>
            Current: {theme}
        </button>
    );
}
```

### Full API

```typescript
const {
    get,       // get('theme') or get() for all values
    set,       // set('theme', 'dark') or set({ theme: 'dark', userId: '42' })
    remove,    // remove('userId')
    assign,    // assign('preferences', { lang: 'es' }) — Object.assign on value
    has,       // has('theme') → true
    clear,     // clear() — removes all prefixed keys
    scope,     // scope('theme') → scoped adapter for a single key
    keys,      // keys() → ['theme', 'userId', ...]
    instance,  // raw StorageAdapter
} = useAppStorage();
```

## Localize

`createLocalizeContext` wraps a `LocaleManager`. Locale changes trigger a re-render automatically.

```typescript
import { createLocalizeContext } from '@logosdx/react';
import { LocaleManager } from '@logosdx/localize';

const i18n = new LocaleManager({
    current: 'en',
    fallback: 'en',
    locales: {
        en: { code: 'en', text: 'English', labels: {
            home: { greeting: 'Hello, {name}!' },
            nav: { logout: 'Log out' },
        }},
        es: { code: 'es', text: 'Español', labels: {
            home: { greeting: '¡Hola, {name}!' },
            nav: { logout: 'Cerrar sesión' },
        }},
    },
});

export const [AppLocale, useAppLocale] = createLocalizeContext(i18n);
```

### Usage

```typescript
function Greeting() {

    const { t, locale, changeTo, locales } = useAppLocale();

    return (
        <div>
            <h1>{t('home.greeting', { name: 'World' })}</h1>
            <p>Current: {locale}</p>

            {locales.map(({ code, text }) => (
                <button key={code} onClick={() => changeTo(code)}>
                    {text}
                </button>
            ))}
        </div>
    );
}
```

### API

| Property | Type | Description |
|----------|------|-------------|
| `t(key, values?)` | `(key: PathLeaves<Locale>, values?) => string` | Translate a key with optional interpolation |
| `locale` | `Code` | Current locale code |
| `changeTo(code)` | `(code: Code) => void` | Switch locale — triggers re-render |
| `locales` | `{ code, text }[]` | All available locales |
| `instance` | `LocaleManager` | Raw manager access |

## State Machine

Two options: `createStateMachineContext` for context-based sharing, or `useStateMachine` as a standalone hook when you don't need a provider.

### Context + Hook Tuple

```typescript
import { createStateMachineContext } from '@logosdx/react/state-machine';
import { StateMachine } from '@logosdx/state-machine';

interface GameContext {
    score: number;
    level: number;
}

interface GameEvents {
    SCORE: number;
    LEVEL_UP: void;
    RESET: void;
}

type GameStates = 'idle' | 'playing' | 'paused';

const machine = new StateMachine<GameContext, GameEvents, GameStates>({
    initial: 'idle',
    context: { score: 0, level: 1 },
    transitions: { /* ... */ },
});

export const [GameProvider, useGame] = createStateMachineContext(machine);
```

### Usage

```typescript
function ScoreBoard() {

    const { state, context, send } = useGame();

    return (
        <div>
            <p>State: {state}</p>
            <p>Score: {context.score}</p>
            <button onClick={() => send('SCORE', 10)}>+10 Points</button>
        </div>
    );
}
```

### Standalone Hook

Use `useStateMachine` directly when the machine doesn't need to be shared via context:

```typescript
import { useStateMachine } from '@logosdx/react/state-machine';

function Counter() {

    const { state, context, send } = useStateMachine(counterMachine);

    return <button onClick={() => send('INCREMENT')}>{context.count}</button>;
}
```

### Selector Support

Pass a selector to narrow the context and prevent unnecessary re-renders when unrelated context values change:

```typescript
// Only re-renders when `score` changes — ignores `level` changes
const { context: score } = useGame((ctx) => ctx.score);

// Full context — re-renders on any context change
const { context } = useGame();
```

The selector uses deep equality comparison via `equals` from `@logosdx/utils`. If the selected value hasn't changed, the component skips the re-render.

### API

| Property | Type | Description |
|----------|------|-------------|
| `state` | `States` | Current state name (reactive) |
| `context` | `Selected` | Full context or selector result (reactive) |
| `send` | `(event, data?) => void` | Dispatch a transition event |
| `instance` | `StateMachine` | Raw machine access |

## Compose Providers

`composeProviders` eliminates deeply nested provider trees. Pass providers in order — the first becomes the outermost wrapper.

```typescript
import { composeProviders } from '@logosdx/react';

const Providers = composeProviders(
    AppObserver,
    ApiFetch,
    AppStorage,
    AppLocale,
);

// Equivalent to:
// <AppObserver>
//     <ApiFetch>
//         <AppStorage>
//             <AppLocale>
//                 {children}
//             </AppLocale>
//         </AppStorage>
//     </ApiFetch>
// </AppObserver>
```

### Providers That Need Props

Some providers need configuration beyond just children. Pass them as `[Provider, props]` tuples:

```typescript
const ThemeProvider = ({ theme, children }: { theme: string; children?: ReactNode }) =>
    createElement(ThemeContext.Provider, { value: theme }, children);

const Providers = composeProviders(
    AppObserver,
    [ThemeProvider, { theme: 'dark' }],
    ApiFetch,
    AppStorage,
);
```

Props are spread onto the provider alongside children. This keeps the composition flat no matter how many providers need configuration.

### Empty Composition

Calling `composeProviders()` with no arguments returns a pass-through component that renders its children as-is. Useful when the provider list is built dynamically.

## Rules

All hook methods (`on`, `once`, `oncePromise`, `emitFactory`, `get`, `post`, `put`, `del`, `patch`) call React hooks internally. They follow the same rules as hooks:

- Call them at the **top level** of your component
- Never call them **conditionally** or in **loops**
- The Provider must be an **ancestor** in the component tree
