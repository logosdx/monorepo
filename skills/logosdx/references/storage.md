---
description: Usage patterns for the @logosdx/storage package.
globs: '*.ts'
---

# @logosdx/storage Usage Patterns

> **Error handling rule:** Use `attempt()` from `@logosdx/utils` for ALL async storage operations — `get()`, `set()`, `assign()`, `rm()`, `clear()`, `keys()`, `entries()`, `values()`. Storage is I/O. Never use try-catch.

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

// All operations are async — always wrap with attempt()
const [userId, err] = await attempt(() => storage.get('userId'))
if (err) return handleError(err)

const [, setErr] = await attempt(() => storage.set('userId', '12345'))
if (setErr) return handleError(setErr)

const [, assignErr] = await attempt(() => storage.assign('userPreferences', { theme: 'dark' }))
if (assignErr) return handleError(assignErr)

const [, rmErr] = await attempt(() => storage.rm('sessionData'))
if (rmErr) return handleError(rmErr)
```

## StorageAdapter Class

```typescript
class StorageAdapter<Values> {
    readonly driver: StorageDriver
    readonly prefix: string  // defaults to '' (empty string)
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
// Get operations (overloaded, all async) — always use attempt()
const [allData, err1] = await attempt(() => storage.get())                    // Returns entire Values object
const [userId, err2] = await attempt(() => storage.get('userId'))             // Returns Values[K] | null
const [subset, err3] = await attempt(() => storage.get(['userId', 'cache']))  // Returns Partial<Values>

// Set operations
const [, setErr1] = await attempt(() => storage.set('userId', '12345'))                   // Single key-value
const [, setErr2] = await attempt(() => storage.set({ userId: '12345', cache: {} }))     // Multiple key-values

// Object assignment (shallow merge)
// - If key doesn't exist, behaves like set()
// - Throws Error if current value is not an object
// - Error message: "key (keyName) value cannot be assigned (not an object)"
const [, assignErr] = await attempt(() => storage.assign('userPreferences', { theme: 'light' }))

// Remove operations
const [, rmErr1] = await attempt(() => storage.rm('userId'))                             // Single key
const [, rmErr2] = await attempt(() => storage.rm(['userId', 'cache']))                  // Multiple keys
const [, rmErr3] = await attempt(() => storage.remove('sessionData'))                    // Alias for rm()

// Utilities
const [hasUser, hasErr] = await attempt(() => storage.has('userId'))            // boolean
const [allKeys, keysErr] = await attempt(() => storage.keys())                   // (keyof Values)[]
const [allEntries, entriesErr] = await attempt(() => storage.entries())          // [key, value][] (calls get() internally)
const [allValues, valuesErr] = await attempt(() => storage.values())             // value[] (calls get() internally)
const [, clearErr] = await attempt(() => storage.clear())                        // Removes all keys with prefix
```

> **Use `assign()` for partial updates.** It shallow-merges the given object into the stored value. This avoids the read-modify-write pattern (`get` → modify → `set`) and is atomic.

```typescript
// assign() shallow-merges into existing value — no read-modify-write needed
const [, err] = await attempt(() => storage.assign('workspace', {
    members: [...currentMembers, newMember]
}))
if (err) return handleError(err)

// DON'T do this — assign() replaces the get-modify-set pattern:
// const [workspace] = await attempt(() => storage.get('workspace'))
// workspace.members.push(newMember)
// await attempt(() => storage.set('workspace', workspace))
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
// Lazy-loads node:fs/promises on first operation, not on construction
const file = new StorageAdapter<AppSettings>({
    driver: new FileSystemDriver('./data/settings.json'),
    prefix: 'config'
})

// Browser - IndexedDB (structured data, skip JSON serialization)
// Database opens lazily; object store auto-created via onupgradeneeded
const idb = new StorageAdapter<AppData>({
    driver: new IndexedDBDriver('my-app', 'settings'),
    structured: true
})
```

## scope() Pattern

```typescript
// Create a single-key scoped interface (all methods async — use attempt())
const userScope = storage.scope('userPreferences')

const [, scopeSetErr] = await attempt(() => userScope.set({ theme: 'dark', notifications: true }))
const [, scopeAssignErr] = await attempt(() => userScope.assign({ theme: 'light' }))
const [prefs, scopeGetErr] = await attempt(() => userScope.get())
const [, scopeRmErr] = await attempt(() => userScope.remove())

// ScopedKey interface
// WARNING: clear() is an alias for remove() on scoped keys — it deletes the key, not all keys
interface ScopedKey<V, K extends keyof V> {
    get(): Promise<V[K]>
    set(value: V[K]): Promise<void>
    assign(val: Partial<V[K]>): Promise<void>
    rm(): Promise<void>       // alias for remove()
    remove(): Promise<void>
    clear(): Promise<void>    // alias for remove() — NOT adapter.clear()
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

// Event payload — undefined values are normalized to null
interface StorageEventPayload<V, K extends keyof V> {
    key: K
    value?: V[K] | null  // present for set events; null for remove events
}

// All event names
// 'before-set' | 'after-set'       → payload has key + value
// 'before-remove' | 'after-remove' → payload has key, value is null
// 'clear'                           → no payload

// Empty string keys throw: assert(key, 'invalid key')

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
// WARNING: WebStorageDriver calls String(value) — never use structured: true with WebStorage drivers

// Structured: skip JSON (IndexedDB, custom drivers with native object support)
const structured = new StorageAdapter<AppStorage>({
    driver: new IndexedDBDriver('my-app'),
    structured: true
})

// Values pass through to/from the driver without serialization
```
