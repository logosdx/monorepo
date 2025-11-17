
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
