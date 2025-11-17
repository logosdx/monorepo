import type { Func, PathNames, PathValue } from '../types.ts';
import { assert } from '../validation/index.ts';

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
