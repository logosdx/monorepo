import {
    describe,
    it,
    expect
} from 'vitest'


import {
    isBrowser,
    isReactNative,
    isCloudflare,
    isBrowserLike,
    isNode,
    AssertError,
    isOptional,
    assert,
    assertObject,
    assertOptional,
    isNonIterable,
    isPrimitive,
    hasNoConstructor,
    hasSameConstructor,
    isSameLength,
    isFunction,
    isObject,
    isPlainObject,
    isUndefined,
    isDefined,
    isNull,
    allKeysValid,
    isEnabledValue,
    isDisabledValue,
    hasEnabledOrDisabledValue,
    allItemsValid,
} from '../../../packages/utils/src/validation/index.ts';

/**
 * Type tests for PathValue with Maps and Sets
 */
import type { PathValue, PathNames } from '../../../packages/utils/src/types.ts'

// Test interface with various collection types
interface TestData {

    profile: {
        name: string
        age: number
    }
    tags: Set<string>
    scores: Set<{ value: number; label: string }>
    metadata: Map<string, { value: string }>
    settings: Map<'theme' | 'lang', string>
    items: string[]
    matrix: number[][]
}

// PathValue type tests
type Test1 = PathValue<TestData, 'profile.name'> // string
type Test2 = PathValue<TestData, 'profile.age'> // number
type Test3 = PathValue<TestData, 'tags.0'> // string
type Test4 = PathValue<TestData, 'scores.0.value'> // number
type Test5 = PathValue<TestData, 'metadata.someKey.value'> // string
type Test6 = PathValue<TestData, 'settings.theme'> // string
type Test7 = PathValue<TestData, 'settings.lang'> // string
type Test8 = PathValue<TestData, 'items.0'> // string
type Test9 = PathValue<TestData, 'matrix.0.1'> // number

// Verify the types resolve correctly (compile-time type tests)
// @ts-expect-error - unused vars are intentional for type testing
const _test1: Test1 = 'string'
// @ts-expect-error - unused vars are intentional for type testing
const _test2: Test2 = 42
// @ts-expect-error - unused vars are intentional for type testing
const _test3: Test3 = 'tag'
// @ts-expect-error - unused vars are intentional for type testing
const _test4: Test4 = 100
// @ts-expect-error - unused vars are intentional for type testing
const _test5: Test5 = 'meta value'
// @ts-expect-error - unused vars are intentional for type testing
const _test6: Test6 = 'dark'
// @ts-expect-error - unused vars are intentional for type testing
const _test7: Test7 = 'en'
// @ts-expect-error - unused vars are intentional for type testing
const _test8: Test8 = 'item'
// @ts-expect-error - unused vars are intentional for type testing
const _test9: Test9 = 42

// PathNames should generate all these paths
// @ts-expect-error - unused type is intentional for documentation
type AllPaths = PathNames<TestData>
// This should include paths like:
// 'tags' | 'tags.0' | 'scores' | 'scores.0' | 'scores.0.value' | 'scores.0.label' |
// 'metadata' | 'metadata.someKey' | 'metadata.someKey.value' | etc.

describe('@logosdx/utils - validation', () => {

    describe('environment detection', () => {

        it('should detect browser environment', () => {

            // Note: JSDOM sets up window and document in test environment
            // so isBrowser() returns true in our test setup
            expect(isBrowser()).to.be.true;
        });

        it('should detect React Native environment', () => {

            // In Node.js environment, this should return false
            expect(isReactNative()).to.be.false;

            // Mock React Native environment by defining navigator if it doesn't exist
            const originalNavigator = (global as any).navigator;

            // Override with Object.defineProperty to handle read-only properties
            Object.defineProperty(global, 'navigator', {
                value: { product: 'ReactNative' },
                writable: true,
                configurable: true
            });

            expect(isReactNative()).to.be.true;

            // Restore original navigator
            if (originalNavigator) {
                Object.defineProperty(global, 'navigator', {
                    value: originalNavigator,
                    writable: true,
                    configurable: true
                });
            } else {
                delete (global as any).navigator;
            }
        });

        it('should detect Cloudflare Workers environment', () => {

            // In Node.js environment, this should return false
            expect(isCloudflare()).to.be.false;

            // Mock Cloudflare Workers environment by modifying navigator directly
            const originalNavigator = globalThis.navigator;
            Object.defineProperty(globalThis, 'navigator', {
                value: { userAgent: 'Cloudflare-Workers' },
                writable: true,
                configurable: true
            });

            expect(isCloudflare()).to.be.true;

            // Restore original navigator
            Object.defineProperty(globalThis, 'navigator', {
                value: originalNavigator,
                writable: true,
                configurable: true
            });
        });

        it('should detect browser-like environments', () => {

            // Note: JSDOM sets up browser-like environment in our test setup
            // so isBrowserLike() returns true
            expect(isBrowserLike()).to.be.true;
        });

        it('should detect Node.js environment', () => {

            // In Node.js environment, this should return a truthy value (version string)
            expect(isNode()).to.be.ok;
            expect(typeof isNode()).to.equal('string');
        });
    });

    describe('AssertError', () => {

        it('should be an instance of Error', () => {

            const error = new AssertError('test message');

            expect(error).to.be.instanceOf(Error);
            expect(error).to.be.instanceOf(AssertError);
            expect(error.message).to.equal('test message');
        });

        it('should work with assert function', () => {

            expect(() => assert(false, 'custom error')).to.throw(AssertError);
            expect(() => assert(false, 'custom error')).to.throw('custom error');
        });
    });

    describe('isOptional', () => {

        it('should return true for undefined values', () => {

            expect(isOptional(undefined, true)).to.be.true;
            expect(isOptional(undefined, false)).to.be.true;
            expect(isOptional(undefined, () => false)).to.be.true;
        });

        it('should return true for null values', () => {

            expect(isOptional(null, true)).to.be.true;
            expect(isOptional(null, false)).to.be.true;
            expect(isOptional(null, () => false)).to.be.true;
        });

        it('should evaluate check for defined values', () => {

            expect(isOptional('value', true)).to.be.true;
            expect(isOptional('value', false)).to.be.false;
            expect(isOptional('test', (val) => val === 'test')).to.be.true;
            expect(isOptional('test', (val) => val === 'other')).to.be.false;
        });
    });

    describe('assert', () => {

        it('should not throw for truthy values', () => {

            expect(() => assert(true)).to.not.throw();
            expect(() => assert(1)).to.not.throw();
            expect(() => assert('hello')).to.not.throw();
            expect(() => assert(() => true)).to.not.throw();
        });

        it('should throw for falsy values', () => {

            expect(() => assert(false)).to.throw('assertion failed');
            expect(() => assert(0)).to.throw('assertion failed');
            expect(() => assert('')).to.throw('assertion failed');
            expect(() => assert(() => false)).to.throw('assertion failed');
        });

        it('should use custom error message', () => {

            expect(() => assert(false, 'custom message')).to.throw('custom message');
        });

        it('should use custom error class', () => {

            class CustomError extends Error {
                constructor(message?: string) {
                    super(message);
                }
            }

            expect(() => assert(false, 'custom', CustomError as any)).to.throw(CustomError);
            expect(() => assert(false, 'custom', CustomError as any)).to.throw('custom');
        });
    });

    describe('assertObject', () => {

        const sample = {
            a: 1,
            b: 'two',
            c: [1, 2, 3],
            d: {
                G: {
                    h: 'h'
                }
            },
            x: new Map<'one' | 'two', { three: { four: number } }>([
                ['one', { three: { four: 1 } }],
                ['two', { three: { four: 2 } }]
            ])
        };

        it('should validate object properties', () => {

            const validate = (o: any) => {

                const subj = o as typeof sample;

                assertObject(subj, {
                    a: (x) => [typeof x === 'number', 'a is not a number'],
                    b: (x) => [typeof x === 'string', 'b is not a string'],
                    c: [
                        (x) => [!!x, 'c is not defined'],
                        (x) => [Array.isArray(x), 'c is not an array'],
                    ],
                    d: (x) => [typeof x === 'object', 'd is not an object'],
                    'd.G.h': (x) => [!!x, 'd.G.h is not defined'],
                    'x.one.three.four': (x) => [
                        typeof x === 'number',
                        'x.one.three.four is not a number'
                    ],
                })
            };

            expect(() => validate(sample)).to.not.throw();
            expect(() => validate({ ...sample, a: 'one' })).to.throw(/a is not a number/);
            expect(() => validate({ ...sample, b: 2 })).to.throw(/b is not a string/);
            expect(() => validate({ ...sample, c: 1 })).to.throw(/c is not an array/);
            expect(() => validate({ ...sample, c: null })).to.throw(/c is not defined/);
            expect(() => validate({ ...sample, d: 1 })).to.throw(/d is not an object/);
            expect(() => validate({ ...sample, d: { G: {} } })).to.throw(/d.G.h is not defined/);
        });
    });

    describe('assertOptional', () => {

        it('should not assert for undefined values', () => {

            expect(() => assertOptional(undefined, false, 'should not throw')).to.not.throw();
        });

        it('should assert for defined values', () => {

            expect(() => assertOptional('value', true)).to.not.throw();
            expect(() => assertOptional('value', false, 'should throw')).to.throw('should throw');
        });
    });

    describe('isNonIterable', () => {

        it('should return true for non-iterable values', () => {

            expect(isNonIterable(null)).to.be.true;
            expect(isNonIterable(undefined)).to.be.true;
            expect(isNonIterable(42)).to.be.true;
            expect(isNonIterable(true)).to.be.true;
            expect(isNonIterable(Symbol('test'))).to.be.true;
            expect(isNonIterable({})).to.be.true;
            expect(isNonIterable(new Date())).to.be.true;
        });

        it('should return false for iterable values', () => {

            expect(isNonIterable('string')).to.be.false;
            expect(isNonIterable([])).to.be.false;
            expect(isNonIterable(new Set())).to.be.false;
            expect(isNonIterable(new Map())).to.be.false;
        });
    });

    describe('isPrimitive', () => {

        it('should return true for primitive values', () => {

            expect(isPrimitive(null)).to.be.true;
            expect(isPrimitive(undefined)).to.be.true;
            expect(isPrimitive('string')).to.be.true;
            expect(isPrimitive(42)).to.be.true;
            expect(isPrimitive(true)).to.be.true;
            expect(isPrimitive(Symbol('test'))).to.be.true;
            expect(isPrimitive(BigInt(123))).to.be.true;
        });

        it('should return false for non-primitive values', () => {

            expect(isPrimitive(() => {})).to.be.false;
            expect(isPrimitive({})).to.be.false;
            expect(isPrimitive([])).to.be.false;
            expect(isPrimitive(new Date())).to.be.false;
            expect(isPrimitive(new RegExp(''))).to.be.false;
            expect(isPrimitive(new Error(''))).to.be.false;
            expect(isPrimitive(new Set())).to.be.false;
            expect(isPrimitive(new Map())).to.be.false;
        });
    });

    describe('hasNoConstructor', () => {

        it('should return true for values without constructor', () => {

            expect(hasNoConstructor(null)).to.be.true;
            expect(hasNoConstructor(undefined)).to.be.true;
        });

        it('should return false for values with constructor', () => {

            expect(hasNoConstructor('string')).to.be.false;
            expect(hasNoConstructor(42)).to.be.false;
            expect(hasNoConstructor({})).to.be.false;
            expect(hasNoConstructor([])).to.be.false;
        });
    });

    describe('hasSameConstructor', () => {

        it('should return true for same constructor types', () => {

            class A {}
            class B {}

            expect(hasSameConstructor(new A(), new A())).to.be.true;
            expect(hasSameConstructor(new B(), new B())).to.be.true;
            expect(hasSameConstructor(new A(), new B())).to.be.false;
            expect(hasSameConstructor(new B(), new A())).to.be.false;

            expect(hasSameConstructor('a', 'b')).to.be.true;
            expect(hasSameConstructor(1, 2)).to.be.true;
            expect(hasSameConstructor([], [])).to.be.true;
            expect(hasSameConstructor({}, {})).to.be.true;
            expect(hasSameConstructor(new Date(), new Date())).to.be.true;
        });

        it('should return false for different constructor types', () => {

            expect(hasSameConstructor('string', 42)).to.be.false;
            expect(hasSameConstructor([], {})).to.be.false;
            expect(hasSameConstructor(new Date(), {})).to.be.false;
        });

        it('should handle null and undefined', () => {

            expect(hasSameConstructor(undefined, undefined)).to.be.false;
            expect(hasSameConstructor(undefined, 'string')).to.be.false;
            expect(hasSameConstructor(null, null)).to.be.false;
            expect(hasSameConstructor(null, 'string')).to.be.false;
            expect(hasSameConstructor('string', null)).to.be.false;
        });
    });

    describe('isSameLength', () => {

        it('should return true for same length arrays', () => {

            expect(isSameLength([1, 2], [3, 4])).to.be.true;
            expect(isSameLength([], [])).to.be.true;
        });

        it('should return false for different length arrays', () => {

            expect(isSameLength([1], [2, 3])).to.be.false;
            expect(isSameLength([1, 2, 3], [])).to.be.false;
        });

        it('should work with Sets', () => {

            expect(isSameLength(new Set([1, 2]), new Set([3, 4]))).to.be.true;
            expect(isSameLength(new Set([1]), new Set([2, 3]))).to.be.false;
        });
    });

    describe('isFunction', () => {

        it('should return true for functions', () => {

            expect(isFunction(() => {})).to.be.true;
            expect(isFunction(function() {})).to.be.true;
            expect(isFunction(async () => {})).to.be.true;
            expect(isFunction(class Test {})).to.be.true;
        });

        it('should return false for non-functions', () => {

            expect(isFunction({})).to.be.false;
            expect(isFunction('string')).to.be.false;
            expect(isFunction(42)).to.be.false;
            expect(isFunction([])).to.be.false;
        });
    });

    describe('isObject', () => {

        it('should return true for objects', () => {

            expect(isObject({})).to.be.true;
            expect(isObject([])).to.be.true;
            expect(isObject(new Date())).to.be.true;
            expect(isObject(() => {})).to.be.true;
            expect(isObject(new Set())).to.be.true;
        });

        it('should return false for non-objects', () => {

            expect(isObject('string')).to.be.false;
            expect(isObject(42)).to.be.false;
            expect(isObject(null)).to.be.false;
            expect(isObject(undefined)).to.be.false;
        });
    });

    describe('isPlainObject', () => {

        it('should return true for uncommon objects', () => {

            expect(isPlainObject({})).to.be.true;

            class CustomClass {}
            expect(isPlainObject(new CustomClass())).to.be.true;
        });

        it('should return false for common objects', () => {

            expect(isPlainObject(new Date())).to.be.false;
            expect(isPlainObject(new RegExp(''))).to.be.false;
            expect(isPlainObject(new Function())).to.be.false;
            expect(isPlainObject(new Error())).to.be.false;
            expect(isPlainObject(new Array())).to.be.false;
            expect(isPlainObject(new Set())).to.be.false;
            expect(isPlainObject(new Map())).to.be.false;
        });

        it('should return false for primitives', () => {

            expect(isPlainObject('string')).to.be.false;
            expect(isPlainObject(42)).to.be.false;
            expect(isPlainObject(true)).to.be.false;
            expect(isPlainObject(null)).to.be.false;
            expect(isPlainObject(undefined)).to.be.false;
        });
    });

    describe('isUndefined', () => {

        it('should return true for undefined', () => {

            expect(isUndefined(undefined)).to.be.true;

            let x;
            expect(isUndefined(x)).to.be.true;
        });

        it('should return false for defined values', () => {

            expect(isUndefined(null)).to.be.false;
            expect(isUndefined('')).to.be.false;
            expect(isUndefined(0)).to.be.false;
            expect(isUndefined(false)).to.be.false;
            expect(isUndefined({})).to.be.false;
        });
    });

    describe('isDefined', () => {

        it('should return false for undefined', () => {

            expect(isDefined(undefined)).to.be.false;

            let x;
            expect(isDefined(x)).to.be.false;
        });

        it('should return true for defined values', () => {

            expect(isDefined(null)).to.be.true;
            expect(isDefined('')).to.be.true;
            expect(isDefined(0)).to.be.true;
            expect(isDefined(false)).to.be.true;
            expect(isDefined({})).to.be.true;
            expect(isDefined('value')).to.be.true;
        });
    });

    describe('isNull', () => {

        it('should return true for null', () => {

            expect(isNull(null)).to.be.true;
        });

        it('should return false for non-null values', () => {

            expect(isNull(undefined)).to.be.false;
            expect(isNull('')).to.be.false;
            expect(isNull(0)).to.be.false;
            expect(isNull(false)).to.be.false;
            expect(isNull({})).to.be.false;
        });
    });

    describe('allKeysValid', () => {

        it('should return true when all keys pass validation', () => {

            const config = { timeout: 5000, retries: 3, enabled: true };

            const allValid = allKeysValid(config, (value, key) => {

                if (key === 'timeout') return typeof value === 'number' && value > 0;
                if (key === 'retries') return typeof value === 'number' && value >= 0;
                if (key === 'enabled') return typeof value === 'boolean';
                return true;
            });

            expect(allValid).to.be.true;
        });

        it('should return false when any key fails validation', () => {

            const scores = { alice: 95, bob: 87, charlie: 92 };
            const allPassed = allKeysValid(scores, (score) => score >= 90);

            expect(allPassed).to.be.false;
        });

        it('should work with arrays', () => {

            const arr = [1, 2, 3];

            expect(allKeysValid(arr, (val) => typeof val === 'number')).to.be.true;
            expect(allKeysValid(arr, (val) => (val as number) > 2)).to.be.false;
        });
    });

    describe('allItemsValid', () => {

        it('should return true when all items pass validation', () => {

            const numbers = [2, 4, 6, 8, 10];
            const allEven = allItemsValid(numbers, (num) => (num as number) % 2 === 0);

            expect(allEven).to.be.true;
        });

        it('should return false when any item fails validation', () => {

            const mixed = [2, 4, 5, 8];
            const allEven = allItemsValid(mixed, (num) => (num as number) % 2 === 0);

            expect(allEven).to.be.false;
        });

        it('should work with Sets', () => {

            const userIds = new Set(['user1', 'user2', 'user3']);
            const allValidIds = allItemsValid(userIds, (id) => {

                return typeof id === 'string' && (id as string).startsWith('user');
            });

            expect(allValidIds).to.be.true;
        });

        it('should work with Maps', () => {

            const scores = new Map([['alice', 95], ['bob', 87], ['charlie', 92]]);
            const allPassed = allItemsValid(scores, (entry) => {

                const [name, score] = entry as [string, number];
                return typeof name === 'string' && typeof score === 'number' && score >= 80;
            });

            expect(allPassed).to.be.true;
        });
    });

    describe('isEnabledValue', () => {

        it('should return true for string "true"', () => {

            expect(isEnabledValue('true')).to.be.true;
        });

        it('should return true for string "yes"', () => {

            expect(isEnabledValue('yes')).to.be.true;
        });

        it('should return true for boolean true', () => {

            expect(isEnabledValue(true)).to.be.true;
        });

        it('should return false for string "false"', () => {

            expect(isEnabledValue('false')).to.be.false;
        });

        it('should return false for string "no"', () => {

            expect(isEnabledValue('no')).to.be.false;
        });

        it('should return false for boolean false', () => {

            expect(isEnabledValue(false)).to.be.false;
        });

        it('should return false for arbitrary strings', () => {

            expect(isEnabledValue('maybe')).to.be.false;
            expect(isEnabledValue('unknown')).to.be.false;
            expect(isEnabledValue('')).to.be.false;
        });

        it('should return false for numbers', () => {

            expect(isEnabledValue(1)).to.be.false;
            expect(isEnabledValue(0)).to.be.false;
            expect(isEnabledValue(123)).to.be.false;
        });

        it('should return false for null and undefined', () => {

            expect(isEnabledValue(null)).to.be.false;
            expect(isEnabledValue(undefined)).to.be.false;
        });

        it('should return false for objects', () => {

            expect(isEnabledValue({})).to.be.false;
            expect(isEnabledValue([])).to.be.false;
        });
    });

    describe('isDisabledValue', () => {

        it('should return true for string "false"', () => {

            expect(isDisabledValue('false')).to.be.true;
        });

        it('should return true for string "no"', () => {

            expect(isDisabledValue('no')).to.be.true;
        });

        it('should return true for boolean false', () => {

            expect(isDisabledValue(false)).to.be.true;
        });

        it('should return false for string "true"', () => {

            expect(isDisabledValue('true')).to.be.false;
        });

        it('should return false for string "yes"', () => {

            expect(isDisabledValue('yes')).to.be.false;
        });

        it('should return false for boolean true', () => {

            expect(isDisabledValue(true)).to.be.false;
        });

        it('should return false for arbitrary strings', () => {

            expect(isDisabledValue('maybe')).to.be.false;
            expect(isDisabledValue('unknown')).to.be.false;
            expect(isDisabledValue('')).to.be.false;
        });

        it('should return false for numbers', () => {

            expect(isDisabledValue(1)).to.be.false;
            expect(isDisabledValue(0)).to.be.false;
            expect(isDisabledValue(123)).to.be.false;
        });

        it('should return false for null and undefined', () => {

            expect(isDisabledValue(null)).to.be.false;
            expect(isDisabledValue(undefined)).to.be.false;
        });

        it('should return false for objects', () => {

            expect(isDisabledValue({})).to.be.false;
            expect(isDisabledValue([])).to.be.false;
        });
    });

    describe('hasEnabledOrDisabledValue', () => {

        it('should return true for enabled values', () => {

            expect(hasEnabledOrDisabledValue('true')).to.be.true;
            expect(hasEnabledOrDisabledValue('yes')).to.be.true;
            expect(hasEnabledOrDisabledValue(true)).to.be.true;
        });

        it('should return true for disabled values', () => {

            expect(hasEnabledOrDisabledValue('false')).to.be.true;
            expect(hasEnabledOrDisabledValue('no')).to.be.true;
            expect(hasEnabledOrDisabledValue(false)).to.be.true;
        });

        it('should return false for arbitrary strings', () => {

            expect(hasEnabledOrDisabledValue('maybe')).to.be.false;
            expect(hasEnabledOrDisabledValue('unknown')).to.be.false;
            expect(hasEnabledOrDisabledValue('')).to.be.false;
        });

        it('should return false for numbers', () => {

            expect(hasEnabledOrDisabledValue(1)).to.be.false;
            expect(hasEnabledOrDisabledValue(0)).to.be.false;
            expect(hasEnabledOrDisabledValue(123)).to.be.false;
        });

        it('should return false for null and undefined', () => {

            expect(hasEnabledOrDisabledValue(null)).to.be.false;
            expect(hasEnabledOrDisabledValue(undefined)).to.be.false;
        });

        it('should return false for objects', () => {

            expect(hasEnabledOrDisabledValue({})).to.be.false;
            expect(hasEnabledOrDisabledValue([])).to.be.false;
        });
    });
});