import { Func, PathLeaves, PathNames, PathValue, Truthy } from './types';

/**
 * Defines visible, non-configurable properties on an object
 * @param target
 * @param props
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
 * Defines hidden, non-configurable properties on an object
 * @param target
 * @param props
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
 * Defines hidden, non-configurable getters on an object
 * @param target
 * @param props
 */
export const definePrivateGetters = <T, U extends Record<string, Func>>(target: T, props: U, configurable = false) => {

    Object.entries(props).map(([prop, getter]) => {

        Object.defineProperty(
            target,
            prop,
            {
                get: getter,
                writable: false,
                enumerable: false,
                configurable
            }
        );
    });
};


class AssertationError extends Error {}

/**
 * Asserts that a value is true
 *
 * @param test value that is coerced to true
 * @param message error message to display when test is false
 * @param ErrorClass error class to throw
 */
export const assert = (
    test: Truthy | (() => boolean),
    message?: string,
    ErrorClass?: typeof Error
) => {

    const check = test instanceof Function ? test() : !!test

    if (check === false) {

        throw new (ErrorClass || AssertationError)(message || 'assertion failed');
    }
};

type AssertObjTestFn<T, P extends string> = (val: PathValue<T, P>) => [boolean, string];

/**
 * Asserts the values in an object based on the provided assertations.
 * The assertations are a map of paths to functions that return a tuple
 * of a boolean and a message. This is intended to be used for testing
 * and validation when there is no schema validator available.
 *
 *
 * @param obj
 * @param assertions
 *
 * @example
 *
 * const obj = {
 *     a: 1,
 *     b: 'hello',
 *     c: { d: 2 }
 * }
 *
 * assertObject(obj, {
 *     a: (val) => [val === 1, 'a should be 1'],
 *     b: (val) => [val === 'hello', 'b should be hello'],
 *     c: [
 *         (val) => [!!val, 'c should not be empty'],
 *         (val) => [isObject(val), 'c should be an object']
 *     ],
 *     'c.d': (val) => [val === 2, 'c.d should be 2']
 * });
 */
export const assertObject = <T extends object>(
    obj: T,
    assertions: {
        [K in PathNames<T>]?: AssertObjTestFn<T, K> | AssertObjTestFn<T, K>[]
    }
) => {

    const tests = [] as [
        unknown,
        AssertObjTestFn<T, any>
    ][]

    for (const path in assertions) {

        const val = reach(obj, path as never);
        const test = assertions[path as never] as AssertObjTestFn<T, any> | AssertObjTestFn<T, any>[];

        if (test === undefined) {

            throw new Error(`assertation for path ${path} is undefined`);
        }

        if (test instanceof Array) {

            for (const t of test) {

                tests.push([val, t]);
            }
            continue;
        }

        tests.push([val, test]);
    }

    for (const [val, test] of tests) {

        const [check, message] = test(val as never);

        assert(check, message);
    }
}


/**
 * Asserts only if value is not undefined
 *
 * @param val value to test
 * @param test
 * @param message
 * @param ErrorClass
 */
export const assertOptional = <T>(
    val: T | undefined,
    ...rest: Parameters<typeof assert>
) => {

    if (val !== undefined) {

        assert(...rest);
    }
}


/**
 * Merges sources into targets, using the target as a default fallback
 * @param target object to modify
 * @param sources to apply against target
 * @returns
 */
export const applyDefaults = <T>(target: T, ...sources: T[]) => {

    for (const source of sources) {

        for (const k in source) {

            if (typeof source[k] === 'object') {

                const _t = (target || {}) as T;
                type NextVal = T[keyof T];

                const value = applyDefaults(
                    (_t[k] || {}) as NextVal,
                    (source[k])
                );

                target[k as keyof T] = value as NextVal;
            }
            else {

                target[k] = source[k];
            }
        }
    }


    return target;
}

/**
 * Returns an array of things, if not already an array.
 * @param items item or items
 * @returns
 */
export const itemsToArray = <T>(items: T | T[]): T[] => {

    if (!Array.isArray(items)) {

        items = [items];
    }

    return items;
};

/**
 * Returns 1 only if array of items contains only 1
 * @param items array of items
 * @returns
 */
export const oneOrMany = <T>(items: T[]): T | T[] => {

    if (items.length === 1) {
        return items[0] as T
    }

    return items;
};

/**
 * Checks if value is non-iterable:
 * null, undefined, String, Number, Boolean, Symbol
 * @param val
 * @returns {boolean}
 */
export const isNonIterable = (val: unknown): boolean => (
    val === null ||
    val === undefined ||
    val.constructor === String ||
    val.constructor === Number ||
    val.constructor === Boolean ||
    val.constructor === Symbol
);

/**
 * Checks if value is a type that does not
 * have a constructor
 * @param val
 * @returns {boolean}
 */
export const hasNoConstructor = (val: unknown): boolean => (
    val === null ||
    val === undefined
);

/**
 * Checks if either value is non iterable
 * @param value
 * @param compare
 * @returns {boolean}
 */
export const oneIsNonIterable = (value: unknown, compare: unknown): boolean => (
    isNonIterable(value) || isNonIterable(compare)
);

/**
 * Checks if both values have the same constructor
 * @param value
 * @param compare
 * @returns {boolean}
 */
export const hasSameConstructor = (value: unknown, compare: unknown): boolean => (
    (value as {}).constructor === (compare as {}).constructor
);

/**
 * Checks if both values are the length (or size). Values can be any iterable with
 * the property `length` or `size`.
 * @param a
 * @param b
 * @returns {boolean}
 */
export const isSameLength = (
    a: unknown[] | Set<unknown>,
    b: unknown[] | Set<unknown>
): boolean => (
    (a as []).length === (b as []).length &&
    (a as Set<''>).size === (b as Set<''>).size
);

/**
 * Checks if value is instance of a function
 * @param a
 * @returns {boolean}
 */
export const isFunction = (a: unknown) => a instanceof Function;

/**
 * Checks if value is instance of an object
 * @param a
 * @returns {boolean}
 */
export const isObject = (a: unknown) => a instanceof Object;

/**
 * Performs a for-in loop that breaks the instance `check` function returns false.
 * Used to check that a value is in another item.
 * @param {Object|Array} item an object or array
 * @param {Function} check function to perform the check
 * @returns {boolean}
 */
export const forInIsEqual = <T extends object>(
    item: T,
    check: {
        (v: T[keyof T], i: number | string): boolean
    }
): boolean => {

    let isEqual: boolean;

    for (const i in item) {

        isEqual = check(item[i], i);

        if (isEqual === false) {
            break;
        }
    }

    return isEqual!;
};

/**
 * Performs a for-of loop that breaks the instance `check` function returns false.
 * Used to check that a value is in another item.
 * @param {Array|Set|Map} item an array, set or map
 * @param {Function} check function to perform the check
 * @returns {boolean}
 */
export const forOfIsEqual = <
    I extends Iterable<unknown>
>(
    item: I,
    check: (v: unknown) => boolean
): boolean => {

    let isEqual: boolean;

    for (const val of item) {

        isEqual = check(val);

        if (isEqual === false) {
            break;
        }
    }

    return isEqual!;
};


/** Next tick but in the browser */
const nextTickQueue: Func[] = [];

window?.addEventListener('message', function (ev: MessageEvent<string>) {

    const source = ev.source;
    const evName = ev.data;

    if (
        (
            source === window ||
            source === null
        ) &&
        evName === 'process-tick'
    ) {

        ev.stopPropagation();

        if (nextTickQueue.length > 0) {

            const fn = nextTickQueue.shift();
            fn?.call && fn();
        }
    }
}, true);

/**
 * Browser implementation of `process.nextTick`
 * @param {function} fn
 */
export const _nextTick = (fn: Func) => {

    nextTickQueue.push(fn);
    window?.postMessage('process-tick', '*');
};

/**
 * Checks if value is a function or an object
 * @param val
 * @returns {boolean}
 */
export const isFunctionOrObject = <T extends Function | Object>(val: T): boolean => (
    val.constructor === Function ||
    val.constructor === Object
);

/**
 * Checks if value is specifically undefined
 * @param val
 * @returns {boolean}
 */
export const isUndefined = (val: unknown) => val === undefined;

/**
 * Optional value check. If value is undefined or null, it is considered optional.
 * If a function is provided, it is used to check the value. If a boolean is provided,
 * it is used to check the value.
 *
 * @param val value to check
 * @param check function or boolean to check value
 *
 * @returns {boolean}
 */
export const isOptional = (
    val: unknown,
    check: ((val: unknown) => boolean) | boolean
) => (
    val === undefined || val === null
) || (
    check instanceof Function ? check(val) : check
);

/**
 * Reaches into an object and returns the value at the end of the path
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

            return acc[key];
        },
        obj as any
    ) as PathValue<T, P> | undefined;
}

/**
 * Creates a deferred promise
 */
export class Deferred<T> {

    public promise: Promise<T>;
    public resolve!: (value: T) => void;
    public reject!: (reason?: Error | string) => void;

    constructor() {

        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

/**
 * Helper utilities for working with text
 */
export const txt = {

    msgs: (...args: ({ toString(): string } | string)[]) => {

        return args.map((arg) => arg.toString()).join(' ');
    },

    lines: (...args: ({ toString(): string } | string)[]) => {

        return args.map((arg) => arg.toString()).join('\n');
    }
}