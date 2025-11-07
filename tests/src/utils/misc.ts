import {
    describe,
    it,
} from 'node:test'

import { expect } from 'chai';

import {
    reach,
    setDeep,
    setDeepMany,
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

        it('should setDeep on existing nested property', () => {

            const obj = { a: { b: { c: 'old' } } };

            setDeep(obj, 'a.b.c', 'new');

            expect(obj.a.b.c).to.equal('new');
        });

        it('should setDeep creating intermediate objects', () => {

            const obj: any = {};

            setDeep(obj, 'a.b.c', 'value');

            expect(obj.a.b.c).to.equal('value');
            expect(obj.a.b).to.be.an('object');
            expect(obj.a).to.be.an('object');
        });

        it('should setDeep on top-level property', () => {

            const obj: any = {};

            setDeep(obj, 'prop', 42);

            expect(obj.prop).to.equal(42);
        });

        it('should setDeep multiple paths on same object', () => {

            const config: any = {};

            setDeep(config, 'server.port', 3000);
            setDeep(config, 'server.host', 'localhost');
            setDeep(config, 'database.connection.timeout', 5000);

            expect(config.server.port).to.equal(3000);
            expect(config.server.host).to.equal('localhost');
            expect(config.database.connection.timeout).to.equal(5000);
        });

        it('should setDeep with various value types', () => {

            const obj: any = {};

            setDeep(obj, 'string', 'value');
            setDeep(obj, 'number', 42);
            setDeep(obj, 'boolean', true);
            setDeep(obj, 'null', null);
            setDeep(obj, 'array', [1, 2, 3]);
            setDeep(obj, 'object', { nested: 'value' });

            expect(obj.string).to.equal('value');
            expect(obj.number).to.equal(42);
            expect(obj.boolean).to.equal(true);
            expect(obj.null).to.equal(null);
            expect(obj.array).to.deep.equal([1, 2, 3]);
            expect(obj.object).to.deep.equal({ nested: 'value' });
        });

        it('should setDeep overwrite existing values', () => {

            const obj = { a: { b: 'old', c: 'keep' } };

            setDeep(obj, 'a.b', 'new');

            expect(obj.a.b).to.equal('new');
            expect(obj.a.c).to.equal('keep');
        });

        it('should setDeep with numeric-like string keys', () => {

            const obj: any = {};

            setDeep(obj, 'items.0', 'first');
            setDeep(obj, 'items.1', 'second');

            expect(obj.items['0']).to.equal('first');
            expect(obj.items['1']).to.equal('second');
        });

        it('should setDeep throw on null object', () => {

            expect(() => setDeep(null as any, 'a.b', 'value')).to.throw('obj must be a non-null object');
        });

        it('should setDeep throw on undefined object', () => {

            expect(() => setDeep(undefined as any, 'a.b', 'value')).to.throw('obj must be a non-null object');
        });

        it('should setDeep throw on non-object', () => {

            expect(() => setDeep('string' as any, 'a.b', 'value')).to.throw('obj must be a non-null object');
            expect(() => setDeep(42 as any, 'a.b', 'value')).to.throw('obj must be a non-null object');
            expect(() => setDeep(true as any, 'a.b', 'value')).to.throw('obj must be a non-null object');
        });

        it('should setDeep throw on empty path', () => {

            const obj = {};

            expect(() => setDeep(obj as any, '', 'value')).to.throw('path must be a non-empty string');
        });

        it('should setDeep throw on non-string path', () => {

            const obj = {};

            expect(() => setDeep(obj as any, null as any, 'value')).to.throw('path must be a non-empty string');
            expect(() => setDeep(obj as any, undefined as any, 'value')).to.throw('path must be a non-empty string');
            expect(() => setDeep(obj as any, 42 as any, 'value')).to.throw('path must be a non-empty string');
        });

        it('should setDeep throw when intermediate path is null', () => {

            const obj: any = { a: null };

            expect(() => setDeep(obj, 'a.b.c', 'value')).to.throw(/Cannot set property 'b' on null/);
        });

        it('should setDeep throw when intermediate path is undefined', () => {

            const obj: any = { a: { b: undefined } };

            expect(() => setDeep(obj, 'a.b.c', 'value')).to.throw(/Cannot set property 'c' on undefined/);
        });

        it('should setDeep throw when intermediate path is primitive', () => {

            const obj: any = { a: 'string' };

            expect(() => setDeep(obj, 'a.b.c', 'value')).to.throw();
        });

        it('should setDeep throw on falsy primitive intermediate values', () => {

            const objWithZero: any = { a: 0 };
            const objWithFalse: any = { a: false };
            const objWithString: any = { a: '' };

            // Primitives cannot have properties set on them
            expect(() => setDeep(objWithZero, 'a.b', 'value')).to.throw();
            expect(() => setDeep(objWithFalse, 'a.b', 'value')).to.throw();
            expect(() => setDeep(objWithString, 'a.b', 'value')).to.throw();
        });

        it('should setDeep work with existing objects that have falsy properties', () => {

            const obj = { zero: 0, empty: '', falsy: false };

            setDeep(obj, 'zero', 100);
            setDeep(obj, 'empty', 'filled');
            setDeep(obj, 'falsy', true);

            expect(obj.zero).to.equal(100);
            expect(obj.empty).to.equal('filled');
            expect(obj.falsy).to.equal(true);
        });

        it('should setDeep create nested structure for deeply nested path', () => {

            const obj: any = {};

            setDeep(obj, 'a.b.c.d.e.f', 'deep');

            expect(obj.a.b.c.d.e.f).to.equal('deep');
        });

        it('should setDeep preserve existing sibling properties', () => {

            const obj = {
                keep1: 'value1',
                parent: {
                    keep2: 'value2',
                    modify: 'old'
                }
            };

            setDeep(obj, 'parent.modify', 'new');

            expect(obj.keep1).to.equal('value1');
            expect(obj.parent.keep2).to.equal('value2');
            expect(obj.parent.modify).to.equal('new');
        });

        it('should setDeep work with metrics use case', () => {

            const metrics: any = { memory: { heap: 100 } };

            setDeep(metrics, 'memory.rss', 1024);
            setDeep(metrics, 'cpu.user', 50);

            expect(metrics.memory.heap).to.equal(100);
            expect(metrics.memory.rss).to.equal(1024);
            expect(metrics.cpu.user).to.equal(50);
        });

        it('should setDeep work with config building use case', () => {

            const config: any = {};

            setDeep(config, 'server.port', 3000);
            setDeep(config, 'server.host', 'localhost');
            setDeep(config, 'database.url', 'postgres://localhost');
            setDeep(config, 'features.auth.enabled', true);

            expect(config.server.port).to.equal(3000);
            expect(config.server.host).to.equal('localhost');
            expect(config.database.url).to.equal('postgres://localhost');
            expect(config.features.auth.enabled).to.equal(true);
        });

        it('should setDeepMany with multiple paths', () => {

            const obj: any = {};

            setDeepMany(obj, [
                ['a.b.c', 'value1'],
                ['x.y.z', 'value2'],
                ['top', 'value3']
            ]);

            expect(obj.a.b.c).to.equal('value1');
            expect(obj.x.y.z).to.equal('value2');
            expect(obj.top).to.equal('value3');
        });

        it('should setDeepMany build response object', () => {

            const response: any = {};

            setDeepMany(response, [
                ['status.code', 200],
                ['status.message', 'OK'],
                ['data.results', [1, 2, 3]],
                ['data.total', 3]
            ]);

            expect(response.status.code).to.equal(200);
            expect(response.status.message).to.equal('OK');
            expect(response.data.results).to.deep.equal([1, 2, 3]);
            expect(response.data.total).to.equal(3);
        });

        it('should setDeepMany build complex config', () => {

            const config: any = {};

            setDeepMany(config, [
                ['server.port', 3000],
                ['server.host', 'localhost'],
                ['database.url', 'postgres://localhost'],
                ['database.pool.min', 2],
                ['database.pool.max', 10],
                ['features.auth.enabled', true],
                ['features.logging.level', 'info']
            ]);

            expect(config.server.port).to.equal(3000);
            expect(config.server.host).to.equal('localhost');
            expect(config.database.url).to.equal('postgres://localhost');
            expect(config.database.pool.min).to.equal(2);
            expect(config.database.pool.max).to.equal(10);
            expect(config.features.auth.enabled).to.equal(true);
            expect(config.features.logging.level).to.equal('info');
        });

        it('should setDeepMany with various value types', () => {

            const obj: any = {};

            setDeepMany(obj, [
                ['string', 'text'],
                ['number', 42],
                ['boolean', true],
                ['null', null],
                ['array', [1, 2]],
                ['object', { nested: true }]
            ]);

            expect(obj.string).to.equal('text');
            expect(obj.number).to.equal(42);
            expect(obj.boolean).to.equal(true);
            expect(obj.null).to.equal(null);
            expect(obj.array).to.deep.equal([1, 2]);
            expect(obj.object).to.deep.equal({ nested: true });
        });

        it('should setDeepMany with empty array', () => {

            const obj: any = { existing: 'value' };

            setDeepMany(obj, []);

            expect(obj.existing).to.equal('value');
        });

        it('should setDeepMany overwrite duplicate paths', () => {

            const obj: any = {};

            setDeepMany(obj, [
                ['a.b', 'first'],
                ['a.b', 'second'],
                ['a.b', 'third']
            ]);

            expect(obj.a.b).to.equal('third');
        });

        it('should setDeepMany preserve existing properties', () => {

            const obj: any = {
                keep: 'this',
                nested: {
                    keep: 'too'
                }
            };

            setDeepMany(obj, [
                ['nested.new', 'value'],
                ['another', 'property']
            ]);

            expect(obj.keep).to.equal('this');
            expect(obj.nested.keep).to.equal('too');
            expect(obj.nested.new).to.equal('value');
            expect(obj.another).to.equal('property');
        });

        it('should setDeepMany throw on null object', () => {

            expect(() => setDeepMany(null as any, [['a', 1]])).to.throw('obj must be a non-null object');
        });

        it('should setDeepMany throw on undefined object', () => {

            expect(() => setDeepMany(undefined as any, [['a', 1]])).to.throw('obj must be a non-null object');
        });

        it('should setDeepMany throw on non-array entries', () => {

            const obj = {};

            expect(() => setDeepMany(obj as any, 'not an array' as any)).to.throw('entries must be an array');
            expect(() => setDeepMany(obj as any, null as any)).to.throw('entries must be an array');
            expect(() => setDeepMany(obj as any, 42 as any)).to.throw('entries must be an array');
        });

        it('should setDeepMany throw on invalid entry format', () => {

            const obj: any = {};

            expect(() => setDeepMany(obj, ['not a tuple'] as any)).to.throw(/entry \d+ must be a \[path, value\] tuple/);
            expect(() => setDeepMany(obj, [['only path']] as any)).to.throw(/entry \d+ must be a \[path, value\] tuple/);
            expect(() => setDeepMany(obj, [['path', 'value', 'extra']] as any)).to.throw(/entry \d+ must be a \[path, value\] tuple/);
        });

        it('should setDeepMany throw on invalid path in entry', () => {

            const obj: any = {};

            expect(() => setDeepMany(obj, [['' as any, 'value']])).to.throw(/entry \d+ must have a non-empty string path/);
            expect(() => setDeepMany(obj, [[null as any, 'value']])).to.throw(/entry \d+ must have a non-empty string path/);
        });

        it('should setDeepMany throw on intermediate null', () => {

            const obj: any = { a: null };

            expect(() => setDeepMany(obj, [['a.b', 'value']])).to.throw(/Cannot set property 'b' on null/);
        });

        it('should setDeepMany throw on intermediate primitive', () => {

            const obj: any = { a: 'string' };

            expect(() => setDeepMany(obj, [['a.b', 'value']])).to.throw();
        });

        it('should setDeepMany stop on first error', () => {

            const obj: any = { a: null };

            expect(() => setDeepMany(obj, [
                ['valid.path', 'works'],
                ['a.b', 'fails here'],
                ['another.path', 'never reached']
            ])).to.throw();

            expect(obj.valid.path).to.equal('works');
            expect(obj.another).to.be.undefined;
        });

        it('should setDeepMany provide helpful error message from setDeep', () => {

            const obj: any = { a: null };

            try {
                setDeepMany(obj, [
                    ['valid.path', 'works'],
                    ['another.valid', 'also works'],
                    ['a.b', 'fails here'],
                    ['never.reached', 'skipped']
                ]);
                expect.fail('Should have thrown');
            } catch (error) {
                const message = (error as Error).message;
                // Error from setDeep includes path context
                expect(message).to.include('b');
                expect(message).to.include('null');
            }
        });

        it('should setDeepMany provide helpful error for invalid tuple format', () => {

            const obj: any = {};

            try {
                setDeepMany(obj, [
                    ['valid', 'works'],
                    ['invalid'] as any
                ]);
                expect.fail('Should have thrown');
            } catch (error) {
                const message = (error as Error).message;
                expect(message).to.include('entry 1');
                expect(message).to.include('tuple');
            }
        });

        it('should setDeepMany provide helpful error for empty path', () => {

            const obj: any = {};

            try {
                setDeepMany(obj, [
                    ['valid', 'works'],
                    ['', 'invalid path']
                ]);
                expect.fail('Should have thrown');
            } catch (error) {
                const message = (error as Error).message;
                expect(message).to.include('entry 1');
                expect(message).to.include('non-empty string');
            }
        });

        it('should setDeepMany provide helpful error for primitive intermediate', () => {

            const obj: any = { a: 42 };

            try {
                setDeepMany(obj, [
                    ['x.y', 'works'],
                    ['a.b.c', 'fails on primitive']
                ]);
                expect.fail('Should have thrown');
            } catch (error) {
                const message = (error as Error).message;
                // Error from setDeep includes path and primitive info
                expect(message).to.include('path: a');
                expect(message).to.include('primitive');
            }
        });

        it('should setDeepMany work with metrics use case', () => {

            const metrics: any = { memory: { heap: 100 } };

            setDeepMany(metrics, [
                ['memory.rss', 1024],
                ['memory.external', 512],
                ['cpu.user', 50],
                ['cpu.system', 30]
            ]);

            expect(metrics.memory.heap).to.equal(100);
            expect(metrics.memory.rss).to.equal(1024);
            expect(metrics.memory.external).to.equal(512);
            expect(metrics.cpu.user).to.equal(50);
            expect(metrics.cpu.system).to.equal(30);
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
