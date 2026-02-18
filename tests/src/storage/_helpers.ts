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
