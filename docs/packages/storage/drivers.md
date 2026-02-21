---
title: Drivers
description: Built-in storage drivers and how to write custom ones.
---

# Drivers


StorageAdapter delegates all persistence to a **driver** — any object implementing the `StorageDriver` interface. Pick a built-in driver or write your own.

[[toc]]

## LocalStorageDriver


Wraps `window.localStorage`. Browser only.

```typescript
import { LocalStorageDriver } from '@logosdx/storage'

const storage = new StorageAdapter<AppStorage>({
    driver: new LocalStorageDriver(),
    prefix: 'myapp'
})
```


## SessionStorageDriver


Wraps `window.sessionStorage`. Browser only. Data is cleared when the tab or window is closed.

```typescript
import { SessionStorageDriver } from '@logosdx/storage'

const storage = new StorageAdapter<AppStorage>({
    driver: new SessionStorageDriver(),
    prefix: 'session'
})
```


## WebStorageDriver


Base class for `LocalStorageDriver` and `SessionStorageDriver`. Use it to wrap any `Storage`-compatible backend:

```typescript
import { WebStorageDriver } from '@logosdx/storage'

const driver = new WebStorageDriver(customStorageBackend)
```

::: warning String coercion
Web Storage backends can only store strings. The driver calls `String(value)` on every write. When using the default `structured: false`, this is transparent because the adapter JSON-serializes first. However, setting `structured: true` with a WebStorage driver will silently coerce objects to `"[object Object]"` — always leave `structured: false` (the default) for WebStorage backends.
:::


## FileSystemDriver


Persists key-value data as a JSON file on disk. Node.js only. Lazy-loads `node:fs/promises` on the first operation (not on construction).

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


## IndexedDBDriver


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

Notes:

- The database connection opens lazily on the first operation.
- The object store is created automatically via `onupgradeneeded` if it does not already exist.


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
