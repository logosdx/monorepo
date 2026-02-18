import { assert } from '@logosdx/utils';
import { ObserverEngine } from '@logosdx/observer';

import type {
    StorageDriver,
    StorageEventName,
    StorageEventListener,
    ScopedKey,
} from './types.ts';

import { makeEventPayload } from './events.ts';

export class StorageAdapter<Values> {

    #driver: StorageDriver;
    #prefix?: string;
    #structured: boolean;
    #observer: ObserverEngine;

    readonly driver: StorageDriver;
    readonly prefix?: string;
    readonly structured: boolean;

    remove: StorageAdapter<Values>['rm'];
    reset: StorageAdapter<Values>['clear'];

    constructor(config: StorageAdapter.Config) {

        assert(config?.driver, 'StorageAdapter requires a driver');

        this.#driver = config.driver;
        this.#prefix = config.prefix;
        this.#structured = config.structured ?? false;
        this.#observer = new ObserverEngine();

        this.driver = config.driver;
        this.prefix = config.prefix;
        this.structured = this.#structured;

        this.remove = this.rm;
        this.reset = this.clear;
    }

    #_key(key: keyof Values): string {

        if (this.#prefix) {

            return `${this.#prefix}:${key as string}`;
        }

        return key as string;
    }

    async #_allKeys(): Promise<(keyof Values)[]> {

        const allKeys = await this.#driver.keys();

        if (this.#prefix) {

            const rgx = new RegExp(`^${this.#prefix}:`);

            return allKeys
                .filter(k => rgx.test(k))
                .map(k => k.replace(rgx, '')) as (keyof Values)[];
        }

        return allKeys as (keyof Values)[];
    }

    #_assertKey(key: string) {

        assert(key, 'invalid key');
    }

    #_serialize(value: unknown): unknown {

        if (this.#structured) {

            return value;
        }

        return JSON.stringify(value);
    }

    #_deserialize(raw: unknown): unknown {

        if (raw === null || raw === undefined) {

            return null;
        }

        if (this.#structured) {

            return raw;
        }

        return JSON.parse(raw as string);
    }

    async get(): Promise<Values>;
    async get<K extends keyof Values>(key: K): Promise<Values[K] | null>;
    async get<K extends keyof Values>(keys: K[]): Promise<Partial<Values>>;
    async get<K extends keyof Values>(keyOrKeys?: K | K[]): Promise<unknown> {

        if (keyOrKeys === undefined) {

            const keys = await this.#_allKeys();
            return this.get(keys as K[]);
        }

        if (Array.isArray(keyOrKeys)) {

            const result: Partial<Values> = {};

            for (const key of keyOrKeys) {

                (result as any)[key] = await this.get(key);
            }

            return result;
        }

        this.#_assertKey(keyOrKeys as string);

        const raw = await this.#driver.get(this.#_key(keyOrKeys));
        return this.#_deserialize(raw);
    }

    async set(values: Partial<Values> & Record<string, any>): Promise<void>;
    async set<K extends keyof Values>(key: K, value: Values[K]): Promise<void>;
    async set<K extends keyof Values>(keyOrValues: K | (Partial<Values> & Record<string, any>), value?: Values[K]): Promise<void> {

        if (typeof keyOrValues === 'object' && value === undefined) {

            const entries = Object.entries(keyOrValues as object) as [K, Values[K]][];

            for (const [k, v] of entries) {

                await this.set(k, v);
            }

            return;
        }

        const key = keyOrValues as K;
        this.#_assertKey(key as string);

        this.#observer.emit(
            'before-set' as any,
            makeEventPayload<Values, K>(key, value)
        );

        const serialized = this.#_serialize(value);
        await this.#driver.set(this.#_key(key), serialized);

        this.#observer.emit(
            'after-set' as any,
            makeEventPayload<Values, K>(key, value)
        );
    }

    async assign<K extends keyof Values>(key: K, val: Partial<Values[K]>): Promise<void> {

        const current = await this.get(key);

        if (current === null) {

            return this.set(key, val as Values[K]);
        }

        if (typeof current !== 'object') {

            throw new Error(`key (${key as string}) value cannot be assigned (not an object)`);
        }

        return this.set(key, Object.assign(current as object, val) as Values[K]);
    }

    async rm<K extends keyof Values>(keyOrKeys: K | K[]): Promise<void> {

        if (Array.isArray(keyOrKeys)) {

            for (const key of keyOrKeys) {

                await this.rm(key);
            }

            return;
        }

        this.#_assertKey(keyOrKeys as string);

        this.#observer.emit(
            'before-remove' as any,
            makeEventPayload<Values, K>(keyOrKeys as K)
        );

        await this.#driver.remove(this.#_key(keyOrKeys));

        this.#observer.emit(
            'after-remove' as any,
            makeEventPayload<Values, K>(keyOrKeys as K)
        );
    }

    async has<K extends keyof Values>(key: K): Promise<boolean>;
    async has<K extends keyof Values>(keys: K[]): Promise<boolean[]>;
    async has<K extends keyof Values>(keyOrKeys: K | K[]): Promise<boolean | boolean[]> {

        if (Array.isArray(keyOrKeys)) {

            return Promise.all(
                keyOrKeys.map(k => this.has(k))
            );
        }

        const raw = await this.#driver.get(this.#_key(keyOrKeys));
        return raw !== null;
    }

    async clear(): Promise<void> {

        this.#observer.emit('clear' as any);

        const keys = await this.#_allKeys();

        for (const key of keys) {

            await this.#driver.remove(this.#_key(key));
        }
    }

    async keys(): Promise<(keyof Values)[]> {

        return this.#_allKeys();
    }

    async entries(): Promise<[keyof Values, Values[keyof Values]][]> {

        const all = await this.get();
        return Object.entries(all as object) as [keyof Values, Values[keyof Values]][];
    }

    async values(): Promise<Values[keyof Values][]> {

        const all = await this.get();
        return Object.values(all as object) as Values[keyof Values][];
    }

    scope<K extends keyof Values>(key: K): ScopedKey<Values, K> {

        const self = this;

        const get = () => self.get(key) as Promise<Values[K]>;
        const set = (value: Values[K]) => self.set(key, value);
        const assign = (val: Partial<Values[K]>) => self.assign(key, val);
        const remove = () => self.rm(key);

        return {
            get,
            set,
            assign,
            remove,
            rm: remove,
            clear: remove,
        };
    }

    on(event: StorageEventName, listener: StorageEventListener<Values>) {

        return this.#observer.on(event as any, listener as any);
    }

    off(event: StorageEventName, listener: StorageEventListener<Values>) {

        this.#observer.off(event as any, listener as any);
    }
}

export namespace StorageAdapter {

    export interface Config {
        driver: StorageDriver;
        prefix?: string;
        structured?: boolean;
    }
}
