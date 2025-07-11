import { type Func, type NullableObject, definePublicProps } from "@logosdx/utils";


class StorageError extends Error {};

export type StorageImplementation = {
    clear(): void;
    getItem(key: string, callback?: Func): string | null;
    removeItem(key: string): void;
    setItem(key: string, value: string): void;
};

// /**
//  * Extendible interface to document what keys exist, and
//  * the possible shape they take
//  */
// export interface Values {}

// type Keys = keyof Values;
// type Shapes<V, K> = K extends keyof V ? V[K] : any;

// export type AppStorageKeys = Keys;
// export type AppStorageShapes<Values, K> = Shapes<Values, K>;

export class StorageEvent<V, K extends keyof V = keyof V> extends Event {
    key?: K | (K)[] | undefined;
    value!: V[K];
}

export enum StorageEventNames {
    'storage-before-set' = 'storage-before-set',
    'storage-after-set' = 'storage-after-set',
    'storage-before-unset' = 'storage-before-unset',
    'storage-after-unset' = 'storage-after-unset',
    'storage-reset' = 'storage-reset'
}

const makeEvent = <V, K extends keyof V = keyof V>(
    type: keyof typeof StorageEventNames,
    key: K | K[],
    value: V | V[K] | null
) => {

    const ev = new StorageEvent <V, K>(StorageEventNames[type]);

    definePublicProps(ev, { key, value });

    return ev;
}

export type StorageEventListener<V, K extends keyof V = keyof V> = (e: StorageEvent<V, K>) => void;


export class StorageAdapter<Values> extends EventTarget {

    readonly storage: StorageImplementation;
    readonly prefix?: string | undefined

    /**
     * Same as storage.rm();
     */
    remove: StorageAdapter<Values>['rm'];

    /** Same as storage.clear() */
    reset: StorageAdapter<Values>['clear'];

    constructor(storage: StorageImplementation, prefixOrOptions?: string) {

        super();

        this.storage = storage;
        this.prefix = prefixOrOptions!;

        this.remove = this.rm;
        this.reset = this.clear;
    }

    on(
        ev: keyof typeof StorageEventNames,
        listener: StorageEventListener<Values>,
        once = false
    ) {

        this.addEventListener(ev, listener as never, { once });
    }

    off(ev: keyof typeof StorageEventNames, listener: EventListenerOrEventListenerObject) {

        this.removeEventListener(ev, listener);
    }


    /**
     * Returns all items from storage
     */
    get <K extends keyof Values>(): Values

    /**
     * Returns a single value from storage
     * @param key key to find
     */
    get <K extends keyof Values>(key: K): Values[K]

    /**
     * Returns some items from storage
     * @param keys
     */
    get <K extends keyof Values>(keys: K[]): Partial<NullableObject<Values>>

    get <K extends keyof Values>(keyOrKeys?: K | K[]) {

        if (keyOrKeys === undefined) {

            return this.get(this._allKeys() as K[]);
        }


        if (Array.isArray(keyOrKeys)) {

            const entries: Partial<NullableObject<Values>> = {};

            for (const key of keyOrKeys) {
                entries[key] = this.get(key);
            }

            return entries;
        }

        return JSON.parse(
            this.storage.getItem(
                this._key(keyOrKeys as K) as string
            ) || 'null'
        ) as Values[K];
    }

    /**
     * Saves entire object by `{ [key]: value }`
     * @param values object to save to storage
     */
    set(values: Partial<Values> & Record<string, any>): void

    /**
     * Sets a key to given value into storage
     * @param key
     * @param value
     */
    set <K extends keyof Values>(
        key: K | Partial<Values> & Record<string, any>,
        value: Values[K]
    ): void

    set(key: unknown, value?: unknown) {

        this._assertKey(key as string);

        if (typeof key === 'object') {

            const entries = Object.entries(key!) as [keyof Values, Values[keyof Values]][];

            entries.map(
                ([key, val]) => (
                    this.set(key, val as any)
                )
            )

            return;
        }

        this.dispatchEvent(
            makeEvent <Values>(
                'storage-before-set',
                key as keyof Values,
                value as Values[keyof Values]
            )
        );

        this.storage.setItem(
            this._key(key as keyof Values) as string,
            JSON.stringify(value)
        );

        this.dispatchEvent(
            makeEvent <Values>(
                'storage-after-set',
                key as keyof Values,
                value as Values[keyof Values]
            )
        );
    }


    assign <K extends keyof Values>(key: K, val: Partial<Values[K]>): void
    /**
     * `Object.assign()` given value to given key
     * @param key key to merge
     * @param val value to merge
     */
    assign <T extends object, K extends keyof Values>(key: K, val: T): void {

        const current = this.get(key);

        if (current === null) {

            return this.set(key, val as Values[K]);
        }

        if (!current) {

            throw new StorageError('cannot assign to null value');
        }

        if (typeof current !== 'object') {

            throw new StorageError(`key (${key as string}) value cannot be assigned (not an object)`);
        }


        if (typeof val !== 'object') {

            throw new StorageError(`value (${val}) cannot be assigned (not an object)`);
        }

        return this.set(key, Object.assign(current, val) as Values[K]);
    }

    /**
     * Removes a single key or the given array of keys
     * @param keys
     */
    rm <K extends keyof Values>(keyOrKeys: K | K[]): void {

        this._assertKey((keyOrKeys as string[] | string)[0]!);

        if (Array.isArray(keyOrKeys)) {



            keyOrKeys.map(
                key => this.rm(key)
            );

            return
        }

        if (typeof keyOrKeys === 'string') {

            this.dispatchEvent(
                makeEvent <Values>('storage-before-unset', keyOrKeys, null)
            );

            this.storage.removeItem(
                this._key(keyOrKeys) as string
            );

            this.dispatchEvent(
                makeEvent <Values>('storage-after-unset', keyOrKeys, null)
            );
        }
    }

    /**
     * Wraps a single key and returns functions to get, set, remove, assign
     * @param key
     * @returns
     */
    wrap <K extends keyof Values>(key: K) {

        const self = this;

        const set = (val: Values[K]) => self.set(key, val);
        const get = () => self.get(key);
        const remove = () => self.rm(key);
        const assign = (val: object) => self.assign(key, val);

        return {

            /** Sets the value for `key` */
            set,

            /** Gets the value for `key` */
            get,

            /** Removes the value for `key` */
            remove,

            /** `Object.assign` the value for `key` */
            assign,

            /** Same as `x.remove()` */
            rm: remove,

            /** Same as `x.remove()` */
            clear: remove,
        }
    }


    /**
     * Returns an array of boolean values denoting
     * whether the keys exist within the storage or not
     * @param keys
     */
    has(keys: (keyof Values)[]): boolean[]
    has(keys: string[]): boolean[]

    /**
     * Returns whether key exists within the storage
     * @param key
     */
    has(keys: (keyof Values)[]): boolean
    has(key: string): boolean


    has(_arg: unknown): unknown {

        const keyOrKeys = _arg as (keyof Values)[]

        this._assertKey(keyOrKeys[0] as string);

        if (Array.isArray(keyOrKeys)) {

            return keyOrKeys.map(
                k => this.storage.hasOwnProperty(this._key(k))
            )
        }

        return this.storage.hasOwnProperty(this._key(keyOrKeys));
    }

    /**
     * Removes all prefixed values from the storage
     */
    clear(): void {

        this.rm(
            this._allKeys()
        );
    }

    /**
     * Returns all keys scoped by prefix
     */
    keys() {

        return this._allKeys();
    }

    /**
     * `Object.entries()` against the entire store as an object
     */
    entries () {

        const all = this.get();

        return Object.entries(all!);
    }

    /**
     * `Object.values()` against the entire store as an object
     */
    values () {

        const all = this.get();

        return Object.values(all!);
    }

    private _assertKey(key: string | object) {

        if (!key) {

            throw new StorageError('invalid key');
        }
    }

    private _key(key: keyof Values) {

        if (this.prefix) {

            return `${this.prefix}:${key as string}`;
        }

        return key;
    }

    private _allKeys() {

        let keys = Object.keys(this.storage);

        if (this.prefix) {

            const rgx = new RegExp(`^${this.prefix}:`);

            keys = (keys as string[])
                .filter(k => rgx.test(k))
                .map(k => k.replace(rgx, ''));
        }

        return keys as (keyof Values)[];
    }
}


