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


## What's Next


| Page | Description |
|------|-------------|
| [API Reference](./api) | StorageAdapter constructor, methods, and scoped keys |
| [Drivers](./drivers) | Built-in drivers and how to write custom ones |
| [Events](./events) | Reactive storage events via `@logosdx/observer` |

## Exports Reference


```typescript
import {
    StorageAdapter,              // main adapter class
    LocalStorageDriver,          // wraps window.localStorage
    SessionStorageDriver,        // wraps window.sessionStorage
    WebStorageDriver,            // base class for Web Storage backends
    FileSystemDriver,            // JSON file on disk (Node.js)
    IndexedDBDriver,             // IndexedDB object store (browser)
} from '@logosdx/storage';
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
    readonly prefix: string;
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
