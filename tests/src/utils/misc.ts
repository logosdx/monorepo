import {
    describe,
    it,
} from 'node:test'

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import {
    reach,
    definePublicProps,
    definePrivateProps,
    definePrivateGetters,
    itemsToArray,
    oneOrMany,
    Deferred,
    wait,
    chunk,
    nTimes,
} from '../../../packages/utils/src/index.ts';

describe('@logosdx/utils', () => {

    describe('misc', () => {

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
            ]),
            y: new Set([1, 2, 3])
        };

        it('should reach for properties on object', () => {

            expect(reach(sample, 'a')).to.equal(1);
            expect(reach(sample, 'b')).to.equal('two');
            expect(reach(sample, 'c')).to.deep.equal([1, 2, 3]);
            expect(reach(sample, 'd.G.h')).to.equal('h');
            expect(reach(sample, 'x.one.three.four')).to.equal(1);
            expect(reach(sample, 'y')).to.deep.equal(new Set([1, 2, 3]));
            expect(reach(sample, 'y.0')).to.equal(1);
            expect(reach(sample, 'y.1')).to.equal(2);
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

        it('should nTimes with function that takes iteration index', () => {

            const result = nTimes((i) => (i + 1) * 2, 3);

            expect(result).to.deep.equal([2, 4, 6]);
        });

        it('should nTimes with function that ignores iteration index', () => {

            const result = nTimes(() => Math.random(), 3);

            expect(result).to.have.length(3);
            expect(result.every(x => typeof x === 'number')).to.be.true;
        });

        it('should nTimes with zero iterations', () => {

            const result = nTimes(() => 'test', 0);

            expect(result).to.deep.equal([]);
        });

        it('should nTimes with single iteration', () => {

            const result = nTimes(() => 'single', 1);

            expect(result).to.deep.equal(['single']);
        });

        it('should nTimes with large number of iterations', () => {

            const result = nTimes((i) => i, 1000);

            expect(result).to.have.length(1000);
            expect(result[0]).to.equal(0);
            expect(result[999]).to.equal(999);
        });

        it('should nTimes with complex objects', () => {

            const result = nTimes((i) => ({ id: i, name: `item-${i}` }), 3);

            expect(result).to.deep.equal([
                { id: 0, name: 'item-0' },
                { id: 1, name: 'item-1' },
                { id: 2, name: 'item-2' }
            ]);
        });

        it('should nTimes with arrays', () => {

            const result = nTimes((i) => [i, i * 2], 3);

            expect(result).to.deep.equal([
                [0, 0],
                [1, 2],
                [2, 4]
            ]);
        });

        it('should validate nTimes parameters', () => {

            expect(() => nTimes('not a function' as any, 3)).to.throw('fn must be a function');
            expect(() => nTimes(() => 'ok', 'not a number' as any)).to.throw('n must be a number');
        });

        it('should nTimes with negative number (should still work)', () => {

            const result = nTimes(() => 'test', -2);

            expect(result).to.deep.equal([]);
        });

        it('should nTimes with decimal number (should floor)', () => {

            const result = nTimes((i) => i, 2.7);

            expect(result).to.deep.equal([0, 1]);
        });

    });
});
