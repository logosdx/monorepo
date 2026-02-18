# Storage v2 Design — Async Driver Architecture


## Summary

Rewrite `@logosdx/storage` as an async-first, driver-based key-value abstraction. The current sync API tightly coupled to `localStorage`/`sessionStorage` becomes a clean separation between `StorageAdapter` (public API) and `StorageDriver` (backend contract). Breaking change — new major version.


## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sync vs Async | Async-only (breaking v2) | React Native AsyncStorage, IndexedDB, FS are all async. Clean slate. |
| Serialization | Configurable via `structured` option | IndexedDB stores structured data natively; localStorage needs JSON. Adapter owns the decision, not the driver. |
| Constructor API | Config object | `{ driver, prefix?, structured? }` — extensible without signature changes. |
| Event system | `@logosdx/observer` | Dogfoods monorepo, cross-platform, returns cleanup functions. |
| Event names | No `storage.` prefix | Scoped to adapter instance, no ambiguity. `before-set`, `after-set`, etc. |
| `wrap()` renamed | `scope()` | Reads naturally: `storage.scope('user')`. |
| Private fields | JS `#private` | Not TypeScript `private`. Consistent with monorepo conventions. |
| FS driver format | Single JSON file | One `.json` file per namespace. Simple, atomic. |
| Driver value type | `unknown` | Can't assume string when structured drivers exist. |


## Architecture

```
User → StorageAdapter (prefix, serialization, events via observer)
           ↓
       StorageDriver (async get/set/remove/keys/clear)
           ↓
       Backend (localStorage, sessionStorage, fs, IndexedDB, etc.)
```


## StorageDriver Interface

The minimal contract every backend implements:

```ts
export interface StorageDriver {

    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
    keys(): Promise<string[]>;
    clear(): Promise<void>;
}
```

5 methods. No generics, no flags, no opinions about serialization.


## StorageAdapter

### Config

```ts
export namespace StorageAdapter {

    export interface Config {
        driver: StorageDriver;
        prefix?: string;
        structured?: boolean;
    }
}
```

### Class

```ts
export class StorageAdapter<Values> {

    readonly driver: StorageDriver;
    readonly prefix?: string;
    readonly structured: boolean;

    constructor(config: StorageAdapter.Config);

    // Data methods (all async)
    async get<K extends keyof Values>(key: K): Promise<Values[K]>;
    async get<K extends keyof Values>(keys: K[]): Promise<Partial<NullableObject<Values>>>;
    async get(): Promise<Values>;

    async set<K extends keyof Values>(key: K, value: Values[K]): Promise<void>;
    async set(values: Partial<Values>): Promise<void>;

    async assign<K extends keyof Values>(key: K, val: Partial<Values[K]>): Promise<void>;

    async rm<K extends keyof Values>(keyOrKeys: K | K[]): Promise<void>;
    remove: StorageAdapter<Values>['rm'];

    async has(key: keyof Values): Promise<boolean>;
    async has(keys: (keyof Values)[]): Promise<boolean[]>;

    async clear(): Promise<void>;
    reset: StorageAdapter<Values>['clear'];

    async keys(): Promise<(keyof Values)[]>;
    async entries(): Promise<[string, unknown][]>;
    async values(): Promise<unknown[]>;

    // Scoped accessor
    scope<K extends keyof Values>(key: K): ScopedKey<Values, K>;

    // Events (via @logosdx/observer)
    on(event: StorageEventName, listener: StorageEventListener<Values>): () => void;
    off(event: StorageEventName, listener: StorageEventListener<Values>): void;
}
```

### Serialization Flow

```
structured: false (default)
    set(key, value) → JSON.stringify(value) → driver.set(key, stringified)
    driver.get(key) → JSON.parse(raw) → return typed value

structured: true
    set(key, value) → driver.set(key, value)    // pass-through
    driver.get(key) → return raw                 // pass-through
```

### Event Names

```ts
type StorageEventName =
    | 'before-set'
    | 'after-set'
    | 'before-remove'
    | 'after-remove'
    | 'clear';
```

No `storage.` prefix — events are scoped to the adapter instance.

### scope() Method

```ts
const user = storage.scope('user');
await user.get();
await user.set({ name: 'Jane' });
await user.assign({ email: 'j@x.com' });
await user.remove();
```

Returns an object with async `get`, `set`, `assign`, `rm`, `remove`, `clear` — all pre-bound to the given key.


## Built-in Drivers

### WebStorageDriver (base for browser storage)

```ts
class WebStorageDriver implements StorageDriver {

    #backend: Storage;

    constructor(backend: Storage) {

        this.#backend = backend;
    }

    async get(key: string) { return this.#backend.getItem(key); }
    async set(key: string, value: unknown) { this.#backend.setItem(key, String(value)); }
    async remove(key: string) { this.#backend.removeItem(key); }
    async keys() { return Object.keys(this.#backend); }
    async clear() { this.#backend.clear(); }
}
```

### LocalStorageDriver / SessionStorageDriver

```ts
export class LocalStorageDriver extends WebStorageDriver {
    constructor() { super(localStorage); }
}

export class SessionStorageDriver extends WebStorageDriver {
    constructor() { super(sessionStorage); }
}
```

### FileSystemDriver

```ts
export class FileSystemDriver implements StorageDriver { ... }
```

- Constructor takes a file path: `new FileSystemDriver('./data/config.json')`
- Single JSON file per instance
- Lazy-loads `node:fs/promises` to avoid browser bundle impact
- Reads file into memory on first access, writes back on mutations

### IndexedDBDriver

```ts
export class IndexedDBDriver implements StorageDriver { ... }
```

- Constructor takes database name and optional store name: `new IndexedDBDriver('mydb', 'mystore')`
- Lazy-opens database on first operation
- Natively handles structured data — pair with `structured: true` on the adapter


## File Structure

```
packages/storage/src/
├── index.ts              # Barrel exports
├── types.ts              # StorageDriver, StorageEventName, Config types
├── adapter.ts            # StorageAdapter class
├── events.ts             # Event helpers (makeEvent, StorageEvent class)
└── drivers/
    ├── index.ts          # Re-exports all drivers
    ├── web.ts            # WebStorageDriver, LocalStorageDriver, SessionStorageDriver
    ├── filesystem.ts     # FileSystemDriver
    └── indexeddb.ts      # IndexedDBDriver
```

Tree-shakeable — unused drivers don't bundle.


## Usage Examples

### Browser (localStorage)

```ts
import { StorageAdapter, LocalStorageDriver } from '@logosdx/storage';

const storage = new StorageAdapter<AppStorage>({
    driver: new LocalStorageDriver(),
    prefix: 'myapp',
});

await storage.set('user', { id: '123', name: 'Jane' });
const user = await storage.get('user');
```

### Node.js (filesystem)

```ts
import { StorageAdapter, FileSystemDriver } from '@logosdx/storage';

const storage = new StorageAdapter<AppConfig>({
    driver: new FileSystemDriver('./data/config.json'),
    prefix: 'app',
});

await storage.set('database', { host: 'localhost', port: 5432 });
```

### IndexedDB (structured)

```ts
import { StorageAdapter, IndexedDBDriver } from '@logosdx/storage';

const storage = new StorageAdapter<AppCache>({
    driver: new IndexedDBDriver('cache-db'),
    structured: true,
});

await storage.set('largeDataset', complexObject);
```

### Custom Driver

```ts
import { StorageAdapter, type StorageDriver } from '@logosdx/storage';

class RedisDriver implements StorageDriver {

    #client: RedisClient;

    constructor(client: RedisClient) {

        this.#client = client;
    }

    async get(key: string) { return this.#client.get(key); }
    async set(key: string, value: unknown) { await this.#client.set(key, String(value)); }
    async remove(key: string) { await this.#client.del(key); }
    async keys() { return this.#client.keys('*'); }
    async clear() { await this.#client.flushDb(); }
}

const storage = new StorageAdapter<SessionData>({
    driver: new RedisDriver(redisClient),
    prefix: 'session',
});
```
