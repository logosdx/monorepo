---
title: Storage
description: One API for your many key-value stores.
---

# Storage


Key-value stores are everywhere -- `localStorage`, `sessionStorage`, IndexedDB, the file system -- but each has a different API and different serialization rules. `@logosdx/storage` wraps any backend behind a single async interface with automatic JSON serialization, type-safe keys, prefix-based namespacing, and reactive events via `@logosdx/observer`. Swap drivers without changing application code.

[[toc]]

## Installation


::: code-group

```bash [npm]
npm install @logosdx/storage
```

```bash [yarn]
yarn add @logosdx/storage
```

```bash [pnpm]
pnpm add @logosdx/storage
```

:::


**CDN:**

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/storage@latest/dist/browser.min.js"></script>
<script>
    const { StorageAdapter, LocalStorageDriver } = LogosDx.Storage;
</script>
```

## Quick Start


```typescript
import { StorageAdapter, LocalStorageDriver } from '@logosdx/storage'

interface AppStorage {
    user: { id: string; name: string; email: string }
    settings: { theme: 'light' | 'dark'; notifications: boolean }
    cart: { id: string; quantity: number }[]
}

const storage = new StorageAdapter<AppStorage>({
    driver: new LocalStorageDriver(),
    prefix: 'myapp'
})

// All operations are async
await storage.set('user', { id: '123', name: 'Jane', email: 'jane@example.com' })
const user = await storage.get('user')

// Subscribe to updates (returns cleanup function)
const cleanup = storage.on('after-set', (event) => {
    console.log('Set:', event.key, event.value)
})

// Merge object properties
await storage.assign('settings', { notifications: false })

// Remove and clear
await storage.rm(['user', 'settings'])
await storage.clear()

// Cleanup listener when done
cleanup()
```

## Core Concepts


StorageAdapter separates **what** you store from **where** you store it. The adapter handles serialization, prefixing, and events while the driver handles persistence. All methods are async, so the same API works with synchronous backends (localStorage) and asynchronous ones (IndexedDB, file system).

### Driver Pattern

A driver is any object implementing the `StorageDriver` interface -- five async methods that handle raw key-value persistence:

```typescript
interface StorageDriver {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
    keys(): Promise<string[]>
    clear(): Promise<void>
}
```

The adapter sits on top and adds type safety, serialization, events, and prefix scoping.

### Serialization

By default, values are serialized with `JSON.stringify` before being passed to the driver and deserialized with `JSON.parse` on retrieval. This means the same caveats apply -- `Date` becomes a string, `Map`/`Set` become plain objects, `undefined` becomes `null`, and functions are not serializable.

When using a driver that natively supports structured data (like IndexedDB), set `structured: true` to skip JSON serialization entirely:

```typescript
const storage = new StorageAdapter<AppStorage>({
    driver: new IndexedDBDriver('my-app'),
    structured: true
})
```

### Prefix

Keys are stored as `prefix:key` when a prefix is provided. This prevents collisions between different parts of your application sharing the same backend:

```typescript
const userStorage = new StorageAdapter<UserData>({
    driver: new LocalStorageDriver(),
    prefix: 'app:user'
})

const cacheStorage = new StorageAdapter<CacheData>({
    driver: new LocalStorageDriver(),
    prefix: 'app:cache'
})
```

Operations like `keys()`, `entries()`, `values()`, and `clear()` are scoped to the prefix -- they only see and affect keys that belong to this adapter instance.


## StorageAdapter


### Constructor


```typescript
new StorageAdapter<Values>(config: StorageAdapter.Config)
```

**Config:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `driver` | `StorageDriver` | *required* | Backend driver for persistence |
| `prefix` | `string` | `undefined` | Key namespace prefix |
| `structured` | `boolean` | `false` | Skip JSON serialization when `true` |

**Example:**

```typescript
const storage = new StorageAdapter<AppStorage>({
    driver: new LocalStorageDriver(),
    prefix: 'myapp',
    structured: false
})
```

### Public Properties

| Property | Type | Description |
|----------|------|-------------|
| `driver` | `StorageDriver` | The underlying driver instance |
| `prefix` | `string \| undefined` | Configured prefix |
| `structured` | `boolean` | Whether JSON serialization is skipped |


### Core Methods


#### `get()`


Overloaded async data retrieval.

```typescript
// Get all values
get(): Promise<Values>

// Get a specific key
get<K extends keyof Values>(key: K): Promise<Values[K] | null>

// Get multiple keys
get<K extends keyof Values>(keys: K[]): Promise<Partial<Values>>
```

Examples:

```typescript
const all = await storage.get()
const user = await storage.get('user')
const { user, settings } = await storage.get(['user', 'settings'])
```

Notes:

- Missing keys resolve to `null`.
- All values are deserialized via `JSON.parse` unless `structured: true`.


#### `set()`


Write one or multiple values.

```typescript
// Set multiple pairs
set(values: Partial<Values> & Record<string, any>): Promise<void>

// Set one pair
set<K extends keyof Values>(key: K, value: Values[K]): Promise<void>
```

Examples:

```typescript
await storage.set('user', { id: '123', name: 'Alice' })

await storage.set({
    user: { id: '123', name: 'Alice' },
    settings: { theme: 'dark', notifications: true }
})
```

Notes:

- Values are serialized via `JSON.stringify` unless `structured: true`.
- The object form triggers one `before-set`/`after-set` event per key.


#### `rm()` / `remove()`


Delete keys.

```typescript
rm<K extends keyof Values>(keyOrKeys: K | K[]): Promise<void>
```

Aliases: `remove()`.

```typescript
await storage.rm('user')
await storage.rm(['user', 'settings'])
await storage.remove('cart')
```


#### `has()`


Check key existence without retrieving the value.

```typescript
has(key: keyof Values): Promise<boolean>
has(keys: (keyof Values)[]): Promise<boolean[]>
```

```typescript
const exists = await storage.has('user')
const [hasUser, hasSettings] = await storage.has(['user', 'settings'])
```


#### `clear()` / `reset()`


Remove all keys under the configured prefix.

```typescript
clear(): Promise<void>
```

Alias: `reset()`.

Notes:

- Emits a `clear` event.
- Only clears keys matching the instance prefix.


#### `assign()`


Shallow-merge object values.

```typescript
assign<K extends keyof Values>(key: K, val: Partial<Values[K]>): Promise<void>
```

Example:

```typescript
await storage.set('user', { id: '123', name: 'Bob' })
await storage.assign('user', { email: 'bob@example.com' })
// Result: { id: '123', name: 'Bob', email: 'bob@example.com' }
```

Notes:

- If the key does not exist, `assign()` behaves like `set()`.
- Throws if the current value is not an object.
- Uses `Object.assign` semantics (shallow merge).


### Utility Methods


#### `keys()`


```typescript
keys(): Promise<(keyof Values)[]>
```

Return all keys in the current prefix scope.


#### `entries()`


```typescript
entries(): Promise<[keyof Values, Values[keyof Values]][]>
```

Return `[key, value]` pairs for all keys in the current prefix scope.


#### `values()`


```typescript
values(): Promise<Values[keyof Values][]>
```

Return all values in the current prefix scope.


## Built-in Drivers


### LocalStorageDriver


Wraps `window.localStorage`. Browser only.

```typescript
import { LocalStorageDriver } from '@logosdx/storage'

const storage = new StorageAdapter<AppStorage>({
    driver: new LocalStorageDriver(),
    prefix: 'myapp'
})
```


### SessionStorageDriver


Wraps `window.sessionStorage`. Browser only. Data is cleared when the tab or window is closed.

```typescript
import { SessionStorageDriver } from '@logosdx/storage'

const storage = new StorageAdapter<AppStorage>({
    driver: new SessionStorageDriver(),
    prefix: 'session'
})
```


### WebStorageDriver


Base class for `LocalStorageDriver` and `SessionStorageDriver`. Use it to wrap any `Storage`-compatible backend:

```typescript
import { WebStorageDriver } from '@logosdx/storage'

const driver = new WebStorageDriver(customStorageBackend)
```


### FileSystemDriver


Persists key-value data as a JSON file on disk. Node.js only. Lazy-loads `node:fs/promises` on first use.

```typescript
import { FileSystemDriver } from '@logosdx/storage'

const storage = new StorageAdapter<AppSettings>({
    driver: new FileSystemDriver('./data/settings.json'),
    prefix: 'app'
})

await storage.set('theme', 'dark')
const theme = await storage.get('theme') // 'dark'
```

Notes:

- The file is read on first access and written on every `set()`, `remove()`, and `clear()`.
- If the file does not exist, it starts with an empty store.


### IndexedDBDriver


Stores structured cloneable data in IndexedDB. Browser only. Ideal for large datasets and complex objects since IndexedDB natively supports structured cloning.

```typescript
import { IndexedDBDriver } from '@logosdx/storage'

const storage = new StorageAdapter<AppData>({
    driver: new IndexedDBDriver('my-app', 'settings'),
    structured: true  // skip JSON serialization -- IndexedDB handles it
})

await storage.set('preferences', { theme: 'dark', fontSize: 14 })
```

Constructor:

```typescript
new IndexedDBDriver(dbName: string, storeName?: string)
```

- `dbName`: IndexedDB database name.
- `storeName`: Object store name. Defaults to `'store'`.


## Custom Drivers


Implement the `StorageDriver` interface to use any backend. Here is an example using Redis:

```typescript
import type { StorageDriver } from '@logosdx/storage'
import Redis from 'ioredis'

export class RedisDriver implements StorageDriver {

    #client: Redis

    constructor(redisUrl: string) {

        this.#client = new Redis(redisUrl)
    }

    async get(key: string) {

        const raw = await this.#client.get(key)
        return raw ?? null
    }

    async set(key: string, value: unknown) {

        await this.#client.set(key, String(value))
    }

    async remove(key: string) {

        await this.#client.del(key)
    }

    async keys() {

        return this.#client.keys('*')
    }

    async clear() {

        const allKeys = await this.keys()

        if (allKeys.length > 0) {

            await this.#client.del(...allKeys)
        }
    }
}

// Usage
const storage = new StorageAdapter<SessionData>({
    driver: new RedisDriver('redis://localhost:6379'),
    prefix: 'sessions'
})
```


## Events


StorageAdapter uses `@logosdx/observer` for reactive events.

### Event Names

| Event | Fired |
|-------|-------|
| `before-set` | Before a value is written |
| `after-set` | After a value is written |
| `before-remove` | Before a key is removed |
| `after-remove` | After a key is removed |
| `clear` | When `clear()` is called |

### Event Payload

```typescript
interface StorageEventPayload<V, K extends keyof V> {
    key: K
    value?: V[K] | null
}
```

### Subscribing

`on()` returns a cleanup function. Use `off()` for manual removal.

```typescript
// Subscribe -- returns cleanup function
const cleanup = storage.on('after-set', (event) => {
    console.log('Set:', event.key, event.value)
})

// Remove later
cleanup()

// Or use off() directly
function handleRemove(event) {
    console.log('Removed:', event.key)
}

storage.on('before-remove', handleRemove)
storage.off('before-remove', handleRemove)
```

### Event Ordering

- `before-*` fires before the driver operation.
- `after-*` fires after the driver operation.
- Bulk `set({ ... })` emits one event pair per key.


## scope()


Create a single-key scoped interface. All methods on the scoped object are async and delegate to the parent adapter.

```typescript
scope<K extends keyof Values>(key: K): ScopedKey<Values, K>
```

```typescript
interface ScopedKey<V, K extends keyof V> {
    get(): Promise<V[K]>
    set(value: V[K]): Promise<void>
    assign(val: Partial<V[K]>): Promise<void>
    rm(): Promise<void>
    remove(): Promise<void>
    clear(): Promise<void>
}
```

Example:

```typescript
const userStorage = storage.scope('user')

await userStorage.set({ id: '123', name: 'Charlie' })
await userStorage.assign({ email: 'charlie@example.com' })
const user = await userStorage.get()
await userStorage.remove()
```


## Type Definitions


```typescript
interface StorageDriver {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
    keys(): Promise<string[]>;
    clear(): Promise<void>;
}

type StorageEventName =
    | 'before-set'
    | 'after-set'
    | 'before-remove'
    | 'after-remove'
    | 'clear';

interface StorageEventPayload<V, K extends keyof V = keyof V> {
    key: K;
    value?: V[K] | null;
}

type StorageEventListener<V> = (
    payload: StorageEventPayload<V>
) => void;

interface ScopedKey<V, K extends keyof V> {
    get(): Promise<V[K]>;
    set(value: V[K]): Promise<void>;
    assign(val: Partial<V[K]>): Promise<void>;
    rm(): Promise<void>;
    remove(): Promise<void>;
    clear(): Promise<void>;
}

declare class StorageAdapter<Values> {
    constructor(config: StorageAdapter.Config);

    readonly driver: StorageDriver;
    readonly prefix?: string;
    readonly structured: boolean;

    remove: StorageAdapter<Values>['rm'];
    reset: StorageAdapter<Values>['clear'];

    get(): Promise<Values>;
    get<K extends keyof Values>(key: K): Promise<Values[K] | null>;
    get<K extends keyof Values>(keys: K[]): Promise<Partial<Values>>;

    set(values: Partial<Values> & Record<string, any>): Promise<void>;
    set<K extends keyof Values>(key: K, value: Values[K]): Promise<void>;

    assign<K extends keyof Values>(key: K, val: Partial<Values[K]>): Promise<void>;

    rm<K extends keyof Values>(keyOrKeys: K | K[]): Promise<void>;

    has(key: keyof Values): Promise<boolean>;
    has(keys: (keyof Values)[]): Promise<boolean[]>;

    clear(): Promise<void>;

    keys(): Promise<(keyof Values)[]>;
    entries(): Promise<[keyof Values, Values[keyof Values]][]>;
    values(): Promise<Values[keyof Values][]>;

    scope<K extends keyof Values>(key: K): ScopedKey<Values, K>;

    on(event: StorageEventName, listener: StorageEventListener<Values>): () => void;
    off(event: StorageEventName, listener: StorageEventListener<Values>): void;
}

declare namespace StorageAdapter {
    interface Config {
        driver: StorageDriver;
        prefix?: string;
        structured?: boolean;
    }
}
```
