import type { Falsy, OneOrMany, PathNames, PathValue, Truthy } from '../types.ts';
import { reach } from '../object-utils/index.ts';

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
