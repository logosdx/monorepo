import { clone } from './data-structures/clone.ts';
import { attemptSync } from './flow-control/attempt.ts';
import { MemoizeOptions, memoizeSync } from './flow-control/index.ts';
import type { Func, PathLeaves, PathNames, PathValue } from './types.ts';
import { parseTimeDuration, parseByteSize } from './units.ts';
import { assert, isEnabledValue, isDisabledValue } from './validation.ts';

/**
 * A no-operation function that accepts any arguments and returns any value.
 *
 * @param args any arguments
 * @returns any value
 */
export const noop: (...args: any[]) => any = () => {};

/**
 * Defines visible, non-configurable properties on an object.
 *
 * Creates properties that are enumerable (show up in for...in loops and Object.keys)
 * but cannot be modified or deleted. Useful for creating public APIs.
 *
 * @param target object to add properties to
 * @param props properties to define
 * @param configurable whether properties can be deleted or reconfigured
 *
 * @example
 * const api = {};
 * definePublicProps(api, {
 *     version: '1.0.0',
 *     name: 'MyAPI'
 * });
 *
 * console.log(api.version); // '1.0.0'
 * console.log(Object.keys(api)); // ['version', 'name']
 * api.version = '2.0.0'; // Fails silently or throws in strict mode
 *
 * @example
 * class DataProcessor {
 *     constructor(config) {
 *         definePublicProps(this, {
 *             id: crypto.randomUUID(),
 *             createdAt: new Date()
 *         });
 *     }
 * }
 */
export const definePublicProps = <T, U extends Record<string, unknown>>(target: T, props: U, configurable = false) => {

    Object.entries(props).map(([prop, value]) => {

        Object.defineProperty(
            target,
            prop,
            {
                value,
                writable: false,
                enumerable: true,
                configurable
            }
        );
    });
};

/**
 * Defines hidden, non-configurable properties on an object.
 *
 * Creates properties that are not enumerable (hidden from for...in loops and Object.keys)
 * and cannot be modified or deleted. Useful for internal state and private methods.
 *
 * @param target object to add properties to
 * @param props properties to define
 * @param configurable whether properties can be deleted or reconfigured
 *
 * @example
 * const cache = new Map();
 * const api = {};
 *
 * definePrivateProps(api, {
 *     _cache: cache,
 *     _getId: () => crypto.randomUUID()
 * });
 *
 * console.log(Object.keys(api)); // [] (hidden properties)
 * console.log(api._cache); // Map instance (accessible but hidden)
 *
 * @example
 * class EventEmitter {
 *     constructor() {
 *         definePrivateProps(this, {
 *             _listeners: new Map(),
 *             _emit: this.emit.bind(this)
 *         });
 *     }
 * }
 */
export const definePrivateProps = <T, U extends Record<string, unknown>>(target: T, props: U, configurable = false) => {

    Object.entries(props).map(([prop, value]) => {

        Object.defineProperty(
            target,
            prop,
            {
                value,
                writable: false,
                enumerable: false,
                configurable
            }
        );
    });
};

/**
 * Defines hidden, non-configurable getters on an object.
 *
 * Creates getter properties that are not enumerable and cannot be modified.
 * Useful for computed properties and lazy-loaded values.
 *
 * @param target object to add getters to
 * @param props getter functions to define
 * @param configurable whether getters can be deleted or reconfigured
 *
 * @example
 * const user = { firstName: 'John', lastName: 'Doe' };
 *
 * definePrivateGetters(user, {
 *     _fullName: () => `${user.firstName} ${user.lastName}`,
 *     _initials: () => `${user.firstName[0]}${user.lastName[0]}`
 * });
 *
 * console.log(user._fullName); // 'John Doe'
 * console.log(Object.keys(user)); // ['firstName', 'lastName'] (getters hidden)
 *
 * @example
 * class DataProcessor {
 *     constructor(data) {
 *         this.data = data;
 *         definePrivateGetters(this, {
 *             _size: () => this.data.length,
 *             _isEmpty: () => this.data.length === 0
 *         });
 *     }
 * }
 */
export const definePrivateGetters = <T, U extends Record<string, Func>>(target: T, props: U, configurable = false) => {

    Object.entries(props).map(([prop, getter]) => {

        Object.defineProperty(
            target,
            prop,
            {
                get: getter,
                enumerable: false,
                configurable
            }
        );
    });
};

/**
 * Returns an array of items, wrapping single items in an array.
 *
 * Normalizes input to always return an array, whether the input
 * was a single item or already an array.
 *
 * @param items single item or array of items
 * @returns array containing the items
 *
 * @example
 * itemsToArray('single') // ['single']
 * itemsToArray(['already', 'array']) // ['already', 'array']
 * itemsToArray(42) // [42]
 * itemsToArray([]) // []
 *
 * @example
 * function processFiles(files: string | string[]) {
 *     const fileArray = itemsToArray(files);
 *
 *     for (const file of fileArray) {
 *         console.log(`Processing: ${file}`);
 *     }
 * }
 *
 * processFiles('single.txt'); // Works with single file
 * processFiles(['file1.txt', 'file2.txt']); // Works with multiple files
 */
export const itemsToArray = <T>(items: T | T[]): T[] => {

    if (!Array.isArray(items)) {

        items = [items];
    }

    return items;
};

/**
 * Returns a single item if array has only one element, otherwise returns the array.
 *
 * Unwraps single-item arrays to the item itself, useful for APIs that
 * can return either single items or collections.
 *
 * @param items array of items
 * @returns single item if array length is 1, otherwise the array
 *
 * @example
 * oneOrMany(['single']) // 'single'
 * oneOrMany(['multiple', 'items']) // ['multiple', 'items']
 * oneOrMany([]) // []
 * oneOrMany([42]) // 42
 *
 * @example
 * function findUsers(query: string): User | User[] {
 *     const results = database.search(query);
 *     return oneOrMany(results); // Return single user or array
 * }
 *
 * const result = findUsers('john');
 * if (Array.isArray(result)) {
 *     console.log(`Found ${result.length} users`);
 * } else {
 *     console.log(`Found user: ${result.name}`);
 * }
 */
export const oneOrMany = <T>(items: T[]): T | T[] => {

    if (items.length === 1) {
        return items[0] as T
    }

    return items;
};

/**
 * Reaches into an object, Map, Set, or Array and returns the value at the end of the path.
 *
 * Safely navigates nested object properties using dot notation.
 * Supports Maps (using .get() method), Sets (using numeric indices or .has()),
 * and Arrays (using numeric indices).
 * Returns undefined if any part of the path doesn't exist.
 *
 * @param obj object, Map, Set, or Array to navigate
 * @param val dot-separated path to the desired value
 * @returns value at the path, or undefined if path doesn't exist
 *
 * @example
 * const user = {
 *     profile: {
 *         name: 'John',
 *         settings: {
 *             theme: 'dark',
 *             notifications: true
 *         }
 *     }
 * };
 *
 * reach(user, 'profile.name') // 'John'
 * reach(user, 'profile.settings.theme') // 'dark'
 * reach(user, 'profile.missing.property') // undefined
 *
 * @example
 * // Safe API response parsing
 * function getNestedValue(response: any, path: string) {
 *     const value = reach(response, path);
 *     return value ?? 'Not found';
 * }
 *
 * const apiResponse = { data: { users: [{ name: 'Alice' }] } };
 * getNestedValue(apiResponse, 'data.users.0.name') // 'Alice'
 * getNestedValue(apiResponse, 'data.posts.0.title') // 'Not found'
 *
 * @example
 * // Working with Maps, Sets, and Arrays
 * const data = {
 *     users: new Map([['john', { name: 'John', age: 30 }]]),
 *     tags: new Set(['admin', 'user', 'moderator']),
 *     scores: [100, 95, 87, 92]
 * };
 *
 * reach(data, 'users.john.name') // 'John'
 * reach(data, 'tags.0') // 'admin'
 * reach(data, 'tags.admin') // 'admin' (if exists in Set)
 * reach(data, 'scores.1') // 95
 * reach(data, 'scores.5') // undefined
 */
export const reach = <T extends object, P extends PathNames<T>>(
    obj: T,
    val: P
) => {

    const path = val.split('.');

    return path.reduce(
        (acc, key) => {

            if (acc === undefined || acc === null) {
                return null;
            }

            if (acc instanceof Map) {
                return acc.get(key);
            }

            if (acc instanceof Set) {

                const has = acc.has(key);
                const values = Array.from(acc);

                if (has) {
                    return values[values.indexOf(key)];
                }

                return values[key as never];
            }

            return acc[key];
        },
        obj as any
    ) as PathValue<T, P> | undefined;
}

/**
 * Sets a value deep within a nested object using dot notation path.
 *
 * Creates intermediate objects if they don't exist along the path. Mutates the
 * original object in place. Use this when you need to update nested configuration
 * objects, set metrics in nested structures, or build objects incrementally without
 * manual property checking at each level.
 *
 * @param obj object to modify
 * @param path dot-separated path to the target property
 * @param value value to set at the path
 *
 * @example
 * const metrics = { memory: { heap: 100 } };
 * setDeep(metrics, 'memory.rss', 1024);
 * // metrics is now { memory: { heap: 100, rss: 1024 } }
 *
 * @example
 * // Creates missing intermediate objects
 * const config = {};
 * setDeep(config, 'server.port', 3000);
 * setDeep(config, 'server.host', 'localhost');
 * setDeep(config, 'database.connection.timeout', 5000);
 * // config is now { server: { port: 3000, host: 'localhost' }, database: { connection: { timeout: 5000 } } }
 *
 * @example
 * // Building response objects incrementally
 * function buildResponse(data: any) {
 *
 *     const response = {};
 *
 *     setDeep(response, 'status.code', 200);
 *     setDeep(response, 'status.message', 'OK');
 *     setDeep(response, 'data.results', data);
 *
 *     return response;
 * }
 */
export const setDeep = <T extends object, P extends PathNames<T>>(
    obj: T,
    path: P,
    value: PathValue<T, P>
): void => {

    assert(typeof obj === 'object' && obj !== null, 'obj must be a non-null object');
    assert(typeof path === 'string' && path.length > 0, 'path must be a non-empty string');

    const keys = path.split('.');
    const lastKey = keys[keys.length - 1]!;

    let current: any = obj;

    for (let i = 0; i < keys.length - 1; i++) {

        const key = keys[i]!;

        if (current === null || current === undefined) {
            throw new Error(`Cannot set property '${key}' on ${current} at path: ${keys.slice(0, i).join('.')}`);
        }

        if (typeof current !== 'object') {
            throw new Error(`Cannot set property '${key}' on primitive value at path: ${keys.slice(0, i).join('.')}`);
        }

        if (!(key in current)) {
            current[key] = {};
        }

        current = current[key];
    }

    if (current === null || current === undefined) {
        throw new Error(`Cannot set property '${lastKey}' on ${current}`);
    }

    if (typeof current !== 'object') {
        throw new Error(`Cannot set property '${lastKey}' on primitive value`);
    }

    current[lastKey] = value;
};

/**
 * Sets multiple values deep within a nested object using dot notation paths.
 *
 * Efficiently sets multiple nested properties in a single call. Each entry is processed
 * sequentially, and if any entry fails, an error is thrown immediately. Use this when
 * you need to initialize or update multiple nested properties at once, such as building
 * configuration objects or setting multiple metrics.
 *
 * @param obj object to modify
 * @param entries array of [path, value] tuples to set
 *
 * @example
 * const response = {};
 * setDeepMany(response, [
 *     ['status.code', 200],
 *     ['status.message', 'OK'],
 *     ['data.results', [1, 2, 3]],
 *     ['data.total', 3]
 * ]);
 * // response is now { status: { code: 200, message: 'OK' }, data: { results: [1, 2, 3], total: 3 } }
 *
 * @example
 * // Building configuration objects
 * const config = {};
 * setDeepMany(config, [
 *     ['server.port', 3000],
 *     ['server.host', 'localhost'],
 *     ['database.url', 'postgres://localhost'],
 *     ['database.pool.min', 2],
 *     ['database.pool.max', 10],
 *     ['features.auth.enabled', true],
 *     ['features.logging.level', 'info']
 * ]);
 *
 * @example
 * // Setting multiple metrics at once
 * const metrics = { memory: { heap: 100 } };
 * setDeepMany(metrics, [
 *     ['memory.rss', 1024],
 *     ['memory.external', 512],
 *     ['cpu.user', 50],
 *     ['cpu.system', 30]
 * ]);
 */
export const setDeepMany = <T extends object>(
    obj: T,
    entries: Array<[PathNames<T>, any]>
): void => {

    assert(typeof obj === 'object' && obj !== null, 'obj must be a non-null object');
    assert(Array.isArray(entries), 'entries must be an array');

    for (let i = 0; i < entries.length; i++) {

        const entry = entries[i]!;

        assert(
            Array.isArray(entry) && entry.length === 2,
            `entry ${i} must be a [path, value] tuple`
        );

        const [path, value] = entry;

        assert(
            typeof path === 'string' && path.length > 0,
            `entry ${i} must have a non-empty string path (received: ${typeof path})`
        );

        setDeep(obj, path, value);
    }
};

/**
 * Splits an array into smaller arrays of the specified size.
 *
 * Divides a large array into multiple smaller arrays (chunks) of the given size.
 * The last chunk may be smaller if the array length is not evenly divisible.
 *
 * @param array array to split into chunks
 * @param size maximum size of each chunk
 * @returns array of arrays, each containing up to `size` elements
 *
 * @example
 * chunk([1, 2, 3, 4, 5, 6, 7], 3) // [[1, 2, 3], [4, 5, 6], [7]]
 * chunk(['a', 'b', 'c', 'd'], 2) // [['a', 'b'], ['c', 'd']]
 * chunk([1, 2], 5) // [[1, 2]]
 * chunk([], 3) // []
 *
 * @example
 * // Process large datasets in batches
 * async function processBatches(items: any[], batchSize = 10) {
 *     const batches = chunk(items, batchSize);
 *
 *     for (const batch of batches) {
 *         await Promise.all(batch.map(processItem));
 *         console.log(`Processed batch of ${batch.length} items`);
 *     }
 * }
 *
 * @example
 * // Paginate results
 * function paginateResults<T>(results: T[], pageSize = 20) {
 *     const pages = chunk(results, pageSize);
 *     return pages.map((page, index) => ({
 *         page: index + 1,
 *         data: page,
 *         hasNext: index < pages.length - 1
 *     }));
 * }
 */
export const chunk = <T>(array: T[], size: number) => {

    return array.reduce((result, item, index) => {

        const chunkIndex = Math.floor(index / size);

        if (!result[chunkIndex]) {
            result[chunkIndex] = [];
        }

        result[chunkIndex]!.push(item);

        return result;
    }, [] as T[][]);
};

/**
 * Generates a random ID.
 *
 * Creates a random ID string using Math.random().
 *
 * @returns random ID string
 */
export const generateId = () => '_' + Math.random().toString(36).slice(2, 9);

/**
 * Repeats something N times and returns an array of the results.
 *
 * @param fn function to repeat
 * @param n number of times to repeat
 * @returns array of results
 *
 * @example
 * nTimes(() => createEl('span'), 3) // [span, span, span]
 * nTimes(() => Math.random(), 5) // [0.123, 0.456, 0.789, 0.123, 0.456]
 * nTimes((i) => (i + 1) * 2, 3) // [2, 4, 6]
 */
export const nTimes = <T>(fn: (iteration: number) => T, n: number) => {

    if (typeof n !== 'number') throw new Error('n must be a number');
    if (typeof fn !== 'function') throw new Error('fn must be a function');

    return Array.from({ length: n }, (_, i) => fn(i));
};


const onlyNumRegex = /^\d+$/;

/**
 * Coerces string values in an object to their appropriate types.
 * Converts "true"/"false" to booleans, numeric strings to numbers, etc.
 * Recursively processes nested objects.
 *
 * IMPORTANT: This function mutates the input object in place.
 *
 * INTENTION: This is a best-effort coercion based on common string patterns.
 * It does not handle all edge cases and should be used with caution. The goal
 * is to convert typical string representations of booleans and numbers to their
 * actual types, while leaving other strings unchanged.
 *
 * USE CASE: Parsing environment variables or other flatmap configuration objects.
 *
 * @param obj The object whose values should be coerced (mutated in place).
 * @param opts Optional configuration options
 * @param opts.parseUnits Optional flag to parse unit values like '5m', '10mb'. Default is false.
 * @param opts.skipConversion Optional function to skip conversion for specific keys. Default is to convert all keys.
 *
 * @example
 * const config = {
 *     debug: 'true',
 *     port: '3000',
 *     nested: {
 *         enabled: 'false',
 *         retries: '5'
 *     }
 * };
 *
 * castValuesToTypes(config);
 *
 * console.log(config);
 * // {
 * //     debug: true,
 * //     port: 3000,
 * //     nested: {
 * //         enabled: false,
 * //         retries: 5
 * //     }
 * // }
 *
 * @example
 * const config = {
 *     timeout: '5m',
 *     maxUploadSize: '10mb',
 *     debug: 'true'
 * };
 *
 * castValuesToTypes(config, { parseUnits: true });
 *
 * console.log(config);
 * // {
 * //     timeout: 300000,  // 5 minutes in milliseconds
 * //     maxUploadSize: 10485760,  // 10 megabytes in bytes
 * //     debug: true
 * // }
 *
 * @example
 * const config = {
 *     apiKey: '12345',
 *     port: '3000'
 * };
 *
 * // Skip conversion for apiKey (keep it as string)
 * castValuesToTypes(config, {
 *     skipConversion: (key) => key.toLowerCase().includes('key')
 * });
 *
 * console.log(config);
 * // {
 * //     apiKey: '12345',  // Kept as string
 * //     port: 3000        // Converted to number
 * // }
 */
export const castValuesToTypes = (
    obj: object,
    opts: {
        parseUnits?: boolean,
        skipConversion?: ((key: string, value: unknown) => boolean) | undefined
    } = {}
) => {

    const { parseUnits = false, skipConversion } = opts;

    for (const key in obj) {

        const k = key as keyof typeof obj;
        const val = obj[k];

        // Check if this key should be skipped
        if (skipConversion?.(key, val)) {
            continue;
        }

        const isObject = typeof val === 'object' && val !== null;

        if (isObject) {
            castValuesToTypes(val, opts);

            continue;
        }

        // Try to parse unit values if enabled
        if (parseUnits && typeof val === 'string') {

            const [timeDuration, timeErr] = attemptSync(() => parseTimeDuration(val));

            if (!timeErr && typeof timeDuration === 'number') {
                obj[k] = timeDuration as never;

                continue;
            }

            const [byteSize, bytesErr] = attemptSync(() => parseByteSize(val));

            if (!bytesErr && typeof byteSize === 'number') {
                obj[k] = byteSize as never;

                continue;
            }
        }

        const truthy = isEnabledValue(obj[k]);
        const falsy = isDisabledValue(obj[k]);

        // If the value is truthy or falsy, set it to the boolean value
        // NOTE: it MUST be a truthy or falsy value. If you only check
        // for truthy, you end up with a lot of false positives
        if (truthy || falsy) {
            obj[k] = truthy as never;

            continue;
        }

        // Only test regex on string values to avoid TypeError
        if (typeof val === 'string' && onlyNumRegex.test(val)) {

            obj[k] = Number(val) as never;

            continue;
        }
    }
}



/**
 * Loads the flatmap variables and returns a config object.
 * Coerces values to the correct types based on guessing from
 * the value itself. For example, if the value is "true", it will be
 * converted to a boolean true, if it's "123", it will be converted
 * to a number 123, etc.
 *
 * @param flatConfig The flatmap configuration object (e.g. process.env)
 * @param opts Optional options object
 * @param opts.filter Optional filter function to include/exclude specific keys. Default is to include all keys.
 * @param opts.forceAllCapToLower Optional flag to force all-caps keys to lowercase. Default is true.
 * @param opts.separator Optional string to use as a separator for nested keys. Default is "_"
 * @param opts.stripPrefix Optional prefix to strip from keys. Can be a string (e.g., "APP_") or number of characters (e.g., 4). Default is undefined (no stripping).
 * @param opts.parseUnits Optional flag to parse unit values like '5m', '10mb'. Default is false.
 * @param opts.skipConversion Optional function to skip conversion for specific keys. Default is to convert all keys.
 * @param opts.memoizeOpts Optional memoization options for caching the config. Default is false (no memoization).
 *
 * @returns The full configuration object.
 *
 * @example
 * // Assuming process.env contains:
 * // {
 * //     APP_DB_HOST: 'localhost',
 * //     APP_DB_PORT: '5432',
 * //     APP_DEBUG: 'true',
 * //     APP_FEATURE_X_ENABLED: 'false'
 * //     APP_WORKER_EMAILS_maxRunsPerMin: '100'
 * //     APP_WORKER_EMAILS_networkTimeoutMs: '100'
 * // }
 *
 * const config = makeNestedConfig(process.env, {
 *     filter: (key) => key.startsWith('APP_'),
 *     stripPrefix: 'APP_',  // Strip the APP_ prefix from all keys
 *     forceAllCapToLower: true,
 *     separator: '_',
 *     memoizeOpts: { ttl: 60000 } // Cache for 60 seconds
 * });
 *
 * console.log(config());
 * // {
 * //     db: {
 * //         host: 'localhost',
 * //         port: 5432
 * //     },
 * //     debug: true,
 * //     feature: {
 * //         x: {
 * //             enabled: false
 * //         }
 * //     },
 * //     worker: {
 * //         emails: {
 * //             maxRunsPerMin: 100,
 * //             networkTimeoutMs: 100
 * //         }
 * //     }
 * // }
 *
 * @example
 * // Using a custom separator
 * // Assuming process.env contains:
 * // {
 * //     APP_DB__HOST: 'localhost',
 * //     APP_DB__PORT: '5432',
 * //     APP_DEBUG: 'true',
 * //     APP_FEATURE__X_ENABLED: 'false',
 * //     APP_WORKER__EMAILS__maxRunsPerMin: '100'
 * //     APP_WORKER__EMAILS__networkTimeoutMs: '100'
 * // }
 * const config = makeNestedConfig(process.env, {
 *     filter: (key) => key.startsWith('APP_'),
 *     stripPrefix: 'APP_',  // Strip the APP_ prefix
 *     forceAllCapToLower: true,
 *     separator: '__'
 * });
 *
 * console.log(config());
 * // {
 * //     db: {
 * //         host: 'localhost',
 * //         port: 5432
 * //     },
 * //     debug: true,
 * //     feature: {
 * //         x_enabled: false
 * //     },
 * //     worker: {
 * //         emails: {
 * //             maxRunsPerMin: 100,
 * //             networkTimeoutMs: 100
 * //         }
 * //     }
 * // }
 *
 * @example
 *
 * // Not forcing all-caps to lowercase
 * // Assuming process.env contains:
 * // {
 * //     APP_DB_HOST: 'localhost',
 * //     APP_DB_PORT: '5432',
 * //     APP_DEBUG: 'true',
 * //     APP_FEATURE_X_ENABLED: 'false'
 * //     APP_WORKER_EMAILS_maxRunsPerMin: '100'
 * //     APP_WORKER_EMAILS_networkTimeoutMs: '100'
 * // }
 *
 * const config = makeNestedConfig(process.env, {
 *     filter: (key) => key.startsWith('APP_'),
 *     stripPrefix: 'APP_',  // Strip the APP_ prefix
 *     forceAllCapToLower: false,
 *     separator: '_'
 * });
 *
 * console.log(config());
 * // {
 * //     DB: {
 * //         HOST: 'localhost',
 * //         PORT: 5432
 * //     },
 * //     DEBUG: true,
 * //     FEATURE: {
 * //         X_ENABLED: false
 * //     },
 * //     WORKER: {
 * //         EMAILS: {
 * //             maxRunsPerMin: 100,
 * //             networkTimeoutMs: 100
 * //         }
 * //     }
 * // }
 *
 * @example
 * // Using parseUnits to convert time and byte values
 * // Assuming process.env contains:
 * // {
 * //     APP_SESSION_TIMEOUT: '15m',
 * //     APP_CACHE_TTL: '1hour',
 * //     APP_MAX_UPLOAD_SIZE: '10mb',
 * //     APP_DISK_QUOTA: '100gb'
 * // }
 *
 * const config = makeNestedConfig(process.env, {
 *     filter: (key) => key.startsWith('APP_'),
 *     stripPrefix: 'APP_',
 *     parseUnits: true  // Enable unit parsing
 * });
 *
 * console.log(config());
 * // {
 * //     session: {
 * //         timeout: 900000  // 15 minutes in milliseconds
 * //     },
 * //     cache: {
 * //         ttl: 3600000  // 1 hour in milliseconds
 * //     },
 * //     max: {
 * //         upload: {
 * //             size: 10485760  // 10 megabytes in bytes
 * //         }
 * //     },
 * //     disk: {
 * //         quota: 107374182400  // 100 gigabytes in bytes
 * //     }
 * // }
 *
 * @example
 * // Using skipConversion to keep certain values as strings
 * // Assuming process.env contains:
 * // {
 * //     APP_API_KEY: '12345',
 * //     APP_SECRET_TOKEN: '67890',
 * //     APP_PORT: '3000',
 * //     APP_DEBUG: 'true'
 * // }
 *
 * const config = makeNestedConfig(process.env, {
 *     filter: (key) => key.startsWith('APP_'),
 *     stripPrefix: 'APP_',
 *     skipConversion: (key) => key.toLowerCase().includes('key') || key.toLowerCase().includes('token')
 * });
 *
 * console.log(config());
 * // {
 * //     api: {
 * //         key: '12345'  // Kept as string
 * //     },
 * //     secret: {
 * //         token: '67890'  // Kept as string
 * //     },
 * //     port: 3000,  // Converted to number
 * //     debug: true  // Converted to boolean
 * // }
 *
 */
export const makeNestedConfig = <
    C extends object,
    F extends Record<string, string> = Record<string, string>
>(
    _flatConfig: F,
    opts: {
        filter?: (key: string, value: string) => boolean,
        forceAllCapToLower?: boolean
        separator?: string,
        stripPrefix?: string | number,
        parseUnits?: boolean,
        skipConversion?: (key: string, value: unknown) => boolean,
        memoizeOpts?: MemoizeOptions<() => C> | false
    } = {}
) => {

    assert(typeof _flatConfig === 'object' && _flatConfig !== null, 'flatConfig must be a non-null object');
    assert(typeof opts === 'object' && opts !== null, 'opts must be a non-null object');
    assert(opts.filter === undefined || typeof opts.filter === 'function', 'filter must be a function');
    assert(opts.forceAllCapToLower === undefined || typeof opts.forceAllCapToLower === 'boolean', 'forceAllCapToLower must be a boolean');
    assert(opts.separator === undefined || typeof opts.separator === 'string', 'separator must be a string');
    assert(opts.stripPrefix === undefined || typeof opts.stripPrefix === 'string' || typeof opts.stripPrefix === 'number', 'stripPrefix must be a string or number');
    assert(opts.parseUnits === undefined || typeof opts.parseUnits === 'boolean', 'parseUnits must be a boolean');
    assert(opts.skipConversion === undefined || typeof opts.skipConversion === 'function', 'skipConversion must be a function');
    assert(opts.memoizeOpts === undefined || typeof opts.memoizeOpts === 'object' || opts.memoizeOpts === false, 'memoizeOpts must be an object or false');

    const {
        filter,
        forceAllCapToLower = true,
        separator = '_',
        stripPrefix,
        parseUnits = false,
        skipConversion,
        memoizeOpts = false
    } = opts;

    const isAllCaps = (str: string) => /^[A-Z0-9_]+$/.test(str);

    // If an key is set as all-caps, we want to convert it to lowercase
    // for use in a javascript object. For example, in the case of
    // APP_DB_HOST, we want to convert it to db.host. If we, however,
    // set a variable like APP_WORKER_AUTH_maxRunsPerMin=100, we get to
    // keep the capitalization of maxRunsPerMin, because it's not all-caps.
    // This can be very useful for using a convention that allows for conf-
    // iguration via a flatmap.
    const handleCasing = (str: string) => {

        let processedStr = str;

        if (stripPrefix !== undefined) {

            if (typeof stripPrefix === 'number') {
                processedStr = str.slice(stripPrefix);
            }
            else {
                processedStr = str.startsWith(stripPrefix)
                    ? str.slice(stripPrefix.length)
                    : str
                ;
            }
        }

        const split = processedStr.split(separator);

        return split.map(
            (s) => {

                if (isAllCaps(s) && forceAllCapToLower) return s.toLowerCase();

                return s;
            }
        ).join('.');
    }

    const extractConfig = <P extends PathLeaves<C>>(path?: P, defaultValue?: PathValue<C, P>): C => {

        const flatConfig = clone(_flatConfig);
        const config = {} as C;

        const keys = Object.entries(flatConfig)
            .filter(([key, val]) => filter?.(key, val!) ?? true)
            .map(([key]) => key)
            .sort()
        ;

        const [, err] = attemptSync(() => {

            castValuesToTypes(
                flatConfig,
                {
                    parseUnits,
                    skipConversion
                }
            );

            setDeepMany<C>(
                config,
                keys.map((k) => [handleCasing(k), flatConfig[k]]) as never
            );

        });

        if (
            err instanceof Error &&
            err.message.includes('on primitive value')
        ) {

            const key = (k: string) => k.split('_').join(separator);
            const eq = (k: string, v: string) => `${key(k)}=${v}`;

            // Build the message as the user would see it in the flatmap
            // If the user uses '__' as a separator, we want to show that in the message
            // so they can easily identify the problem.
            const message = [
                'Failed to load flatmap variables.',
                'You\'re likely trying to set a nested property on a non-object value.',
                `For example, if you have ${eq('APP_DB_NAME', 'foo')}, and then you try to set`,
                `${eq('APP_DB_NAME_TEST', 'bar')}, you'll get this error because ${key('APP_DB_NAME')} is a string.`,
                'The correct way is to designate each namespace (separated by underscores) as ',
                `an object. For example, ${eq('APP_DB_NAME', 'foo')} becomes { db: { name: "foo" } }, and,`,
                `${eq('APP_DB_NAME_TEST', 'bar')} becomes { db: { name: { test: "bar" } } }, but both cannot coexist.`,
                `\n\nYou can either \`unset ${key('APP_PROBLEMATIC')}\` or scope all vars to \`${key('APP_NAMESPACE_NAME')}\` to`,
                'make it a nested object.',
                '\n\n'
            ]

            console.error(message.join(' '));
        }

        if (err) throw err;

        if (path) {

            const value = reach(config, path as PathNames<C>);

            if (value === undefined || value === null) {
                return defaultValue as C;
            }

            return value as C;
        }

        return config;
    }

    if (!memoizeOpts) return extractConfig;

    return memoizeSync(extractConfig, memoizeOpts);
}