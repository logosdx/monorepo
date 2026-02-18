import type { StorageDriver } from '../types.ts';

/**
 * IndexedDB-backed storage driver for structured browser storage.
 *
 * Unlike WebStorageDriver which serializes to JSON strings, IndexedDB
 * natively stores structured cloneable data, making it ideal for
 * complex objects, binary data, and larger datasets.
 *
 * @example
 *
 *     const driver = new IndexedDBDriver('my-app', 'settings');
 *     await driver.set('theme', { mode: 'dark', fontSize: 14 });
 *     const theme = await driver.get('theme');
 */
export class IndexedDBDriver implements StorageDriver {

    #dbName: string;
    #storeName: string;
    #db: IDBDatabase | null = null;

    constructor(dbName: string, storeName = 'store') {

        this.#dbName = dbName;
        this.#storeName = storeName;
    }

    async #_open(): Promise<IDBDatabase> {

        if (this.#db) return this.#db;

        return new Promise((resolve, reject) => {

            const request = indexedDB.open(this.#dbName, 1);

            request.onupgradeneeded = () => {

                const db = request.result;

                if (!db.objectStoreNames.contains(this.#storeName)) {

                    db.createObjectStore(this.#storeName);
                }
            };

            request.onsuccess = () => {

                this.#db = request.result;
                resolve(this.#db);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async #_tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {

        const db = await this.#_open();
        const tx = db.transaction(this.#storeName, mode);
        const store = tx.objectStore(this.#storeName);
        const request = fn(store);

        return new Promise((resolve, reject) => {

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(key: string) {

        const result = await this.#_tx('readonly', (store) => store.get(key));
        return result ?? null;
    }

    async set(key: string, value: unknown) {

        await this.#_tx('readwrite', (store) => store.put(value, key));
    }

    async remove(key: string) {

        await this.#_tx('readwrite', (store) => store.delete(key));
    }

    async keys() {

        const result = await this.#_tx('readonly', (store) => store.getAllKeys());
        return result as string[];
    }

    async clear() {

        await this.#_tx('readwrite', (store) => store.clear());
    }
}
