import type { Func, PathNames, PathValue } from './types.ts';

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