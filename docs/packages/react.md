---
title: React
description: React bindings for LogosDX — context providers and hooks for Observer, Fetch, Storage, and Localize.
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
pnpm add @logosdx/observer @logosdx/fetch @logosdx/storage @logosdx/localize
```

## Quick Start

```typescript
// setup.ts — run once, types inferred from instances
import { ObserverEngine } from '@logosdx/observer';
import { FetchEngine } from '@logosdx/fetch';
import { StorageAdapter } from '@logosdx/storage';
import { LocaleManager } from '@logosdx/localize';
import {
    createObserverContext,
    createFetchContext,
    createStorageContext,
    createLocalizeContext,
    composeProviders,
} from '@logosdx/react';

// Create your engine instances
const observer = new ObserverEngine<AppEvents>();
const api = new FetchEngine({ baseUrl: 'https://api.example.com' });
const storage = new StorageAdapter<AppStore>(localStorage, 'myapp');
const i18n = new LocaleManager({ current: 'en', fallback: 'en', locales });

// Create context + hook pairs — rename freely
export const [AppObserver, useAppObserver] = createObserverContext(observer);
export const [ApiFetch, useApiFetch] = createFetchContext(api);
export const [AppStorage, useAppStorage] = createStorageContext(storage);
export const [AppLocale, useAppLocale] = createLocalizeContext(i18n);

// Compose into a single wrapper — no nesting required
export const Providers = composeProviders(
    AppObserver,
    ApiFetch,
    AppStorage,
    AppLocale,
);
```

```tsx
// App.tsx — one wrapper, done
<Providers>
    <App />
</Providers>
```

## Why Tuples?

Every factory returns a `[Provider, useHook]` tuple instead of an object. This follows the same convention as React's own hooks (`useState`, `useReducer`) for good reason:

**Free renaming.** Array destructuring lets you name each piece whatever fits your domain. No aliasing syntax needed:

```typescript
// Tuples — rename naturally
const [ChatObserver, useChatEvents] = createObserverContext(chatEngine);
const [ApiObserver, useApiObserver] = createObserverContext(apiEngine);

// Objects would require aliasing — more verbose, more noise
const { Provider: ChatObserver, useHook: useChatEvents } = createObserverContext(chatEngine);
const { Provider: ApiObserver, useHook: useApiObserver } = createObserverContext(apiEngine);
```

**Less verbose.** Destructuring an array is shorter than destructuring an object with named keys. When you create several contexts in a setup file, the difference adds up fast.

**Familiar pattern.** React developers already think in tuples. `const [state, setState] = useState()` is muscle memory. `const [Provider, useHook] = createObserverContext()` reads the same way.

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

Auto-fetches on mount. Returns `[cancel, isLoading, response, error]`.

```typescript
function UserList() {

    const { get } = useApiFetch();

    const [cancel, isLoading, res, error] = get<User[]>('/users');

    if (isLoading) return <Spinner />;
    if (error) return <Error status={error.status} message={error.message} />;

    return (
        <ul>
            {res?.data.map(u => <li key={u.id}>{u.name}</li>)}
        </ul>
    );
}
```

With typed response headers:

```typescript
const [, , res] = get<Post[], { 'x-total': string }>('/posts');
// res?.headers['x-total'] is typed as string
```

### Mutations — `post`, `put`, `del`, `patch`

Start idle. Returns `[trigger, cancel, isLoading, response, error]`.

```typescript
function CreateComment() {

    const { post, del } = useApiFetch();

    const [submit, cancelSubmit, isSubmitting, result, submitErr] =
        post<Comment>('/comments');

    const [remove, cancelRemove, isRemoving, , removeErr] =
        del<void>('/comments/123');

    return (
        <form onSubmit={() => submit({ text: 'Hello' })}>
            <button disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Submit'}
            </button>
            {result && <p>Created: {result.data.id}</p>}
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

## Storage

`createStorageContext` wraps a `StorageAdapter`. Any mutation (`set`, `remove`, `assign`, `clear`) triggers a re-render automatically via internal event subscriptions.

```typescript
import { createStorageContext } from '@logosdx/react';
import { StorageAdapter } from '@logosdx/storage';

interface AppStore {
    theme: 'light' | 'dark';
    userId: string;
    preferences: { lang: string; notifications: boolean };
}

const storage = new StorageAdapter<AppStore>(localStorage, 'myapp');
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
    wrap,      // wrap('theme') → { get, set, remove, assign }
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
