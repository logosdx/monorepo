---
title: Storage
description: Type-safe storage with event system and Storage API compatibility
---

# Storage

Type-safe storage with event system and Storage API compatibility

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
  const { StorageAdapter } = LogosDx.Storage;
</script>
```

## Quick Start

```typescript
import { StorageAdapter } from '@logosdx/storage'

interface AppStorage {
  user: { id: string; name: string; email: string }
  settings: { theme: 'light' | 'dark'; notifications: boolean }
  cart: { id: string; quantity: number }[]
}

// Use any Storage-compatible backend (e.g., localStorage)
const storage = new StorageAdapter<AppStorage>(localStorage, 'myapp')

// Set and get values
storage.set('user', { id: '123', name: 'Jane', email: 'jane@example.com' })
const user = storage.get('user')

// Subscribe to updates
storage.on('storage-after-set', (event) => {
  if (event.key === 'user') {
    updateUserInterface(event.value)
  }
})

// Merge object properties
storage.assign('settings', { notifications: false })

// Remove and clear
storage.rm(['user', 'settings'])
storage.clear()
```

## Core Concepts

StorageAdapter provides a type-safe wrapper around any Storage API compatible backend (localStorage, sessionStorage, AsyncStorage, etc.) with an event system for reactive updates. It uses JSON serialization for data persistence and supports namespacing through prefixes.

## StorageAdapter

### Constructor

```typescript
new StorageAdapter<Values>(storage: StorageImplementation, prefixOrOptions?: string)
```

- `storage`: Any implementation that supports the `Storage` API (`getItem`, `setItem`, `removeItem`, `clear`).
- `prefixOrOptions`: Optional string prefix for namespacing keys. Keys are stored as `prefix:key`.

### StorageImplementation

```typescript
type StorageImplementation = {
  clear(): void
  getItem(key: string, callback?: Function): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}
```

### Core Methods

#### `get()`

Overloaded data retrieval.

```typescript
// Get all values
get(): Values

// Get a specific key
get<K extends keyof Values>(key: K): Values[K]

// Get multiple keys
get<K extends keyof Values>(keys: K[]): Partial<NullableObject<Values>>
```

Examples:

```typescript
const all = storage.get()
const user = storage.get('user')
const { user, token } = storage.get(['user', 'token'])
```

Notes:

- Missing keys resolve to `null` in the returned structure (not `undefined`).
- All values are deserialized via `JSON.parse`.

#### `set()`

Write one or multiple values.

```typescript
// Set multiple pairs
set(values: Partial<Values> & Record<string, any>): void

// Set one pair
set<K extends keyof Values>(key: K, value: Values[K]): void
```

Examples:

```typescript
storage.set('user', { id: '123', name: 'Alice' })

storage.set({
  user: { id: '123', name: 'Alice' },
  token: 'jwt-token',
  preferences: { theme: 'dark' }
})
```

Notes:

- Values are serialized via `JSON.stringify`.
- Using the object form triggers one event per key.

#### `rm()` / `remove()`

Delete keys.

```typescript
rm<K extends keyof Values>(key: K): void
rm<K extends keyof Values>(keys: K[]): void
```

Aliases: `remove()`.

#### `has()`

Check key existence without retrieving the value.

```typescript
has(key: keyof Values): boolean
has(keys: (keyof Values)[]): boolean[]
```

Notes:

- Returns `false` for keys set to `null`.
- Prefer checking via `getItem(...) !== null` in custom implementations.

#### `clear()` / `reset()`

Remove all keys under the configured prefix.

```typescript
clear(): void
```

Alias: `reset()`.

Notes:

- Clears only keys matching the instance prefix.

#### `assign()`

Shallow-merge object values.

```typescript
assign<K extends keyof Values>(key: K, val: Partial<Values[K]>): void
```

Example:

```typescript
storage.set('user', { id: '123', name: 'Bob' })
storage.assign('user', { email: 'bob@example.com' })
// Result: { id: '123', name: 'Bob', email: 'bob@example.com' }
```

Notes:

- Throws if the current value or provided value is not an object.
- Uses `Object.assign` semantics (shallow merge).

### Utility Methods

#### `keys()`

```typescript
keys(): (keyof Values)[]
```

Return all keys in the current prefix scope.

#### `entries()`

```typescript
entries(): [string, unknown][]
```

Return `[key, value]` pairs for all keys in the current prefix scope.

#### `values()`

```typescript
values(): unknown[]
```

Return all values in the current prefix scope.

#### `wrap()`

Create a single-key scoped interface.

```typescript
wrap<K extends keyof Values>(key: K): {
  set: (val: Values[K]) => void
  get: () => Values[K]
  remove: () => void
  assign: (val: object) => void
  rm: () => void
  clear: () => void
}
```

Example:

```typescript
const userStorage = storage.wrap('user')
userStorage.set({ id: '123', name: 'Charlie' })
userStorage.assign({ email: 'charlie@example.com' })
userStorage.remove()
```

### Events

`StorageAdapter` extends `EventTarget` and emits structured storage events.

#### Event Names

```typescript
enum StorageEventNames {
  'storage-before-set' = 'storage-before-set',
  'storage-after-set' = 'storage-after-set',
  'storage-before-unset' = 'storage-before-unset',
  'storage-after-unset' = 'storage-after-unset',
  'storage-reset' = 'storage-reset'
}
```

#### `on()` / `off()`

```typescript
on(
  ev: keyof typeof StorageEventNames,
  listener: StorageEventListener<Values>,
  once?: boolean
): void

off(
  ev: keyof typeof StorageEventNames,
  listener: EventListenerOrEventListenerObject
): void
```

Example:

```typescript
function handleSet(event) {
  console.log('Set:', event.key, event.value)
}

storage.on('storage-after-set', handleSet)
// ...
storage.off('storage-after-set', handleSet)
```

#### StorageEvent

```typescript
class StorageEvent<V, K extends keyof V = keyof V> extends Event {
  key?: K | K[] | undefined
  value!: V[K]
}
```

Event ordering:

- `storage-before-*` fires before the operation.
- `storage-after-*` fires after the operation.
- Bulk `set({ ... })` emits one event per key.

### Best Practices

#### 1) Type safety and validation

Define storage interfaces upfront and validate at boundaries when reading untrusted data.

```typescript
interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: string
  notifications: {
    email: boolean
    push: boolean
    marketing: boolean
  }
}

interface AppStorage {
  user: UserPreferences
  session: { token: string; expires: number }
  cache: Record<string, unknown>
}

const storage = new StorageAdapter<AppStorage>(localStorage, 'myapp')
const theme = storage.get('user')?.theme
```

Runtime validation example:

```typescript
const getUserPrefs = (): UserPreferences | null => {
  const raw = storage.get('user')
  if (!raw || typeof raw !== 'object') return null
  if (!['light', 'dark', 'auto'].includes(raw.theme)) return null
  if (typeof raw.language !== 'string') return null
  return raw as UserPreferences
}
```

#### 2) Prefixing

Use hierarchical prefixes to isolate features and environments.

```typescript
const APP = 'myapp'
const USERS = `${APP}:user`
const CACHE = `${APP}:cache`

const userStorage = new StorageAdapter(localStorage, USERS)
const cacheStorage = new StorageAdapter(localStorage, CACHE)
```

Note: Avoid special regex characters in prefixes to simplify filtering.

#### 3) Event-driven updates

React to updates from a single source of truth.

```typescript
const storage = new StorageAdapter<AppStorage>(localStorage, 'myapp')

storage.on('storage-after-set', (event) => {
  if (event.key === 'user') {
    updateUserInterface(event.value)
  }
})
```

Cross-tab synchronization example:

```typescript
window.addEventListener('storage', (event) => {
  if (event.key?.startsWith('myapp:user:')) {
    refreshUserInterface()
  }
})
```

#### 4) Wrappers

Create domain-specific accessors to simplify call sites.

```typescript
class UserPreferencesManager {
  private userKey = storage.wrap('user')

  getTheme(): string {
    return this.userKey.get()?.theme ?? 'auto'
  }

  setTheme(theme: 'light' | 'dark' | 'auto'): void {
    this.userKey.assign({ theme })
  }

  reset(): void {
    this.userKey.remove()
  }
}
```

#### 5) Bulk operations

Batch updates for related keys.

```typescript
const updateUserSession = (sessionData: { token: string; expires: number; userId: string }) => {
  storage.set({
    token: sessionData.token,
    expires: sessionData.expires,
    userId: sessionData.userId
  })
}
```

#### 6) Assignment pattern

Prefer `assign()` for shallow merges; avoid destructive overwrites.

```typescript
const updateUser = (updates: Partial<UserPreferences>) => {
  const current = storage.get('user') ?? {}
  storage.set('user', { ...current, ...updates })
}

const updateNotificationSettings = (settings: Partial<UserPreferences['notifications']>) => {
  const current = storage.get('user')?.notifications ?? {}
  storage.assign('user', { notifications: { ...current, ...settings } })
}
```

### Notes and Constraints

- JSON serialization round-trips change certain JS types:
  - `Date` values become strings (use ISO strings and convert at boundaries).
  - `Map` and `Set` become plain objects.
  - `undefined` becomes `null`.
  - Functions are not serializable.
- Existence checks should be based on `getItem(key) !== null` at the storage layer. If you maintain a custom `has()` implementation, ensure it does not rely on `hasOwnProperty` on the `Storage` object.

Example conversion helpers:

```typescript
// Persist dates as ISO strings
const saveDate = (date: Date) => storage.set('updatedAt', date.toISOString())
const loadDate = () => new Date(storage.get('updatedAt'))
```

### Troubleshooting

#### Verify data exists

```typescript
console.log('Specific key:', localStorage.getItem('myprefix:mykey'))
console.log('Adapter:', storage.get('mykey'))
```

#### Inspect prefixing

```typescript
const storage = new StorageAdapter(localStorage, 'myapp')
console.log('Scoped keys:', storage.keys())
console.log('Local keys:', Object.keys(localStorage).filter(k => k.startsWith('myapp:')))
```

#### Trace events

```typescript
const storage = new StorageAdapter(localStorage, 'debug')
;['storage-before-set', 'storage-after-set', 'storage-before-unset', 'storage-after-unset', 'storage-reset']
  .forEach(eventName => {
    storage.on(eventName, (e) => {
      console.log(`[${eventName}]`, e.key, e.value)
    })
  })

storage.set('test', 'value')
```

### Error Types

#### StorageError

```typescript
class StorageError extends Error {}
```

Thrown when `assign()` receives an invalid value or when the current value is not an object.

### Complete Type Definitions

```typescript
type StorageImplementation = {
  clear(): void;
  getItem(key: string, callback?: Function): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

declare class StorageEvent<Values> extends Event {
  key?: keyof Values | (keyof Values)[];
  value: Values[keyof Values] | {
    [K in keyof Values]: Values[K];
  };
}

declare enum StorageEventNames {
  'storage-before-set' = "storage-before-set",
  'storage-after-set' = "storage-after-set",
  'storage-before-unset' = "storage-before-unset",
  'storage-after-unset' = "storage-after-unset",
  'storage-reset' = "storage-reset"
}

type StorageEventListener<Values> = (e: StorageEvent<Values>) => void;

declare class StorageAdapter<Values> extends EventTarget {
  constructor(
    storage: StorageImplementation,
    prefixOrOptions?: string
  );

  readonly storage: StorageImplementation;
  readonly prefix?: string;

  on(
    ev: keyof typeof StorageEventNames,
    listener: StorageEventListener<Values>,
    once?: boolean
  ): void;

  off(
    ev: keyof typeof StorageEventNames,
    listener: EventListenerOrEventListenerObject
  ): void;

  get(): Values;
  get<K extends keyof Values>(key: K): Values[K];
  get<K extends keyof Values>(keys: K[]): Partial<NullableObject<Values>>;

  set(values: Partial<Values> & Record<string, any>): void;
  set<K extends keyof Values>(key: K, value: Values[K]): void;

  assign<K extends keyof Values>(key: K, val: Partial<Values[K]>): void;

  rm<K extends keyof Values>(keyOrKeys: K | K[]): void;
  remove: StorageAdapter<Values>['rm'];

  has(key: keyof Values): boolean;
  has(keys: (keyof Values)[]): boolean[];

  clear(): void;
  reset: StorageAdapter<Values>['clear'];

  keys(): (keyof Values)[];
  entries(): [string, unknown][];
  values(): unknown[];

  wrap<K extends keyof Values>(key: K): {
    set: (val: Values[K]) => void;
    get: () => Values[K];
    remove: () => void;
    assign: (val: object) => void;
    rm: () => void;
    clear: () => void;
  };
}
```
