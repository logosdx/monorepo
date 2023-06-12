import { Func } from "./types";

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
 *
 * @param test value that is coerced to true
 * @param message error message to display when test is false
 */
export const assert = (test: boolean, message?: string, ErrorClass?: typeof Error) => {

    if (test === false) {

        throw new (ErrorClass || AssertationError)(message || 'assertion failed');
    }
};


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

                target[k] = applyDefaults(
                    (_t)[k] || {} as T,
                    source[k] as T
                ) as any;
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
export const isNonIterable = (val: any): boolean => (
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
export const hasNoConstructor = (val: any): boolean => (
    val === null ||
    val === undefined
);

/**
 * Checks if either value is non iterable
 * @param value
 * @param compare
 * @returns {boolean}
 */
export const oneIsNonIterable = (value: any, compare: any): boolean => (
    isNonIterable(value) || isNonIterable(compare)
);

/**
 * Checks if both values have the same constructor
 * @param value
 * @param compare
 * @returns {boolean}
 */
export const hasSameConstructor = (value: any, compare: any): boolean => (
    value.constructor === compare.constructor
);

/**
 * Checks if both values are the length (or size). Values can be any iterable with
 * the property `length` or `size`.
 * @param a
 * @param b
 * @returns {boolean}
 */
export const isSameLength = (a: any, b: any): boolean => (
    a.length === b.length &&
    a.size === b.size
);

/**
 * Checks if value is instance of a function
 * @param a
 * @returns {boolean}
 */
export const isFunction = (a: any) => a instanceof Function;

/**
 * Performs a for-in loop that breaks the instance `check` function returns false.
 * Used to check that a value is in another item.
 * @param {Object|Array} item an object or array
 * @param {Function} check function to perform the check
 * @returns {boolean}
 */
export const forInIsEqual = (item: any, check: { (v: any, i: number|string): boolean }): boolean => {

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
export const forOfIsEqual = (item: any, check: { (v: any): boolean }): boolean => {

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

window.addEventListener('message', function (ev) {

    const source = ev.source;

    if (
        (
            source === window ||
            source === null
        ) &&
        ev.data === 'process-tick'
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
    window.postMessage('process-tick', '*');
};

/**
 * Checks if value is a function or an object
 * @param val
 * @returns
 */
export const isFunctionOrObject = <T extends Function | Object>(val: T): boolean => (
    val.constructor === Function ||
    val.constructor === Object
);

/**
 * Checks if value is specifically undefined
 * @param val
 * @returns
 */
export const isUndefined = (val: any) => val === undefined;

