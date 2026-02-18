# Storage v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `@logosdx/storage` as an async-first, driver-based key-value abstraction with built-in drivers for localStorage, sessionStorage, filesystem, and IndexedDB.

**Architecture:** `StorageDriver` interface (5 async methods) → `StorageAdapter` class (public API with prefix, serialization, observer events) → Built-in drivers. See `docs/plans/2026-02-18-storage-v2-design.md` for full design.

**Tech Stack:** TypeScript, `@logosdx/utils` (attempt, assert, clone, definePublicProps), `@logosdx/observer` (ObserverEngine), vitest

---

### Task 1: Types & Driver Interface

**Files:**
- Create: `packages/storage/src/types.ts`
- Modify: `packages/storage/src/index.ts`
- Test: `tests/src/storage/types.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';

describe('@logosdx/storage: types', () => {

    it('StorageDriver interface is importable', async () => {

        const { StorageDriver } = await import(
            '../../../packages/storage/src/types.ts'
        );

        // StorageDriver is a type, so we just verify the module loads
        expect(true).to.be.true;
    });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test storage/types`
Expected: FAIL — module not found

**Step 3: Write types.ts**

Create `packages/storage/src/types.ts`:

```ts
import type { NullableObject } from '@logosdx/utils';

export interface StorageDriver {

    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
    keys(): Promise<string[]>;
    clear(): Promise<void>;
}

export type StorageEventName =
    | 'before-set'
    | 'after-set'
    | 'before-remove'
    | 'after-remove'
    | 'clear';

export interface StorageEventPayload<V, K extends keyof V = keyof V> {
    key: K;
    value?: V[K] | null;
}

export type StorageEventListener<V> = (
    payload: StorageEventPayload<V>
) => void;

export interface ScopedKey<V, K extends keyof V> {
    get(): Promise<V[K]>;
    set(value: V[K]): Promise<void>;
    assign(val: Partial<V[K]>): Promise<void>;
    rm(): Promise<void>;
    remove(): Promise<void>;
    clear(): Promise<void>;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test storage/types`
Expected: PASS

**Step 5: Commit**

```
feat(storage): add StorageDriver interface and v2 type definitions
```

---

### Task 2: WebStorageDriver

**Files:**
- Create: `packages/storage/src/drivers/web.ts`
- Create: `packages/storage/src/drivers/index.ts`
- Test: `tests/src/storage/drivers/web.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('@logosdx/storage: WebStorageDriver', () => {

    let driver: InstanceType<typeof import(
        '../../../../packages/storage/src/drivers/web.ts'
    ).WebStorageDriver>;

    beforeEach(() => {

        localStorage.clear();
    });

    it('should set and get a value', async () => {

        const { LocalStorageDriver } = await import(
            '../../../../packages/storage/src/drivers/web.ts'
        );

        driver = new LocalStorageDriver();
        await driver.set('key1', 'value1');
        const result = await driver.get('key1');
        expect(result).to.equal('value1');
    });

    it('should return null for missing key', async () => {

        const { LocalStorageDriver } = await import(
            '../../../../packages/storage/src/drivers/web.ts'
        );

        driver = new LocalStorageDriver();
        const result = await driver.get('nonexistent');
        expect(result).to.be.null;
    });

    it('should remove a key', async () => {

        const { LocalStorageDriver } = await import(
            '../../../../packages/storage/src/drivers/web.ts'
        );

        driver = new LocalStorageDriver();
        await driver.set('key1', 'value1');
        await driver.remove('key1');
        const result = await driver.get('key1');
        expect(result).to.be.null;
    });

    it('should return all keys', async () => {

        const { LocalStorageDriver } = await import(
            '../../../../packages/storage/src/drivers/web.ts'
        );

        driver = new LocalStorageDriver();
        await driver.set('a', '1');
        await driver.set('b', '2');
        const keys = await driver.keys();
        expect(keys).to.include('a');
        expect(keys).to.include('b');
    });

    it('should clear all keys', async () => {

        const { LocalStorageDriver } = await import(
            '../../../../packages/storage/src/drivers/web.ts'
        );

        driver = new LocalStorageDriver();
        await driver.set('a', '1');
        await driver.set('b', '2');
        await driver.clear();
        const keys = await driver.keys();
        expect(keys).to.have.length(0);
    });

    it('SessionStorageDriver uses sessionStorage', async () => {

        const { SessionStorageDriver } = await import(
            '../../../../packages/storage/src/drivers/web.ts'
        );

        sessionStorage.clear();
        const driver = new SessionStorageDriver();
        await driver.set('x', 'y');
        expect(sessionStorage.getItem('x')).to.equal('y');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test storage/drivers/web`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `packages/storage/src/drivers/web.ts`:

```ts
import type { StorageDriver } from '../types.ts';

export class WebStorageDriver implements StorageDriver {

    #backend: Storage;

    constructor(backend: Storage) {

        this.#backend = backend;
    }

    async get(key: string) {

        return this.#backend.getItem(key);
    }

    async set(key: string, value: unknown) {

        this.#backend.setItem(key, String(value));
    }

    async remove(key: string) {

        this.#backend.removeItem(key);
    }

    async keys() {

        return Object.keys(this.#backend);
    }

    async clear() {

        this.#backend.clear();
    }
}

export class LocalStorageDriver extends WebStorageDriver {

    constructor() {

        super(localStorage);
    }
}

export class SessionStorageDriver extends WebStorageDriver {

    constructor() {

        super(sessionStorage);
    }
}
```

Create `packages/storage/src/drivers/index.ts`:

```ts
export { WebStorageDriver, LocalStorageDriver, SessionStorageDriver } from './web.ts';
```

**Step 4: Run test to verify it passes**

Run: `pnpm test storage/drivers/web`
Expected: PASS

**Step 5: Commit**

```
feat(storage): add WebStorageDriver, LocalStorageDriver, SessionStorageDriver
```

---

### Task 3: StorageAdapter Core (get, set, rm, has, clear, keys, entries, values)

**Files:**
- Create: `packages/storage/src/adapter.ts`
- Create: `packages/storage/src/events.ts`
- Test: `tests/src/storage/adapter/core.test.ts`

This is the largest task. The adapter owns prefix management, serialization, and observer events. Use a simple in-memory driver for testing (avoids browser dependency in tests).

**Step 1: Create a test helper — in-memory driver**

Create `tests/src/storage/_helpers.ts`:

```ts
import type { StorageDriver } from '../../../packages/storage/src/types.ts';

export class MemoryDriver implements StorageDriver {

    #store = new Map<string, unknown>();

    async get(key: string) {

        return this.#store.get(key) ?? null;
    }

    async set(key: string, value: unknown) {

        this.#store.set(key, value);
    }

    async remove(key: string) {

        this.#store.delete(key);
    }

    async keys() {

        return [...this.#store.keys()];
    }

    async clear() {

        this.#store.clear();
    }
}
```

**Step 2: Write the failing tests**

Create `tests/src/storage/adapter/core.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDriver } from '../_helpers.ts';
import { StorageAdapter } from '../../../../packages/storage/src/adapter.ts';

interface TestValues {
    user: { id: string; name: string };
    count: number;
    tags: string[];
}

describe('@logosdx/storage: adapter core', () => {

    let storage: StorageAdapter<TestValues>;
    let driver: MemoryDriver;

    beforeEach(() => {

        driver = new MemoryDriver();
        storage = new StorageAdapter<TestValues>({ driver });
    });

    describe('set and get', () => {

        it('should set and get a single value', async () => {

            await storage.set('count', 42);
            const result = await storage.get('count');
            expect(result).to.equal(42);
        });

        it('should set and get an object value', async () => {

            await storage.set('user', { id: '1', name: 'Jane' });
            const result = await storage.get('user');
            expect(result).to.deep.equal({ id: '1', name: 'Jane' });
        });

        it('should set multiple values from object', async () => {

            await storage.set({ count: 10, tags: ['a', 'b'] } as any);
            expect(await storage.get('count')).to.equal(10);
            expect(await storage.get('tags')).to.deep.equal(['a', 'b']);
        });

        it('should get multiple keys as partial object', async () => {

            await storage.set('count', 5);
            await storage.set('tags', ['x']);
            const result = await storage.get(['count', 'tags']);
            expect(result).to.deep.equal({ count: 5, tags: ['x'] });
        });

        it('should get all values', async () => {

            await storage.set('count', 1);
            await storage.set('tags', ['a']);
            const all = await storage.get();
            expect(all).to.deep.equal({ count: 1, tags: ['a'] });
        });

        it('should return null for missing key', async () => {

            const result = await storage.get('count');
            expect(result).to.be.null;
        });
    });

    describe('serialization', () => {

        it('should JSON serialize when structured is false (default)', async () => {

            await storage.set('user', { id: '1', name: 'Jane' });
            const raw = await driver.get('user');
            expect(typeof raw).to.equal('string');
            expect(JSON.parse(raw as string)).to.deep.equal({ id: '1', name: 'Jane' });
        });

        it('should pass through when structured is true', async () => {

            const structured = new StorageAdapter<TestValues>({
                driver,
                structured: true,
            });

            await structured.set('user', { id: '1', name: 'Jane' });
            const raw = await driver.get('user');
            expect(typeof raw).to.equal('object');
            expect(raw).to.deep.equal({ id: '1', name: 'Jane' });
        });
    });

    describe('prefix', () => {

        it('should prefix keys in the driver', async () => {

            const prefixed = new StorageAdapter<TestValues>({
                driver,
                prefix: 'app',
            });

            await prefixed.set('count', 42);
            const raw = await driver.get('app:count');
            expect(raw).to.exist;
        });

        it('should only return keys matching prefix', async () => {

            const prefixed = new StorageAdapter<TestValues>({
                driver,
                prefix: 'app',
            });

            await driver.set('other:key', '"val"');
            await prefixed.set('count', 1);
            const keys = await prefixed.keys();
            expect(keys).to.deep.equal(['count']);
        });
    });

    describe('rm / remove', () => {

        it('should remove a single key', async () => {

            await storage.set('count', 42);
            await storage.rm('count');
            expect(await storage.get('count')).to.be.null;
        });

        it('should remove multiple keys', async () => {

            await storage.set('count', 42);
            await storage.set('tags', ['a']);
            await storage.rm(['count', 'tags']);
            expect(await storage.get('count')).to.be.null;
            expect(await storage.get('tags')).to.be.null;
        });

        it('remove is an alias for rm', async () => {

            expect(storage.remove).to.equal(storage.rm);
        });
    });

    describe('has', () => {

        it('should return true for existing key', async () => {

            await storage.set('count', 42);
            expect(await storage.has('count')).to.be.true;
        });

        it('should return false for missing key', async () => {

            expect(await storage.has('count')).to.be.false;
        });

        it('should return array of booleans for multiple keys', async () => {

            await storage.set('count', 1);
            const result = await storage.has(['count', 'tags']);
            expect(result).to.deep.equal([true, false]);
        });
    });

    describe('clear / reset', () => {

        it('should clear all keys', async () => {

            await storage.set('count', 1);
            await storage.set('tags', ['a']);
            await storage.clear();
            const keys = await storage.keys();
            expect(keys).to.have.length(0);
        });

        it('should only clear prefixed keys', async () => {

            const prefixed = new StorageAdapter<TestValues>({
                driver,
                prefix: 'app',
            });

            await driver.set('other', '"keep"');
            await prefixed.set('count', 1);
            await prefixed.clear();

            const allKeys = await driver.keys();
            expect(allKeys).to.deep.equal(['other']);
        });

        it('reset is an alias for clear', async () => {

            expect(storage.reset).to.equal(storage.clear);
        });
    });

    describe('keys / entries / values', () => {

        it('should return all keys', async () => {

            await storage.set('count', 1);
            await storage.set('tags', ['a']);
            const keys = await storage.keys();
            expect(keys).to.include('count');
            expect(keys).to.include('tags');
        });

        it('should return entries', async () => {

            await storage.set('count', 1);
            const entries = await storage.entries();
            expect(entries).to.deep.include(['count', 1]);
        });

        it('should return values', async () => {

            await storage.set('count', 1);
            const vals = await storage.values();
            expect(vals).to.include(1);
        });
    });

    describe('assign', () => {

        it('should shallow merge into existing object', async () => {

            await storage.set('user', { id: '1', name: 'Jane' });
            await storage.assign('user', { name: 'Bob' });
            const result = await storage.get('user');
            expect(result).to.deep.equal({ id: '1', name: 'Bob' });
        });

        it('should set value if key does not exist', async () => {

            await storage.assign('user', { id: '1', name: 'Jane' } as any);
            const result = await storage.get('user');
            expect(result).to.deep.equal({ id: '1', name: 'Jane' });
        });

        it('should throw if current value is not an object', async () => {

            await storage.set('count', 42);

            await expect(
                storage.assign('count', {} as any)
            ).rejects.toThrow();
        });
    });

    describe('validation', () => {

        it('should throw on invalid key', async () => {

            await expect(
                storage.get('' as any)
            ).rejects.toThrow();
        });

        it('should require a driver in config', () => {

            expect(
                () => new StorageAdapter({} as any)
            ).to.throw();
        });
    });
});
```

**Step 3: Run tests to verify they fail**

Run: `pnpm test storage/adapter/core`
Expected: FAIL — adapter module not found

**Step 4: Write adapter.ts and events.ts**

Create `packages/storage/src/events.ts`:

```ts
import type { StorageEventName, StorageEventPayload } from './types.ts';

export function makeEventPayload<V, K extends keyof V>(
    key: K,
    value?: V[K] | null
): StorageEventPayload<V, K> {

    return { key, value: value ?? null } as StorageEventPayload<V, K>;
}
```

Create `packages/storage/src/adapter.ts` — implement the full `StorageAdapter` class using:
- `@logosdx/observer` for events (ObserverEngine instance as `#observer`)
- `@logosdx/utils` for `assert`, `clone`
- `#_key(key)` for prefix logic (same pattern as v1)
- `#_allKeys()` for filtered key enumeration
- JSON serialize/deserialize gated by `this.structured`

Key implementation notes:
- Constructor validates `config.driver` exists via `assert`
- `get()` / `set()` / `rm()` handle overloads same as v1 but async
- `has()` uses `driver.get(key) !== null` instead of `hasOwnProperty` (fixes v1 bug)
- Events fire via `this.#observer.emit('before-set', payload)` etc.
- `on()` delegates to `this.#observer.on()` and returns cleanup function
- `scope()` returns an object with bound async methods
- `remove` and `reset` are aliases assigned in constructor

**Step 5: Run tests to verify they pass**

Run: `pnpm test storage/adapter/core`
Expected: PASS

**Step 6: Commit**

```
feat(storage): add StorageAdapter v2 with async driver architecture
```

---

### Task 4: StorageAdapter Events

**Files:**
- Test: `tests/src/storage/adapter/events.test.ts`
- Modify: `packages/storage/src/adapter.ts` (if needed)

**Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryDriver } from '../_helpers.ts';
import { StorageAdapter } from '../../../../packages/storage/src/adapter.ts';

interface TestValues {
    user: { id: string; name: string };
    count: number;
}

describe('@logosdx/storage: adapter events', () => {

    let storage: StorageAdapter<TestValues>;

    beforeEach(() => {

        storage = new StorageAdapter<TestValues>({
            driver: new MemoryDriver(),
        });
    });

    it('should emit before-set and after-set on set()', async () => {

        const before = vi.fn();
        const after = vi.fn();

        storage.on('before-set', before);
        storage.on('after-set', after);

        await storage.set('count', 42);

        expect(before).toHaveBeenCalledOnce();
        expect(before.mock.calls[0][0]).to.deep.include({ key: 'count' });
        expect(after).toHaveBeenCalledOnce();
    });

    it('should emit before-remove and after-remove on rm()', async () => {

        const before = vi.fn();
        const after = vi.fn();

        storage.on('before-remove', before);
        storage.on('after-remove', after);

        await storage.set('count', 42);
        await storage.rm('count');

        expect(before).toHaveBeenCalledOnce();
        expect(after).toHaveBeenCalledOnce();
    });

    it('should emit clear on clear()', async () => {

        const listener = vi.fn();
        storage.on('clear', listener);

        await storage.set('count', 1);
        await storage.clear();

        expect(listener).toHaveBeenCalledOnce();
    });

    it('on() should return a cleanup function', async () => {

        const listener = vi.fn();
        const cleanup = storage.on('after-set', listener);

        await storage.set('count', 1);
        expect(listener).toHaveBeenCalledOnce();

        cleanup();

        await storage.set('count', 2);
        expect(listener).toHaveBeenCalledOnce(); // not called again
    });

    it('off() should remove listener', async () => {

        const listener = vi.fn();
        storage.on('after-set', listener);
        storage.off('after-set', listener);

        await storage.set('count', 1);
        expect(listener).not.toHaveBeenCalled();
    });

    it('bulk set() should emit per key', async () => {

        const listener = vi.fn();
        storage.on('after-set', listener);

        await storage.set({ count: 1, user: { id: '1', name: 'A' } } as any);
        expect(listener).toHaveBeenCalledTimes(2);
    });
});
```

**Step 2: Run tests to verify they pass (events should already work from Task 3)**

Run: `pnpm test storage/adapter/events`
Expected: PASS (if adapter was implemented correctly). If not, fix and re-run.

**Step 3: Commit**

```
test(storage): add event system tests for StorageAdapter v2
```

---

### Task 5: scope() Method

**Files:**
- Test: `tests/src/storage/adapter/scope.test.ts`
- Modify: `packages/storage/src/adapter.ts` (if needed)

**Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryDriver } from '../_helpers.ts';
import { StorageAdapter } from '../../../../packages/storage/src/adapter.ts';

interface TestValues {
    user: { id: string; name: string; email?: string };
    count: number;
}

describe('@logosdx/storage: scope()', () => {

    let storage: StorageAdapter<TestValues>;

    beforeEach(() => {

        storage = new StorageAdapter<TestValues>({
            driver: new MemoryDriver(),
        });
    });

    it('should get scoped value', async () => {

        await storage.set('count', 42);
        const scoped = storage.scope('count');
        expect(await scoped.get()).to.equal(42);
    });

    it('should set scoped value', async () => {

        const scoped = storage.scope('count');
        await scoped.set(10);
        expect(await storage.get('count')).to.equal(10);
    });

    it('should remove scoped value', async () => {

        await storage.set('count', 1);
        const scoped = storage.scope('count');
        await scoped.remove();
        expect(await storage.get('count')).to.be.null;
    });

    it('should assign scoped value', async () => {

        await storage.set('user', { id: '1', name: 'Jane' });
        const scoped = storage.scope('user');
        await scoped.assign({ email: 'jane@x.com' });
        expect(await storage.get('user')).to.deep.equal({
            id: '1', name: 'Jane', email: 'jane@x.com'
        });
    });

    it('rm and clear are aliases for remove', async () => {

        const scoped = storage.scope('count');
        expect(scoped.rm).to.equal(scoped.remove);
        expect(scoped.clear).to.equal(scoped.remove);
    });
});
```

**Step 2: Run tests**

Run: `pnpm test storage/adapter/scope`
Expected: PASS (scope should already be implemented in Task 3). Fix if needed.

**Step 3: Commit**

```
test(storage): add scope() method tests
```

---

### Task 6: FileSystemDriver

**Files:**
- Create: `packages/storage/src/drivers/filesystem.ts`
- Modify: `packages/storage/src/drivers/index.ts`
- Test: `tests/src/storage/drivers/filesystem.test.ts`

**Step 1: Write the failing tests**

Tests should write to `tmp/` directory per CLAUDE.md. Use a temp JSON file path.

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { FileSystemDriver } from '../../../../packages/storage/src/drivers/filesystem.ts';

const TMP_DIR = 'tmp';
const TMP_FILE = `${TMP_DIR}/test-storage.json`;

describe('@logosdx/storage: FileSystemDriver', () => {

    let driver: FileSystemDriver;

    beforeEach(() => {

        if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
        if (existsSync(TMP_FILE)) unlinkSync(TMP_FILE);
        driver = new FileSystemDriver(TMP_FILE);
    });

    afterEach(() => {

        if (existsSync(TMP_FILE)) unlinkSync(TMP_FILE);
    });

    it('should set and get a value', async () => {

        await driver.set('key1', 'value1');
        const result = await driver.get('key1');
        expect(result).to.equal('value1');
    });

    it('should return null for missing key', async () => {

        const result = await driver.get('nonexistent');
        expect(result).to.be.null;
    });

    it('should persist to disk', async () => {

        await driver.set('key1', 'value1');

        const fresh = new FileSystemDriver(TMP_FILE);
        const result = await fresh.get('key1');
        expect(result).to.equal('value1');
    });

    it('should remove a key', async () => {

        await driver.set('key1', 'value1');
        await driver.remove('key1');
        expect(await driver.get('key1')).to.be.null;
    });

    it('should return all keys', async () => {

        await driver.set('a', '1');
        await driver.set('b', '2');
        const keys = await driver.keys();
        expect(keys).to.include('a');
        expect(keys).to.include('b');
    });

    it('should clear all keys', async () => {

        await driver.set('a', '1');
        await driver.clear();
        expect(await driver.keys()).to.have.length(0);
    });

    it('should handle non-existent file gracefully', async () => {

        const fresh = new FileSystemDriver(`${TMP_DIR}/does-not-exist.json`);
        const result = await fresh.get('anything');
        expect(result).to.be.null;
    });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test storage/drivers/filesystem`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `packages/storage/src/drivers/filesystem.ts`:

Key implementation notes:
- Constructor takes `filePath: string`
- Lazy-loads `node:fs/promises` via dynamic `import()` on first operation
- Reads entire JSON file into a `Map` on first access (`#_load()`)
- Writes back to disk on every mutation (`#_save()`)
- Creates file if it doesn't exist
- Uses `attempt` from `@logosdx/utils` for file I/O

Update `packages/storage/src/drivers/index.ts` to re-export `FileSystemDriver`.

**Step 4: Run test to verify it passes**

Run: `pnpm test storage/drivers/filesystem`
Expected: PASS

**Step 5: Commit**

```
feat(storage): add FileSystemDriver for Node.js persistence
```

---

### Task 7: IndexedDBDriver

**Files:**
- Create: `packages/storage/src/drivers/indexeddb.ts`
- Modify: `packages/storage/src/drivers/index.ts`
- Test: `tests/src/storage/drivers/indexeddb.test.ts`

**Step 1: Write the failing tests**

Note: JSDOM doesn't include IndexedDB. Use `fake-indexeddb` as a dev dependency, or mock the IDB API. Check if it's already available in the test environment first.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBDriver } from '../../../../packages/storage/src/drivers/indexeddb.ts';

describe('@logosdx/storage: IndexedDBDriver', () => {

    let driver: IndexedDBDriver;

    beforeEach(() => {

        driver = new IndexedDBDriver('test-db', 'test-store');
    });

    it('should set and get a value', async () => {

        await driver.set('key1', 'value1');
        const result = await driver.get('key1');
        expect(result).to.equal('value1');
    });

    it('should store structured data', async () => {

        const obj = { nested: { deep: true }, arr: [1, 2, 3] };
        await driver.set('complex', obj);
        const result = await driver.get('complex');
        expect(result).to.deep.equal(obj);
    });

    it('should return null for missing key', async () => {

        const result = await driver.get('nonexistent');
        expect(result).to.be.null;
    });

    it('should remove a key', async () => {

        await driver.set('key1', 'value1');
        await driver.remove('key1');
        expect(await driver.get('key1')).to.be.null;
    });

    it('should return all keys', async () => {

        await driver.set('a', '1');
        await driver.set('b', '2');
        const keys = await driver.keys();
        expect(keys).to.include('a');
        expect(keys).to.include('b');
    });

    it('should clear all keys', async () => {

        await driver.set('a', '1');
        await driver.clear();
        expect(await driver.keys()).to.have.length(0);
    });
});
```

**Step 2: Install fake-indexeddb if needed**

Run: `pnpm add -D fake-indexeddb --filter tests`

**Step 3: Run test to verify it fails**

Run: `pnpm test storage/drivers/indexeddb`
Expected: FAIL — module not found

**Step 4: Write the implementation**

Create `packages/storage/src/drivers/indexeddb.ts`:

Key implementation notes:
- Constructor takes `dbName: string` and optional `storeName: string` (default: `'store'`)
- Lazy-opens database on first operation via `#_db()` method
- Each operation opens a transaction, performs the action, returns a promise
- `get()` returns `undefined` → `null` conversion for consistency
- `keys()` uses `getAllKeys()` on the object store
- Uses IDB request → promise wrapper internally

Update `packages/storage/src/drivers/index.ts` to re-export `IndexedDBDriver`.

**Step 5: Run test to verify it passes**

Run: `pnpm test storage/drivers/indexeddb`
Expected: PASS

**Step 6: Commit**

```
feat(storage): add IndexedDBDriver for browser structured storage
```

---

### Task 8: Barrel Exports & Package Config

**Files:**
- Modify: `packages/storage/src/index.ts`
- Modify: `packages/storage/package.json`

**Step 1: Update index.ts**

Replace the entire file with barrel exports:

```ts
export { StorageAdapter } from './adapter.ts';
export { LocalStorageDriver, SessionStorageDriver, WebStorageDriver } from './drivers/web.ts';
export { FileSystemDriver } from './drivers/filesystem.ts';
export { IndexedDBDriver } from './drivers/indexeddb.ts';

export type {
    StorageDriver,
    StorageEventName,
    StorageEventPayload,
    StorageEventListener,
    ScopedKey,
} from './types.ts';
```

**Step 2: Update package.json**

Add `@logosdx/observer` as a dependency:

```json
"dependencies": {
    "@logosdx/utils": "workspace:^",
    "@logosdx/observer": "workspace:^"
}
```

Update description:

```json
"description": "Async key-value storage adapter with pluggable drivers"
```

**Step 3: Build**

Run: `pnpm build --filter @logosdx/storage`
Expected: Build succeeds

**Step 4: Run all storage tests**

Run: `pnpm test storage`
Expected: All tests PASS

**Step 5: Commit**

```
feat(storage): update barrel exports and package config for v2
```

---

### Task 9: Update Documentation

**Files:**
- Modify: `docs/packages/storage.md`
- Modify: `llm-helpers/storage.md`
- Modify: `skill/references/` (if storage reference exists)

**Step 1: Update docs/packages/storage.md**

Rewrite to reflect v2 API:
- New constructor with config object
- Async methods throughout
- Driver concept and built-in drivers
- `scope()` instead of `wrap()`
- Observer-based events with cleanup functions
- `structured` option
- Custom driver example

**Step 2: Update llm-helpers/storage.md**

Update patterns and examples for async API.

**Step 3: Commit**

```
docs(storage): update documentation for v2 async driver architecture
```
