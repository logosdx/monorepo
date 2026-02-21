---
description: Usage patterns for the @logosdx/storage package.
globs: '*.ts'
---

# @logosdx/storage Usage Patterns


Async driver-based key-value abstraction with type-safe keys, prefix scoping, JSON serialization, and reactive events via `@logosdx/observer`.

## Core API Overview

```typescript
import {
    StorageAdapter,
    LocalStorageDriver,
    SessionStorageDriver,
    FileSystemDriver,
    IndexedDBDriver,
} from '@logosdx/storage'
import { attempt } from '@logosdx/utils'

// Define your storage shape for type safety
interface AppStorage {
    userId: string
    userPreferences: { theme: 'light' | 'dark'; notifications: boolean }
    sessionData: { token: string; expiresAt: number }
}

// Create typed storage adapter with a driver
const storage = new StorageAdapter<AppStorage>({
    driver: new LocalStorageDriver(),
    prefix: 'myapp'
})

// All operations are async
const [userId, err] = await attempt(() => storage.get('userId'))
await storage.set('userId', '12345')
await storage.assign('userPreferences', { theme: 'dark' })
await storage.rm('sessionData')
```

## StorageAdapter Class

```typescript
class StorageAdapter<Values> {
    readonly driver: StorageDriver
    readonly prefix?: string
    readonly structured: boolean

    // Aliases
    remove: StorageAdapter<Values>['rm']
    reset: StorageAdapter<Values>['clear']

    constructor(config: StorageAdapter.Config)

    // Event system (returns cleanup function)
    on(event: StorageEventName, listener: StorageEventListener<Values>): () => void
    off(event: StorageEventName, listener: StorageEventListener<Values>): void
}

namespace StorageAdapter {
    interface Config {
        driver: StorageDriver
        prefix?: string
        structured?: boolean  // skip JSON serialization (default: false)
    }
}

interface StorageDriver {
    get(key: string): Promise<unknown>
    set(key: string, value: unknown): Promise<void>
    remove(key: string): Promise<void>
    keys(): Promise<string[]>
    clear(): Promise<void>
}

type StorageEventName =
    | 'before-set'
    | 'after-set'
    | 'before-remove'
    | 'after-remove'
    | 'clear'
```

## CRUD Operations

```typescript
// Get operations (overloaded, all async)
const allData = await storage.get()                    // Returns entire Values object
const userId = await storage.get('userId')             // Returns Values[K] | null
const subset = await storage.get(['userId', 'cache'])  // Returns Partial<Values>

// Set operations
await storage.set('userId', '12345')                   // Single key-value
await storage.set({ userId: '12345', cache: {} })     // Multiple key-values

// Object assignment (shallow merge)
await storage.assign('userPreferences', { theme: 'light' })

// Remove operations
await storage.rm('userId')                             // Single key
await storage.rm(['userId', 'cache'])                  // Multiple keys
await storage.remove('sessionData')                    // Alias for rm()

// Utilities
const hasUser = await storage.has('userId')            // boolean
const allKeys = await storage.keys()                   // (keyof Values)[]
const allEntries = await storage.entries()             // [key, value][]
const allValues = await storage.values()               // value[]
await storage.clear()                                  // Removes all keys with prefix
```

## Built-in Drivers

```typescript
// Browser - localStorage
const local = new StorageAdapter<AppStorage>({
    driver: new LocalStorageDriver(),
    prefix: 'app'
})

// Browser - sessionStorage
const session = new StorageAdapter<AppStorage>({
    driver: new SessionStorageDriver(),
    prefix: 'session'
})

// Node.js - file system (JSON file)
const file = new StorageAdapter<AppSettings>({
    driver: new FileSystemDriver('./data/settings.json'),
    prefix: 'config'
})

// Browser - IndexedDB (structured data, skip JSON serialization)
const idb = new StorageAdapter<AppData>({
    driver: new IndexedDBDriver('my-app', 'settings'),
    structured: true
})
```

## scope() Pattern

```typescript
// Create a single-key scoped interface (all methods async)
const userScope = storage.scope('userPreferences')

await userScope.set({ theme: 'dark', notifications: true })
await userScope.assign({ theme: 'light' })
const prefs = await userScope.get()
await userScope.remove()

// ScopedKey interface
interface ScopedKey<V, K extends keyof V> {
    get(): Promise<V[K]>
    set(value: V[K]): Promise<void>
    assign(val: Partial<V[K]>): Promise<void>
    rm(): Promise<void>
    remove(): Promise<void>
    clear(): Promise<void>
}
```

## Event System

```typescript
// on() returns a cleanup function
const cleanup = storage.on('after-set', (event) => {
    console.log('Set:', event.key, event.value)
})

// Remove when done
cleanup()

// Event payload
interface StorageEventPayload<V, K extends keyof V> {
    key: K
    value?: V[K] | null
}

// All event names (no prefix)
// 'before-set' | 'after-set' | 'before-remove' | 'after-remove' | 'clear'

// Manual off()
function handler(event) { /* ... */ }
storage.on('before-remove', handler)
storage.off('before-remove', handler)
```

## Custom Driver Implementation

```typescript
import type { StorageDriver } from '@logosdx/storage'

// Implement 5 async methods
class RedisDriver implements StorageDriver {

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

const storage = new StorageAdapter<SessionData>({
    driver: new RedisDriver('redis://localhost:6379'),
    prefix: 'sessions'
})
```

## Structured vs Serialized Mode

```typescript
// Default: JSON serialization (localStorage, sessionStorage, file system)
const serialized = new StorageAdapter<AppStorage>({
    driver: new LocalStorageDriver(),
    prefix: 'app'
    // structured defaults to false
})

// JSON caveats: Date → string, Map/Set → object, undefined → null

// Structured: skip JSON (IndexedDB, custom drivers with native object support)
const structured = new StorageAdapter<AppStorage>({
    driver: new IndexedDBDriver('my-app'),
    structured: true
})

// Values pass through to/from the driver without serialization
```
