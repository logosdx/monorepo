import type { Falsy, OneOrMany, PathNames, PathValue, Truthy } from './types.ts';
import { reach } from './misc.ts';

/**
 * Checks if the current environment is a browser.
 *
 * Tests for the presence of window and window.document objects.
 *
 * @returns true if running in a browser environment
 *
 * @example
 * if (isBrowser()) {
 *     // Safe to use DOM APIs
 *     document.querySelector('#app');
 * }
 */
export const isBrowser = () => typeof window !== 'undefined' && typeof window.document !== 'undefined';

/**
 * Checks if the current environment is React Native.
 *
 * Tests for the presence of navigator.product === 'ReactNative'.
 *
 * @returns true if running in React Native environment
 *
 * @example
 * if (isReactNative()) {
 *     // Use React Native specific APIs
 *     Alert.alert('Hello');
 * }
 */
export const isReactNative = () => typeof navigator !== 'undefined' && navigator?.product === 'ReactNative';

/**
 * Checks if the current environment is Cloudflare Workers.
 *
 * Tests for Cloudflare Workers specific user agent string.
 *
 * @returns true if running in Cloudflare Workers environment
 *
 * @example
 * if (isCloudflare()) {
 *     // Use Cloudflare Workers specific APIs
 *     addEventListener('fetch', event => {
 *         event.respondWith(handleRequest(event.request));
 *     });
 * }
 */
export const isCloudflare = () => typeof globalThis !== 'undefined' && globalThis?.navigator?.userAgent === 'Cloudflare-Workers';

/**
 * Checks if the current environment is browser-like (browser, React Native, or Cloudflare).
 *
 * Combines checks for browser, React Native, and Cloudflare environments.
 *
 * @returns true if running in any browser-like environment
 *
 * @example
 * if (isBrowserLike()) {
 *     // Safe to use navigation APIs
 *     window.location.href = '/dashboard';
 * } else {
 *     // Use Node.js specific path handling
 *     const path = require('path');
 *     const fullPath = path.join(process.cwd(), 'dashboard');
 * }
 */
export const isBrowserLike = () => isBrowser() || isReactNative() || isCloudflare();

/**
 * Checks if the current environment is Node.js.
 *
 * Tests for the presence of process.versions.node.
 *
 * @returns true if running in Node.js environment
 *
 * @example
 * if (isNode()) {
 *     // Safe to use Node.js APIs
 *     const fs = require('fs');
 *     const data = fs.readFileSync('file.txt', 'utf8');
 * }
 */
export const isNode = () => typeof process !== 'undefined' && process.versions?.node;

/**
 * Error class for assertions that fail
 */
export class AssertError extends Error {}

/**
 * Checks if an error is an AssertError.
 *
 * @param err error to check
 * @returns true if error is an AssertError
 */
export const isAssertError = (err: unknown): err is AssertError => (err as Error)?.constructor?.name === AssertError.name;

type AssertTest = (() => boolean) | boolean;
type AssertTestFn<T> = (v: T extends Function ? never : Truthy<T> | Falsy | undefined) => boolean;

/**
 * Optional value check with custom validation.
 *
 * Returns true if value is undefined/null OR if the custom check passes.
 * Useful for validating optional parameters with specific criteria.
 *
 * @param val value to check
 * @param check function or boolean to validate the value
 * @returns true if value is optional or passes the check
 *
 * @example
 * // With function check
 * function processData(data: any, timeout?: number) {
 *     assert(isOptional(timeout, (t) => t > 0), 'Timeout must be positive');
 *     // Process data...
 * }
 *
 * @example
 * // With boolean check
 * const isValid = validateInput(input);
 * if (isOptional(config.strict, isValid)) {
 *     // Either strict mode is off or input is valid
 *     processInput(input);
 * }
 *
 * @example
 * // Check optional email format
 * isOptional(user.email, (email) => email.includes('@')) // true if email is undefined or contains @
 */
export const isOptional = <T>(
    val: T | undefined,
    check: AssertTestFn<T> | boolean
) => (
    val === undefined || val === null
) || (
    check instanceof Function ? !!check(val as never) : !!check
);

/**
 * Asserts that a value is true. Even though NodeJS has
 * an `assert` builtin library, this aims to bring a
 * single API for asserting across all environments.
 *
 * @param test value that is coerced to true
 * @param message error message to display when test is false
 * @param ErrorClass error class to throw
 *
 * @example
 *
 * ```ts
 * assert(true, 'this is true');
 * assert(false, 'this is false');
 * assert(() => true, 'this is true');
 * assert(() => false, 'this is false');
 * ```
 *
 * ```ts
 *
 * const SomeErrorClass = class extends Error {
 *     constructor(message: string) {
 *         super(message);
 *     }
 * }
 *
 *
 * const someFunc = () => {
 *
 *     assert(true, 'this is true', SomeErrorClass);
 *     assert(false, 'this is false', SomeErrorClass);
 *     assert(() => true, 'this is true', SomeErrorClass);
 *     assert(() => false, 'this is false', SomeErrorClass);
 *
 *    // some logic
 * }
 *
 * someFunc();
 * ```
 */
export const assert = (
    test: unknown,
    message?: string,
    ErrorClass?: typeof Error
) => {

    const check = test instanceof Function ? !!test() : !!test

    if (check === false) {

        throw new (ErrorClass || AssertError)(message || 'assertion failed');
    }
};

type AssertObjTestFn<T, P extends string> = (val: PathValue<T, P>) => [
    AssertTest, string
];

/**
 * Asserts the values in an object based on the provided assertions.
 * The assertions are a map of paths to functions that return a tuple
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
 *     'c.d': (val) => [isOptional(val, v === 2), 'c.d should be 2']
 * });
 */
export const assertObject = <T extends object>(
    obj: T,
    assertions: {
        [K in PathNames<T>]?: (
            OneOrMany<AssertObjTestFn<T, K>>|
            OneOrMany<AssertTest>
        )
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

            throw new Error(`assertion for path ${path} is undefined`);
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

        const res = test(val as never) as [AssertTest, string];

        assert(res instanceof Array, `assertion did not return a tuple [boolean, string]`);

        const [check, message] = res;

        assert(check, message);
    }
}


/**
 * Asserts only if value is not undefined.
 *
 * Provides conditional assertion that only executes when the value is defined.
 * Useful for validating optional parameters or properties.
 *
 * @param val value to test
 * @param test assertion test
 * @param message error message
 * @param ErrorClass error class to throw
 *
 * @example
 * function processUser(user: User, options?: ProcessOptions) {
 *     // Only assert options if they are provided
 *     assertOptional(options, isObject(options), 'Options must be an object');
 *
 *     // Process user...
 * }
 *
 * @example
 * const config = getConfig();
 * assertOptional(config.timeout, config.timeout > 0, 'Timeout must be positive');
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
 * Checks if value is non-iterable by testing if it can be iterated over.
 *
 * Uses Symbol.iterator to determine if a value is iterable. Returns true
 * for values that cannot be iterated (null, undefined, primitives).
 *
 * @param val value to check for iterability
 * @returns true if value is not iterable, false if it can be iterated
 *
 * @example
 * isNonIterable(null) // true
 * isNonIterable('string') // true
 * isNonIterable([1,2,3]) // false
 * isNonIterable(new Set()) // false
 */
export const isNonIterable = (val: unknown): boolean => {

    // null and undefined are not iterable
    if (val === null || val === undefined) {

        return true;
    }

    // Check if value has Symbol.iterator property
    return !(val as any)[Symbol.iterator];
};

/**
 * Checks if value is a primitive type.
 *
 * @param val value to check
 * @returns true if value is a primitive type
 *
 * @example
 * isPrimitive(null) // true
 * isPrimitive(undefined) // true
 * isPrimitive('string') // true
 * isPrimitive(1) // true
 * isPrimitive(true) // true
 * isPrimitive(Symbol('symbol')) // true
 * isPrimitive(new Date()) // false
 * isPrimitive(new RegExp('')) // false
 * isPrimitive(new Error('')) // false
 * isPrimitive(new Set()) // false
 * isPrimitive(new Map()) // false
 * isPrimitive(new Array()) // true
 * isPrimitive(new Object()) // true
 */
export const isPrimitive = (val: unknown): boolean => (
    val === null ||
    val === undefined ||
    typeof val === 'string' ||
    typeof val === 'number' ||
    typeof val === 'boolean' ||
    typeof val === 'symbol' ||
    typeof val === 'bigint'
);


/**
 * Checks if value is a type that does not have a constructor.
 *
 * Tests for null and undefined values which lack constructors.
 * Useful for deep comparison and cloning operations.
 *
 * @param val value to check
 * @returns true if value has no constructor (null or undefined)
 *
 * @example
 * hasNoConstructor(null) // true
 * hasNoConstructor(undefined) // true
 * hasNoConstructor({}) // false
 * hasNoConstructor('string') // false
 * hasNoConstructor(42) // false
 */
export const hasNoConstructor = (val: unknown): boolean => (
    val === null ||
    val === undefined
);

/**
 * Checks if both values have the same constructor.
 *
 * Compares the constructor property of two values to determine if they
 * are instances of the same class or type.
 *
 * @param value first value to compare
 * @param compare second value to compare
 * @returns true if both values have the same constructor
 *
 * @example
 * hasSameConstructor([], [1, 2, 3]) // true (both Arrays)
 * hasSameConstructor({}, { a: 1 }) // true (both Objects)
 * hasSameConstructor([], {}) // false (Array vs Object)
 * hasSameConstructor(new Date(), new Date()) // true (both Dates)
 * hasSameConstructor('string', 42) // false (String vs Number)
 */
export const hasSameConstructor = (
    value: unknown,
    compare: unknown
): boolean => (
    (
        hasNoConstructor(value) === false &&
        hasNoConstructor(compare) === false
    ) &&
    (value as {}).constructor === (compare as {}).constructor
);

/**
 * Checks if both values have the same length or size.
 *
 * Compares the length property for arrays or size property for Sets.
 * Both iterables must be the same data type (both arrays or both Sets).
 * Useful for validating collections before performing operations.
 *
 * @param a first collection (array or Set)
 * @param b second collection (array or Set) - must be same type as `a`
 * @returns true if both collections have the same length/size
 *
 * @example
 * isSameLength([1, 2, 3], ['a', 'b', 'c']) // true
 * isSameLength([1, 2], [1, 2, 3]) // false
 * isSameLength(new Set([1, 2]), new Set(['a', 'b'])) // true
 * isSameLength(new Set([1, 2]), new Set([1, 2, 3])) // false
 */
export const isSameLength = <A extends Iterable<unknown>, B extends Iterable<unknown>>(
    a: A,
    b: B
): boolean => (
    (a as any).length === (b as any).length &&
    (a as any).size === (b as any).size
);

/**
 * Checks if value is a function.
 *
 * Uses instanceof to test if the value is a Function.
 * More reliable than typeof for all function types.
 *
 * @param a value to check
 * @returns true if value is a function
 *
 * @example
 * isFunction(() => {}) // true
 * isFunction(function() {}) // true
 * isFunction(async () => {}) // true
 * isFunction(class MyClass {}) // true
 * isFunction('string') // false
 * isFunction({}) // false
 */
export const isFunction = (a: unknown) => a instanceof Function;

/**
 * Checks if value is an object.
 *
 * Uses instanceof to test if the value is an Object.
 * Returns true for objects, arrays, functions, dates, etc.
 *
 * @param a value to check
 * @returns true if value is an object
 *
 * @example
 * isObject({}) // true
 * isObject([]) // true
 * isObject(new Date()) // true
 * isObject(() => {}) // true
 * isObject('string') // false
 * isObject(null) // false
 */
export const isObject = (a: unknown) => a instanceof Object;

const commonObjects = new Set([
    Date,
    RegExp,
    Function,
    Error,
    EvalError,
    RangeError,
    ReferenceError,
    SyntaxError,
    TypeError,
    URIError,
    AggregateError,
    DOMException,
    Array,
    Set,
    Map,
    WeakMap,
    WeakSet,
    Promise,
    Proxy,
    Symbol,
    BigInt,
    WeakRef,
    FinalizationRegistry,
    DataView,
    ArrayBuffer,
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    BigInt64Array,
    BigUint64Array,
    FormData,
    URLSearchParams,
]);

/**
 * Checks if value is an uncommon object. Used to determine if a value
 * is a user defined object.
 *
 * @param a value to check
 * @returns true if value is an uncommon object
 *
 * @example
 *
 * // Returns false for common objects
 * isPlainObject(new Date()) // false
 * isPlainObject(new RegExp('')) // false
 * isPlainObject(new Function()) // false
 * isPlainObject(new Error()) // false
 * isPlainObject(new Array()) // false
 * isPlainObject(new Set()) // false
 *
 * // Returns true for uncommon objects
 * isPlainObject({}) // true
 * isPlainObject(new MyClass()) // true
 *
 */
export const isPlainObject = (a: unknown): a is object => (
    !isPrimitive(a) &&
    isObject(a) &&
    !commonObjects.has((a as any).constructor)
);

/**
 * Checks if value is specifically undefined.
 *
 * Strict equality check for undefined values.
 * More explicit than checking truthiness.
 *
 * @param val value to check
 * @returns true if value is exactly undefined
 *
 * @example
 * isUndefined(undefined) // true
 * isUndefined(null) // false
 * isUndefined('') // false
 * isUndefined(0) // false
 *
 * let x;
 * isUndefined(x) // true
 */
export const isUndefined = (val: unknown): val is undefined => val === undefined;

/**
 * Checks if value is specifically not undefined.
 *
 * Inverse of isUndefined. Returns true for all values except undefined,
 * including null, false, 0, and empty strings.
 *
 * @param val value to check
 * @returns true if value is not undefined
 *
 * @example
 * isDefined(null) // true
 * isDefined(0) // true
 * isDefined('') // true
 * isDefined(false) // true
 * isDefined(undefined) // false
 *
 * const config = getConfig();
 * if (isDefined(config.apiKey)) {
 *     // Safe to use config.apiKey
 * }
 */
export const isDefined = (val: unknown): val is NonNullable<unknown> => val !== undefined;

/**
 * Checks if value is specifically null.
 *
 * Strict equality check for null values.
 * More explicit than checking truthiness.
 *
 * @param val value to check
 * @returns true if value is exactly null
 *
 * @example
 * isNull(null) // true
 * isNull(undefined) // false
 * isNull('') // false
 * isNull(0) // false
 *
 * const result = findUser(id);
 * if (isNull(result)) {
 *     // User was explicitly not found
 * }
 */
export const isNull = (val: unknown): val is null => val === null;


/**
 * Performs a for-in loop that breaks when the check function returns false.
 *
 * Iterates over object properties (including inherited enumerable properties)
 * and stops early if the check function returns false for any property.
 *
 * @param item object or array to iterate over
 * @param check function to test each property value and key
 * @returns true if all properties pass the check, false otherwise
 *
 * @example
 * const config = { timeout: 5000, retries: 3, enabled: true };
 *
 * const allValid = allKeysValid(config, (value, key) => {
 *     if (key === 'timeout') return typeof value === 'number' && value > 0;
 *     if (key === 'retries') return typeof value === 'number' && value >= 0;
 *     if (key === 'enabled') return typeof value === 'boolean';
 *     return true;
 * }); // true
 *
 * @example
 * const scores = { alice: 95, bob: 87, charlie: 92 };
 * const allPassed = allKeysValid(scores, (score) => score >= 90); // false (bob: 87)
 *
 * @example
 * // Validate form data
 * const formData = { name: 'John', email: 'john@example.com', age: 30 };
 * const isValid = allKeysValid(formData, (value, field) => {
 *     return value !== null && value !== undefined && value !== '';
 * });
 */
export const allKeysValid = <T extends object>(
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
 * Performs a for-of loop that breaks when the check function returns false.
 *
 * Iterates over iterable values (arrays, Sets, Maps) and stops early
 * if the check function returns false for any value.
 *
 * @param item iterable to iterate over (Array, Set, Map, etc.)
 * @param check function to test each value
 * @returns true if all values pass the check, false otherwise
 *
 * @example
 * const numbers = [2, 4, 6, 8, 10];
 * const allEven = allItemsValid(numbers, (num) => num % 2 === 0); // true
 *
 * const mixed = [2, 4, 5, 8];
 * const allEven2 = allItemsValid(mixed, (num) => num % 2 === 0); // false (stops at 5)
 *
 * @example
 * const userIds = new Set(['user1', 'user2', 'user3']);
 * const allValidIds = allItemsValid(userIds, (id) => {
 *     return typeof id === 'string' && id.startsWith('user');
 * }); // true
 *
 * @example
 * // Check if all files exist before processing
 * const files = ['config.json', 'data.csv', 'template.html'];
 * const allExist = allItemsValid(files, (filename) => {
 *     return fs.existsSync(filename);
 * });
 */
export const allItemsValid = <
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
