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
    castValuesToTypes,
    makeNestedConfig,
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

    describe('misc: castValuesToTypes', () => {

        it('should convert string booleans to actual booleans', () => {

            const config: any = {
                debug: 'true',
                enabled: 'yes',
                disabled: 'false',
                hidden: 'no',
            };

            castValuesToTypes(config);

            expect(config.debug).to.equal(true);
            expect(config.enabled).to.equal(true);
            expect(config.disabled).to.equal(false);
            expect(config.hidden).to.equal(false);
        });

        it('should convert numeric strings to numbers', () => {

            const config: any = {
                port: '3000',
                timeout: '5000',
                retries: '3',
            };

            castValuesToTypes(config);

            expect(config.port).to.equal(3000);
            expect(config.timeout).to.equal(5000);
            expect(config.retries).to.equal(3);
        });

        it('should handle nested objects recursively', () => {

            const config: any = {
                server: {
                    port: '8080',
                    debug: 'true',
                },
                database: {
                    pool: {
                        min: '2',
                        max: '10',
                    },
                },
            };

            castValuesToTypes(config);

            expect(config.server.port).to.equal(8080);
            expect(config.server.debug).to.equal(true);
            expect(config.database.pool.min).to.equal(2);
            expect(config.database.pool.max).to.equal(10);
        });

        it('should leave non-convertible strings as-is', () => {

            const config: any = {
                name: 'myapp',
                description: 'A great app',
                version: '1.2.3',
            };

            castValuesToTypes(config);

            expect(config.name).to.equal('myapp');
            expect(config.description).to.equal('A great app');
            expect(config.version).to.equal('1.2.3');
        });

        it('should handle mixed value types', () => {

            const config: any = {
                debug: 'true',
                port: '3000',
                name: 'app',
                timeout: '5000',
                enabled: 'yes',
            };

            castValuesToTypes(config);

            expect(config.debug).to.equal(true);
            expect(config.port).to.equal(3000);
            expect(config.name).to.equal('app');
            expect(config.timeout).to.equal(5000);
            expect(config.enabled).to.equal(true);
        });

        it('should not throw on non-string values', () => {

            const config: any = {
                alreadyNumber: 123,
                alreadyBoolean: true,
                stringNumber: '456',
            };

            castValuesToTypes(config);

            expect(config.alreadyNumber).to.equal(123);
            expect(config.alreadyBoolean).to.equal(true);
            expect(config.stringNumber).to.equal(456);
        });

        it('should handle empty objects', () => {

            const config: any = {};

            castValuesToTypes(config);

            expect(config).to.deep.equal({});
        });

        it('should handle zero as string', () => {

            const config: any = { count: '0' };

            castValuesToTypes(config);

            expect(config.count).to.equal(0);
        });

        it('should parse time duration units when parseUnits is true', () => {

            const config: any = {
                timeout: '5m',
                cacheExpiry: '1hour',
                sessionDuration: '30sec',
            };

            castValuesToTypes(config, { parseUnits: true });

            expect(config.timeout).to.equal(300000);  // 5 minutes
            expect(config.cacheExpiry).to.equal(3600000);  // 1 hour
            expect(config.sessionDuration).to.equal(30000);  // 30 seconds
        });

        it('should parse byte size units when parseUnits is true', () => {

            const config: any = {
                maxUploadSize: '10mb',
                diskQuota: '100gb',
                bufferSize: '64kb',
            };

            castValuesToTypes(config, { parseUnits: true });

            expect(config.maxUploadSize).to.equal(10485760);  // 10 megabytes
            expect(config.diskQuota).to.equal(107374182400);  // 100 gigabytes
            expect(config.bufferSize).to.equal(65536);  // 64 kilobytes
        });

        it('should not parse units when parseUnits is false', () => {

            const config: any = {
                timeout: '5m',
                maxUploadSize: '10mb',
            };

            castValuesToTypes(config, { parseUnits: false });

            expect(config.timeout).to.equal('5m');  // Stays as string
            expect(config.maxUploadSize).to.equal('10mb');  // Stays as string
        });

        it('should skip conversion for specified keys', () => {

            const config: any = {
                apiKey: '12345',
                secretToken: '67890',
                port: '3000',
                debug: 'true',
            };

            castValuesToTypes(config, {
                skipConversion: (key) => key.toLowerCase().includes('key') || key.toLowerCase().includes('token')
            });

            expect(config.apiKey).to.equal('12345');  // Skipped
            expect(config.secretToken).to.equal('67890');  // Skipped
            expect(config.port).to.equal(3000);  // Converted
            expect(config.debug).to.equal(true);  // Converted
        });

        it('should skip conversion recursively in nested objects', () => {

            const config: any = {
                auth: {
                    apiKey: '12345',
                    timeout: '5000',
                },
                server: {
                    port: '3000',
                },
            };

            castValuesToTypes(config, {
                skipConversion: (key) => key === 'apiKey'
            });

            expect(config.auth.apiKey).to.equal('12345');  // Skipped
            expect(config.auth.timeout).to.equal(5000);  // Converted
            expect(config.server.port).to.equal(3000);  // Converted
        });

        it('should combine parseUnits and skipConversion', () => {

            const config: any = {
                timeout: '5m',
                apiKey: '12345',
                maxUploadSize: '10mb',
                port: '3000',
            };

            castValuesToTypes(config, {
                parseUnits: true,
                skipConversion: (key) => key.toLowerCase().includes('key')
            });

            expect(config.timeout).to.equal(300000);  // Parsed unit
            expect(config.apiKey).to.equal('12345');  // Skipped
            expect(config.maxUploadSize).to.equal(10485760);  // Parsed unit
            expect(config.port).to.equal(3000);  // Converted number
        });
    });

    describe('misc: makeNestedConfig', () => {

        it('should convert flat config to nested object', () => {

            const flatConfig = {
                APP_DB_HOST: 'localhost',
                APP_DB_PORT: '5432',
                APP_DEBUG: 'true',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            const result: any = config();

            expect(result.db.host).to.equal('localhost');
            expect(result.db.port).to.equal(5432);
            expect(result.debug).to.equal(true);
        });

        it('should handle mixed casing with forceAllCapToLower', () => {

            const flatConfig = {
                APP_DB_HOST: 'localhost',
                APP_WORKER_maxRetries: '5',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
                forceAllCapToLower: true,
            });

            const result: any = config();

            expect(result.db.host).to.equal('localhost');
            expect(result.worker.maxRetries).to.equal(5);
        });

        it('should preserve casing when forceAllCapToLower is false', () => {

            const flatConfig = {
                APP_DB_HOST: 'localhost',
                APP_DEBUG: 'true',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
                forceAllCapToLower: false,
            });

            const result: any = config();

            expect(result.DB.HOST).to.equal('localhost');
            expect(result.DEBUG).to.equal(true);
        });

        it('should handle custom separator', () => {

            const flatConfig = {
                APP_DB__HOST: 'localhost',
                APP_DB__PORT: '5432',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
                separator: '__',
            });

            const result: any = config();

            expect(result.db.host).to.equal('localhost');
            expect(result.db.port).to.equal(5432);
        });

        it('should handle numeric prefix stripping', () => {

            const flatConfig = {
                APP_DB_HOST: 'localhost',
                APP_DB_PORT: '5432',
            };

            const config = makeNestedConfig(flatConfig, {
                stripPrefix: 4, // Strip first 4 characters ("APP_")
            });

            const result: any = config();

            expect(result.db.host).to.equal('localhost');
            expect(result.db.port).to.equal(5432);
        });

        it('should work without stripPrefix', () => {

            const flatConfig = {
                DB_HOST: 'localhost',
                DB_PORT: '5432',
            };

            const config = makeNestedConfig(flatConfig, {});

            const result: any = config();

            expect(result.db.host).to.equal('localhost');
            expect(result.db.port).to.equal(5432);
        });

        it('should filter keys correctly', () => {

            const flatConfig = {
                APP_DB_HOST: 'localhost',
                OTHER_VALUE: 'ignored',
                APP_DEBUG: 'true',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            const result: any = config();

            expect(result.db.host).to.equal('localhost');
            expect(result.debug).to.equal(true);
            expect(result.other).to.be.undefined;
        });

        it('should handle deeply nested paths', () => {

            const flatConfig = {
                APP_SERVER_API_V1_ENDPOINT: '/api/v1',
                APP_SERVER_API_V1_TIMEOUT: '5000',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            const result: any = config();

            expect(result.server.api.v1.endpoint).to.equal('/api/v1');
            expect(result.server.api.v1.timeout).to.equal(5000);
        });

        it('should throw when trying to set property on primitive value', () => {

            const flatConfig = {
                APP_DB: 'somestring',
                APP_DB_HOST: 'localhost', // Trying to nest under APP_DB which is already a string
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            expect(() => config()).to.throw('on primitive value');
        });

        it('should sort keys before processing', () => {

            // Keys are sorted, so APP_DB_HOST should be processed before APP_DB_HOST_TEST
            const flatConfig = {
                APP_Z_VAL: 'z',
                APP_A_VAL: 'a',
                APP_M_VAL: 'm',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            const result: any = config();

            expect(result.a.val).to.equal('a');
            expect(result.m.val).to.equal('m');
            expect(result.z.val).to.equal('z');
        });

        it('should handle empty flat config', () => {

            const flatConfig = {};

            const config = makeNestedConfig(flatConfig, {});

            const result = config();

            expect(result).to.deep.equal({});
        });

        it('should handle string prefix that does not match', () => {

            const flatConfig = {
                MY_APP_DB_HOST: 'localhost',
            };

            const config = makeNestedConfig(flatConfig, {
                stripPrefix: 'APP_', // Prefix doesn't match, so it won't be stripped
            });

            const result: any = config();

            // The key won't be stripped, so it will be processed as-is
            expect(result.my.app.db.host).to.equal('localhost');
        });

        it('should parse time duration units when parseUnits is true', () => {

            const flatConfig = {
                APP_SESSION_TIMEOUT: '15m',
                APP_CACHE_TTL: '1hour',
                APP_HEARTBEAT: '30sec',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
                parseUnits: true,
            });

            const result: any = config();

            expect(result.session.timeout).to.equal(900000);  // 15 minutes
            expect(result.cache.ttl).to.equal(3600000);  // 1 hour
            expect(result.heartbeat).to.equal(30000);  // 30 seconds
        });

        it('should parse byte size units when parseUnits is true', () => {

            const flatConfig = {
                APP_MAX_UPLOAD_SIZE: '10mb',
                APP_DISK_QUOTA: '100gb',
                APP_BUFFER_SIZE: '64kb',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
                parseUnits: true,
            });

            const result: any = config();

            expect(result.max.upload.size).to.equal(10485760);  // 10 megabytes
            expect(result.disk.quota).to.equal(107374182400);  // 100 gigabytes
            expect(result.buffer.size).to.equal(65536);  // 64 kilobytes
        });

        it('should not parse units when parseUnits is false', () => {

            const flatConfig = {
                APP_TIMEOUT: '5m',
                APP_MAX_SIZE: '10mb',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
                parseUnits: false,
            });

            const result: any = config();

            expect(result.timeout).to.equal('5m');  // Stays as string
            expect(result.max.size).to.equal('10mb');  // Stays as string
        });

        it('should skip conversion for specified keys', () => {

            const flatConfig = {
                APP_API_KEY: '12345',
                APP_SECRET_TOKEN: '67890',
                APP_PORT: '3000',
                APP_DEBUG: 'true',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
                skipConversion: (key) => key.toLowerCase().includes('key') || key.toLowerCase().includes('token'),
            });

            const result: any = config();

            expect(result.api.key).to.equal('12345');  // Skipped
            expect(result.secret.token).to.equal('67890');  // Skipped
            expect(result.port).to.equal(3000);  // Converted
            expect(result.debug).to.equal(true);  // Converted
        });

        it('should combine parseUnits and skipConversion', () => {

            const flatConfig = {
                APP_TIMEOUT: '5m',
                APP_API_KEY: '12345',
                APP_MAX_SIZE: '10mb',
                APP_PORT: '3000',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
                parseUnits: true,
                skipConversion: (key) => key.toLowerCase().includes('key'),
            });

            const result: any = config();

            expect(result.timeout).to.equal(300000);  // Parsed unit (5 minutes)
            expect(result.api.key).to.equal('12345');  // Skipped
            expect(result.max.size).to.equal(10485760);  // Parsed unit (10 megabytes)
            expect(result.port).to.equal(3000);  // Converted number
        });

        it('should reach into config with path parameter', () => {

            type ExpectedConfig = {
                db: {
                    host: string;
                    port: number;
                };
                debug: boolean;
            }

            const flatConfig = {
                APP_DB_HOST: 'localhost',
                APP_DB_PORT: '5432',
                APP_DEBUG: 'true',
            };

            const config = makeNestedConfig<ExpectedConfig>(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            const dbHost = config('db.host');
            const dbPort = config('db.port');
            const debug = config('debug');

            expect(dbHost).to.equal('localhost');
            expect(dbPort).to.equal(5432);
            expect(debug).to.equal(true);
        });

        it('should reach into deeply nested config paths', () => {

            type ExpectedConfig = {
                server: {
                    api: {
                        v1: {
                            endpoint: string;
                            timeout: number;
                        };
                    };
                };
                worker: {
                    emails: {
                        max: {
                            runs: number;
                        };
                    };
                };
            };

            const flatConfig = {
                APP_SERVER_API_V1_ENDPOINT: '/api/v1',
                APP_SERVER_API_V1_TIMEOUT: '5000',
                APP_WORKER_EMAILS_MAX_RUNS: '100',
            };

            const config = makeNestedConfig<ExpectedConfig>(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            const endpoint = config('server.api.v1.endpoint');
            const timeout = config('server.api.v1.timeout');
            const maxRuns = config('worker.emails.max.runs');

            expect(endpoint).to.equal('/api/v1');
            expect(timeout).to.equal(5000);
            expect(maxRuns).to.equal(100);
        });

        it('should return undefined for non-existent paths', () => {

            type ExpectedConfig = {
                db: {
                    host: string;
                    port: number;
                };
                debug: boolean;
            }

            const flatConfig = {
                APP_DB_HOST: 'localhost',
            };

            const config = makeNestedConfig<ExpectedConfig>(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            // @ts-expect-error - Testing non-existent path
            const missing = config('does.not.exist');

            expect(missing).to.be.undefined;
        });

        it('should return default value when path does not exist', () => {

            type ExpectedConfig = {
                db: {
                    host: string;
                    port: number;
                };
                debug: boolean;
            }

            const flatConfig = {
                APP_DB_HOST: 'localhost',
            };

            const config = makeNestedConfig<ExpectedConfig>(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });


            // @ts-expect-error - Testing non-existent path with default
            const apiTimeout = config('api.timeout', 5000);
            // @ts-expect-error - Testing non-existent path with default
            const maxRetries = config('api.retries', 3);
            // @ts-expect-error - Testing non-existent path with default
            const logLevel = config('logging.level', 'info');

            expect(apiTimeout).to.equal(5000);
            expect(maxRetries).to.equal(3);
            expect(logLevel).to.equal('info');
        });

        it('should return actual value when path exists, ignoring default', () => {

            type ExpectedConfig = {
                api: {
                    timeout: number;
                };
                debug: boolean;
            }

            const flatConfig = {
                APP_API_TIMEOUT: '10000',
                APP_DEBUG: 'false',
            };

            const config = makeNestedConfig<ExpectedConfig>(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            const timeout = config('api.timeout', 5000);
            const debug = config('debug', true);

            expect(timeout).to.equal(10000);  // Uses actual value, not default
            expect(debug).to.equal(false);    // Uses actual value, not default
        });

        it('should work with path parameter and parseUnits', () => {

            type ExpectedConfig = {
                session: {
                    timeout: number;
                };
                max: {
                    upload: {
                        size: number;
                    };
                };
                cache: {
                    expiry: number;
                };
            }

            const flatConfig = {
                APP_SESSION_TIMEOUT: '15m',
                APP_MAX_UPLOAD_SIZE: '10mb',
            };

            const config = makeNestedConfig<ExpectedConfig>(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
                parseUnits: true,
            });

            const timeout = config('session.timeout');
            const maxSize = config('max.upload.size');
            const cacheExpiry = config('cache.expiry', 60000);  // Default

            expect(timeout).to.equal(900000);  // 15 minutes in ms
            expect(maxSize).to.equal(10485760);  // 10 MB in bytes
            expect(cacheExpiry).to.equal(60000);  // Default used
        });

        it('should get full config when no path provided', () => {

            const flatConfig = {
                APP_DB_HOST: 'localhost',
                APP_DB_PORT: '5432',
                APP_DEBUG: 'true',
            };

            const config = makeNestedConfig(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            const fullConfig: any = config();

            expect(fullConfig.db.host).to.equal('localhost');
            expect(fullConfig.db.port).to.equal(5432);
            expect(fullConfig.debug).to.equal(true);
        });

        it('should work with path parameter after getting full config', () => {

            type ExpectedConfig = {
                db: {
                    host: string;
                    port: number;
                };
                debug: boolean;
            }

            const flatConfig = {
                APP_DB_HOST: 'localhost',
                APP_DEBUG: 'true',
            };

            const config = makeNestedConfig<ExpectedConfig>(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
            });

            // Get full config first
            const fullConfig: any = config();
            expect(fullConfig.db.host).to.equal('localhost');

            // Then use path parameter
            const dbHost = config('db.host');
            const debug = config('debug');

            expect(dbHost).to.equal('localhost');
            expect(debug).to.equal(true);
        });

        it('should work with path parameter and skipConversion', () => {

            type ExpectedConfig = {
                api: {
                    key: string;
                };
                port: number;
            }

            const flatConfig = {
                APP_API_KEY: '12345',
                APP_PORT: '3000',
            };

            const config = makeNestedConfig<ExpectedConfig>(flatConfig, {
                filter: (key) => key.startsWith('APP_'),
                stripPrefix: 'APP_',
                skipConversion: (key) => key.toLowerCase().includes('key'),
            });

            const apiKey = config('api.key');
            const port = config('port');

            expect(apiKey).to.equal('12345');  // Skipped conversion, stays as string
            expect(port).to.equal(3000);  // Converted to number
        });
    });
});
