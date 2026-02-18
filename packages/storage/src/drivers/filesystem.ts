import type { StorageDriver } from '../types.ts';
import { attempt } from '@logosdx/utils';

/**
 * A file-system-backed storage driver for Node.js environments.
 *
 * Persists key-value data as JSON on disk. Useful for CLI tools,
 * server-side caching, or any scenario where browser storage APIs
 * are unavailable.
 *
 * @example
 *
 *     const driver = new FileSystemDriver('./data/settings.json');
 *     await driver.set('theme', 'dark');
 *     const theme = await driver.get('theme'); // 'dark'
 */
export class FileSystemDriver implements StorageDriver {

    #filePath: string;
    #data: Map<string, unknown> = new Map();
    #loaded = false;
    #fs: typeof import('node:fs/promises') | null = null;

    constructor(filePath: string) {

        this.#filePath = filePath;
    }

    async #loadFs(): Promise<typeof import('node:fs/promises')> {

        if (!this.#fs) {

            this.#fs = await import('node:fs/promises');
        }

        return this.#fs;
    }

    async #_load(): Promise<void> {

        if (this.#loaded) return;

        const fs = await this.#loadFs();
        const [content, err] = await attempt(() => fs.readFile(this.#filePath, 'utf-8'));

        if (!err && content) {

            const parsed = JSON.parse(content);
            for (const [key, value] of Object.entries(parsed)) {

                this.#data.set(key, value);
            }
        }

        this.#loaded = true;
    }

    async #_save(): Promise<void> {

        const fs = await this.#loadFs();
        const obj: Record<string, unknown> = {};

        for (const [key, value] of this.#data) {

            obj[key] = value;
        }

        const [, err] = await attempt(() => fs.writeFile(this.#filePath, JSON.stringify(obj)));
        if (err) throw err;
    }

    async get(key: string): Promise<unknown> {

        await this.#_load();
        return this.#data.get(key) ?? null;
    }

    async set(key: string, value: unknown): Promise<void> {

        await this.#_load();
        this.#data.set(key, value);
        await this.#_save();
    }

    async remove(key: string): Promise<void> {

        await this.#_load();
        this.#data.delete(key);
        await this.#_save();
    }

    async keys(): Promise<string[]> {

        await this.#_load();
        return [...this.#data.keys()];
    }

    async clear(): Promise<void> {

        await this.#_load();
        this.#data.clear();
        await this.#_save();
    }
}
