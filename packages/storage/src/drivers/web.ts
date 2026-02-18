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
