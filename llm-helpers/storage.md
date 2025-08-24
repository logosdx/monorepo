---
description: Usage patterns for the @logosdx/storage package.
globs: *.ts
---

# @logosdx/storage Usage Patterns


Type-safe wrapper for localStorage/sessionStorage with event-driven change notifications, prefixed key management, and comprehensive CRUD operations.

## Core API Overview

```typescript
import { StorageAdapter, StorageError, StorageEventNames } from '@logosdx/storage'
import { attemptSync } from '@logosdx/utils'

// Define your storage shape for type safety
interface AppStorage {
    userId: string
    userPreferences: { theme: 'light' | 'dark'; notifications: boolean }
    sessionData: { token: string; expiresAt: number }
}

// Create typed storage adapter
const storage = new StorageAdapter<AppStorage>(localStorage, 'myapp')

// Basic operations
const [userId, err] = attemptSync(() => storage.get('userId'))
storage.set('userId', '12345')
storage.assign('userPreferences', { theme: 'dark' })
storage.rm('sessionData')
```

## StorageAdapter Class

```typescript
class StorageAdapter<Values> extends EventTarget {
    readonly storage: StorageImplementation
    readonly prefix?: string

    // Aliases
    remove: StorageAdapter<Values>['rm']
    reset: StorageAdapter<Values>['clear']

    constructor(storage: StorageImplementation, prefixOrOptions?: string)

    // Event system
    on(ev: keyof typeof StorageEventNames, listener: StorageEventListener<Values>, once = false)
    off(ev: keyof typeof StorageEventNames, listener: EventListenerOrEventListenerObject)
}

export type StorageImplementation = {
    clear(): void
    getItem(key: string, callback?: Func): string | null
    removeItem(key: string): void
    setItem(key: string, value: string): void
}

export enum StorageEventNames {
    'storage-before-set' = 'storage-before-set',
    'storage-after-set' = 'storage-after-set',
    'storage-before-unset' = 'storage-before-unset',
    'storage-after-unset' = 'storage-after-unset'
    // Note: clear() emits individual unset events, not 'storage-reset'
}
```

## CRUD Operations

```typescript
// Get operations (overloaded)
const allData = storage.get()                    // Returns entire Values object
const userId = storage.get('userId')             // Returns Values[K] for single key
const subset = storage.get(['userId', 'cache'])  // Returns Partial<NullableObject<Values>>

// Set operations
storage.set('userId', '12345')                   // Single key-value
storage.set({ userId: '12345', cache: {} })     // Multiple key-values

// Object assignment (deep merge)
storage.assign('userPreferences', { theme: 'light' })

// Remove operations
storage.rm('userId')                             // Single key
storage.rm(['userId', 'cache'])                  // Multiple keys
storage.remove('sessionData')                    // Alias for rm()

// Utilities
const hasUser = storage.has('userId')            // boolean
const allKeys = storage.keys()                   // Returns (keyof Values)[]
storage.clear()                                  // Removes all keys with prefix
```

## Key Wrapping Pattern

```typescript
// Wrap individual keys for scoped operations
const userPrefsWrapper = storage.wrap('userPreferences')

// KeyWrapper interface
interface KeyWrapper<T> {
    set: (val: T) => void
    get: () => T
    remove: () => void
    assign: (val: object) => void
    rm: () => void      // Alias for remove
    clear: () => void   // Alias for remove
}

// Usage with error handling
const [sessionData, err] = attemptSync(() => userPrefsWrapper.get())
if (err) {
    console.warn('Failed to get session data:', err)
}
```

## Event System

```typescript
// Event listener type
type StorageEventListener<V, K extends keyof V = keyof V> = (e: StorageEvent<V, K>) => void

// Event object structure
class StorageEvent<V, K extends keyof V = keyof V> extends Event {
    key?: K | K[] | undefined
    value!: V[K]
}

// Listen to storage changes
storage.on('storage-after-set', (event) => {
    console.log('Data set:', event.key, event.value)
})

storage.on('storage-before-unset', (event) => {
    console.log('About to remove:', event.key)
})

// Cleanup pattern
const handleChange = (event) => { /* logic */ }
storage.on('storage-after-set', handleChange)
storage.off('storage-after-set', handleChange)
```

## Custom Storage Adapters

**Sample Memory Storage Adapter:**

```typescript
const memoryStorage = {
    data: new Map<string, string>(),
    clear() { this.data.clear() },
    getItem(key: string) { return this.data.get(key) ?? null },
    removeItem(key: string) { this.data.delete(key) },
    setItem(key: string, value: string) { this.data.set(key, value) }
}

const storage = new StorageAdapter<AppStorage>(memoryStorage, 'app')
```

**Sample Redis Storage Adapter:**

```typescript
import Redis from 'ioredis';
import { debounce, chunk } from '@logosdx/utils';

const redisClient = new Redis()

const redisStorage = {
    keys: new Set<string>(),
    _rememberKeys: debounce(() => {

        redisClient.set('__storage:keys', JSON.stringify(Array.from(redisStorage.keys)));
    }, 100),
    _recallKeys: async () => {

        const keys = await redisClient.get('__storage:keys');

        if (keys) {

            redisStorage.keys.add(...JSON.parse(keys));
        }
    },
    getItem: async (key: string) => redisClient.get(key),
    setItem: async (key: string, value: string) => {

        redisStorage.keys.add(key);
        redisStorage._rememberKeys();

        return redisClient.set(key, value);
    },
    removeItem: async (key: string) => {

        redisStorage.keys.delete(key);
        redisStorage._rememberKeys();

        return redisClient.del(key);
    },
    clear: async () => {

        const allKeys = Array.from(redisStorage.keys);

        await redisClient.del(...allKeys);

        redisStorage.keys.clear();
        redisStorage._rememberKeys();
    }
}

const redisStorage = new StorageAdapter<AppStorage>(redisStorage, 'app')
```

**Sample SQL Storage Adapter:**

```typescript
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';

interface Database {
    storage_items: StorageItemsTable
}

interface StorageItemsTable {
    key: string    // Primary key
    value: string  // Stringified JSON
}

// Create the database connection
const db = new Kysely<Database>({
    dialect: new SqliteDialect({
        database: new Database('storage.db') // Creates storage.db file
    }),
});

const sqlStorage = {
    getItem: async (key: string) => {
        const result = await db.selectFrom('storage_items').where('key', '=', key).select('value').executeTakeFirst();
        return result?.value ?? null;
    },
    setItem: async (key: string, value: string) => {
        await db.insertInto('storage_items').values({ key, value }).execute();
    },
    removeItem: async (key: string) => {
        await db.deleteFrom('storage_items').where('key', '=', key).execute();
    },
    clear: async () => {
        await db.deleteFrom('storage_items').execute();
    }
}

const storage = new StorageAdapter<AppStorage>(sqlStorage, 'app')
```