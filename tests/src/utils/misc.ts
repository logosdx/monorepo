import {
    describe,
    it,
    before,
    after,
    mock,
    Mock
} from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import {
    assertObject,
    reach,
    definePublicProps,
    definePrivateProps,
    definePrivateGetters,
    assert,
    assertOptional,
    applyDefaults,
    itemsToArray,
    oneOrMany,
    isNonIterable,
    hasNoConstructor,
    oneIsNonIterable,
    hasSameConstructor,
    isSameLength,
    isFunction,
    isObject,
    forInEvery,
    forOfEvery,
    isFunctionOrObject,
    isUndefined,
    isOptional,
    Deferred,
    wait,
    chunk,
} from '../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    describe('misc', () => {

        const sample = {
            a: 1,
            b: 'two',
            c: [1,2,3],
            d: {
                G: {
                    h: 'h'
                }
            }
        };

        it('should assertObject', () => {

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

        it('should reach for properties on object', () => {

            expect(reach(sample, 'a')).to.equal(1);
            expect(reach(sample, 'b')).to.equal('two');
            expect(reach(sample, 'c')).to.deep.equal([1,2,3]);
            expect(reach(sample, 'd.G.h')).to.equal('h');
        });

        it('should definePublicProps', () => {
            const target = {};
            const props = { foo: 'bar', num: 42 };

            definePublicProps(target, props);

            expect((target as any).foo).to.equal('bar');
            expect((target as any).num).to.equal(42);

            // Should be enumerable
            expect(Object.keys(target)).to.include('foo');
            expect(Object.keys(target)).to.include('num');

            // Should not be writable
            expect(() => {
                (target as any).foo = 'changed';
            }).to.throw();
        });

        it('should definePrivateProps', () => {
            const target = {};
            const props = { secret: 'hidden', value: 123 };

            definePrivateProps(target, props);

            expect((target as any).secret).to.equal('hidden');
            expect((target as any).value).to.equal(123);

            // Should not be enumerable
            expect(Object.keys(target)).to.not.include('secret');
            expect(Object.keys(target)).to.not.include('value');

            // Should not be writable
            expect(() => {
                (target as any).secret = 'changed';
            }).to.throw();
        });

        it('should definePrivateGetters', () => {
            const target = {};
            let counter = 0;
            const getters = {
                count: () => ++counter,
                doubled: () => counter * 2
            };

            definePrivateGetters(target, getters);

            expect((target as any).count).to.equal(1);
            expect((target as any).doubled).to.equal(2);
            expect((target as any).count).to.equal(2); // Should increment

            // Should not be enumerable
            expect(Object.keys(target)).to.not.include('count');
            expect(Object.keys(target)).to.not.include('doubled');
        });

        it('should assert with truthy values', () => {
            expect(() => assert(true)).to.not.throw();
            expect(() => assert(1)).to.not.throw();
            expect(() => assert('hello')).to.not.throw();
            expect(() => assert(() => true)).to.not.throw();

            expect(() => assert(false)).to.throw('assertion failed');
            expect(() => assert(0)).to.throw('assertion failed');
            expect(() => assert('')).to.throw('assertion failed');
            expect(() => assert(() => false)).to.throw('assertion failed');

            expect(() => assert(false, 'custom message')).to.throw('custom message');
        });

        it('should assertOptional', () => {
            expect(() => assertOptional(undefined, true)).to.not.throw();
            expect(() => assertOptional('value', true)).to.not.throw();
            expect(() => assertOptional('value', false)).to.throw();
        });

        it('should applyDefaults', () => {
            const target = { a: 1, b: { x: 10 } };
            const source1 = { a: 1, b: { x: 10, y: 20 }, c: 3 };
            const source2 = { a: 1, b: { x: 10 }, d: 4 };

            const result = applyDefaults(target, source1, source2);

            expect(result).to.deep.equal({
                a: 1,
                b: { x: 10, y: 20 },
                c: 3,
                d: 4
            });
        });

        it('should itemsToArray', () => {
            expect(itemsToArray('single')).to.deep.equal(['single']);
            expect(itemsToArray(['already', 'array'])).to.deep.equal(['already', 'array']);
            expect(itemsToArray(42)).to.deep.equal([42]);
        });

        it('should oneOrMany', () => {
            expect(oneOrMany(['single'])).to.equal('single');
            expect(oneOrMany(['one', 'two'])).to.deep.equal(['one', 'two']);
            expect(oneOrMany([])).to.deep.equal([]);
        });

        it('should isNonIterable', () => {
            expect(isNonIterable(null)).to.be.true;
            expect(isNonIterable(undefined)).to.be.true;
            expect(isNonIterable('string')).to.be.true;
            expect(isNonIterable(42)).to.be.true;
            expect(isNonIterable(true)).to.be.true;
            expect(isNonIterable(Symbol('test'))).to.be.true;

            expect(isNonIterable([])).to.be.false;
            expect(isNonIterable({})).to.be.false;
            expect(isNonIterable(new Date())).to.be.false;
        });

        it('should hasNoConstructor', () => {
            expect(hasNoConstructor(null)).to.be.true;
            expect(hasNoConstructor(undefined)).to.be.true;

            expect(hasNoConstructor('string')).to.be.false;
            expect(hasNoConstructor(42)).to.be.false;
            expect(hasNoConstructor({})).to.be.false;
        });

        it('should oneIsNonIterable', () => {
            expect(oneIsNonIterable(null, {})).to.be.true;
            expect(oneIsNonIterable({}, null)).to.be.true;
            expect(oneIsNonIterable('string', {})).to.be.true;

            expect(oneIsNonIterable({}, [])).to.be.false;
            expect(oneIsNonIterable([], {})).to.be.false;
        });

        it('should hasSameConstructor', () => {
            expect(hasSameConstructor('a', 'b')).to.be.true;
            expect(hasSameConstructor(1, 2)).to.be.true;
            expect(hasSameConstructor([], [])).to.be.true;
            expect(hasSameConstructor({}, {})).to.be.true;

            expect(hasSameConstructor('string', 42)).to.be.false;
            expect(hasSameConstructor([], {})).to.be.false;
        });

        it('should isSameLength', () => {
            expect(isSameLength([1, 2], [3, 4])).to.be.true;
            expect(isSameLength(new Set([1, 2]), new Set([3, 4]))).to.be.true;

            expect(isSameLength([1], [2, 3])).to.be.false;
            expect(isSameLength(new Set([1]), new Set([2, 3]))).to.be.false;
        });

        it('should isFunction', () => {
            expect(isFunction(() => {})).to.be.true;
            expect(isFunction(function() {})).to.be.true;
            expect(isFunction(class Test {})).to.be.true;

            expect(isFunction({})).to.be.false;
            expect(isFunction('string')).to.be.false;
            expect(isFunction(42)).to.be.false;
        });

        it('should isObject', () => {
            expect(isObject({})).to.be.true;
            expect(isObject([])).to.be.true;
            expect(isObject(new Date())).to.be.true;
            expect(isObject(() => {})).to.be.true;

            expect(isObject('string')).to.be.false;
            expect(isObject(42)).to.be.false;
            expect(isObject(null)).to.be.false;
        });

        it('should forInEvery', () => {
            const obj = { a: 1, b: 2, c: 3 };

            expect(forInEvery(obj, (val) => val > 0)).to.be.true;
            expect(forInEvery(obj, (val) => val < 3)).to.be.false;

            const arr = [1, 2, 3];
            expect(forInEvery(arr, (val) => typeof val === 'number')).to.be.true;
        });

        it('should forOfEvery', () => {
            const arr = [1, 2, 3];
            expect(forOfEvery(arr, (val) => typeof val === 'number')).to.be.true;
            expect(forOfEvery(arr, (val) => (val as number) < 3)).to.be.false;

            const set = new Set([1, 2, 3]);
            expect(forOfEvery(set, (val) => typeof val === 'number')).to.be.true;
        });

        it('should isFunctionOrObject', () => {
            expect(isFunctionOrObject({})).to.be.true;
            expect(isFunctionOrObject([])).to.be.true;
            expect(isFunctionOrObject(() => {})).to.be.true;
            expect(isFunctionOrObject(new Date())).to.be.true;

            // Test with non-function/object values by casting
            expect(isFunctionOrObject('string' as any)).to.be.false;
            expect(isFunctionOrObject(42 as any)).to.be.false;
            expect(isFunctionOrObject(null as any)).to.be.false;
        });

        it('should isUndefined', () => {
            expect(isUndefined(undefined)).to.be.true;

            expect(isUndefined(null)).to.be.false;
            expect(isUndefined('')).to.be.false;
            expect(isUndefined(0)).to.be.false;
            expect(isUndefined(false)).to.be.false;
        });

        it('should isOptional', () => {
            expect(isOptional(undefined, true)).to.be.true;
            expect(isOptional(null, true)).to.be.true;
            expect(isOptional('value', true)).to.be.true;
            expect(isOptional('value', false)).to.be.false;

            expect(isOptional('test', (val) => val === 'test')).to.be.true;
            expect(isOptional('test', (val) => val === 'other')).to.be.false;
        });

        it('should work with Deferred', async () => {
            const deferred = new Deferred<string>();

            setTimeout(() => deferred.resolve('resolved'), 10);

            const result = await deferred.promise;
            expect(result).to.equal('resolved');
        });

        it('should work with Deferred rejection', async () => {
            const deferred = new Deferred<string>();

            setTimeout(() => deferred.reject(new Error('rejected')), 10);

            try {
                await deferred.promise;
                expect.fail('Should have thrown');
            } catch (error) {
                expect((error as Error).message).to.equal('rejected');
            }
        });

        it('should wait', async () => {
            const start = Date.now();
            await wait(50);
            const elapsed = Date.now() - start;

            expect(elapsed).to.be.at.least(45); // Allow some tolerance
        });

        it('should chunk arrays', () => {
            expect(chunk([1, 2, 3, 4, 5], 2)).to.deep.equal([[1, 2], [3, 4], [5]]);
            expect(chunk([1, 2, 3, 4], 2)).to.deep.equal([[1, 2], [3, 4]]);
            expect(chunk([1, 2, 3], 5)).to.deep.equal([[1, 2, 3]]);
            expect(chunk([], 2)).to.deep.equal([]);
        });

    });
});
