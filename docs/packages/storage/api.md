---
title: API Reference
description: StorageAdapter constructor, methods, and scoped keys.
---

# API Reference


## Constructor


```typescript
new StorageAdapter<Values>(config: StorageAdapter.Config)
```

**Config:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `driver` | `StorageDriver` | *required* | Backend driver for persistence |
| `prefix` | `string` | `''` | Key namespace prefix |
| `structured` | `boolean` | `false` | Skip JSON serialization when `true` |

**Example:**

```typescript
const storage = new StorageAdapter<AppStorage>({
    driver: new LocalStorageDriver(),
    prefix: 'myapp',
    structured: false
})
```

## Public Properties


| Property | Type | Description |
|----------|------|-------------|
| `driver` | `StorageDriver` | The underlying driver instance |
| `prefix` | `string` | Configured prefix (empty string if not provided) |
| `structured` | `boolean` | Whether JSON serialization is skipped |

::: tip Key Validation
All methods that accept a key will throw if the key is an empty string. This is enforced via `assert(key, 'invalid key')`.
:::


## Core Methods


### `get()`


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


### `set()`


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


### `rm()` / `remove()`


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


### `has()`


Check key existence without retrieving the value.

```typescript
has(key: keyof Values): Promise<boolean>
has(keys: (keyof Values)[]): Promise<boolean[]>
```

```typescript
const exists = await storage.has('user')
const [hasUser, hasSettings] = await storage.has(['user', 'settings'])
```


### `clear()` / `reset()`


Remove all keys under the configured prefix.

```typescript
clear(): Promise<void>
```

Alias: `reset()`.

Notes:

- Emits a `clear` event.
- Only clears keys matching the instance prefix.


### `assign()`


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

- If the key does not exist (or is `null`), `assign()` behaves like `set()`.
- Throws `Error` if the current value is not an object: `key (keyName) value cannot be assigned (not an object)`.
- Uses `Object.assign` semantics (shallow merge).


## Utility Methods


### `keys()`


```typescript
keys(): Promise<(keyof Values)[]>
```

Return all keys in the current prefix scope.


### `entries()`


```typescript
entries(): Promise<[keyof Values, Values[keyof Values]][]>
```

Return `[key, value]` pairs for all keys in the current prefix scope. Internally calls `get()` to fetch and deserialize all values.


### `values()`


```typescript
values(): Promise<Values[keyof Values][]>
```

Return all values in the current prefix scope. Internally calls `get()` to fetch and deserialize all values.


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

::: warning `clear()` on a scoped key
On a scoped key, `clear()` is an alias for `remove()` — it deletes the scoped key, not all keys in the adapter. `rm()` is also an alias for `remove()`.
:::

Example:

```typescript
const userStorage = storage.scope('user')

await userStorage.set({ id: '123', name: 'Charlie' })
await userStorage.assign({ email: 'charlie@example.com' })
const user = await userStorage.get()
await userStorage.remove()
```
