import {
    describe,
    it,
    expect
} from 'vitest'


import { serializer } from '../../../../packages/utils/src/misc/index.ts';

describe('@logosdx/utils: serializer', () => {

    it('should handle primitives correctly', () => {

        expect(serializer([null])).to.equal('null');
        expect(serializer([undefined])).to.equal('undefined');
        expect(serializer([true])).to.equal('true');
        expect(serializer([false])).to.equal('false');
        expect(serializer([42])).to.equal('42');
        expect(serializer([0])).to.equal('0');
        expect(serializer([-0])).to.equal('-0');
        expect(serializer(['hello'])).to.equal('hello');
    });

    it('should handle BigInt correctly', () => {

        expect(serializer([BigInt(123)])).to.equal('bi:123');
        expect(serializer([BigInt(0)])).to.equal('bi:0');
        expect(serializer([BigInt(-456)])).to.equal('bi:-456');
    });

    it('should handle Symbols with unique IDs', () => {

        const sym1 = Symbol('test');
        const sym2 = Symbol('test');

        // Each symbol gets a unique ID
        const key1 = serializer([sym1]);
        const key2 = serializer([sym2]);

        expect(key1).to.match(/^sym:_[a-z0-9]+$/);
        expect(key2).to.match(/^sym:_[a-z0-9]+$/);

        // Different symbols produce different keys
        expect(key1).to.not.equal(key2);

        // Same symbol produces same key
        expect(serializer([sym1])).to.equal(key1);
    });

    it('should handle Functions with unique IDs', () => {

        const fn1 = () => 'api/v1';
        const fn2 = () => 'api/v2';
        const named = function myFunc() { return 'test'; };

        // Each function gets a unique ID
        const key1 = serializer([fn1]);
        const key2 = serializer([fn2]);
        const key3 = serializer([named]);

        expect(key1).to.match(/^fn:_[a-z0-9]+$/);
        expect(key2).to.match(/^fn:_[a-z0-9]+$/);
        expect(key3).to.match(/^fn:_[a-z0-9]+$/);

        // Different functions produce different keys
        expect(key1).to.not.equal(key2);
        expect(key2).to.not.equal(key3);

        // Same function produces same key
        expect(serializer([fn1])).to.equal(key1);
    });

    it('should handle Date objects', () => {

        const date1 = new Date(1000);
        const date2 = new Date(1000);
        const date3 = new Date(2000);

        expect(serializer([date1])).to.equal('d:1000');
        expect(serializer([date2])).to.equal('d:1000');
        expect(serializer([date3])).to.equal('d:2000');

        // Same timestamp should produce same key
        expect(serializer([date1])).to.equal(serializer([date2]));
    });

    it('should handle RegExp objects', () => {

        const regex1 = /test/gi;
        const regex2 = /test/gi;
        const regex3 = /other/i;

        expect(serializer([regex1])).to.equal('r:/test/gi');
        expect(serializer([regex2])).to.equal('r:/test/gi');
        expect(serializer([regex3])).to.equal('r:/other/i');

        // Same pattern should produce same key
        expect(serializer([regex1])).to.equal(serializer([regex2]));
    });

    it('should handle Error objects with unique IDs', () => {

        const err1 = new Error('test error');
        const err2 = new TypeError('type error');
        const err3 = new RangeError('range error');

        // Each error gets a unique ID
        const key1 = serializer([err1]);
        const key2 = serializer([err2]);
        const key3 = serializer([err3]);

        expect(key1).to.match(/^e:_[a-z0-9]+$/);
        expect(key2).to.match(/^e:_[a-z0-9]+$/);
        expect(key3).to.match(/^e:_[a-z0-9]+$/);

        // Different errors produce different keys
        const err4 = new Error('test error');
        expect(serializer([err1])).to.not.equal(serializer([err4]));

        // Same error produces same key
        expect(serializer([err1])).to.equal(key1);
    });

    it('should handle WeakMap and WeakSet with unique IDs', () => {

        const wm1 = new WeakMap();
        const wm2 = new WeakMap();
        const ws1 = new WeakSet();
        const ws2 = new WeakSet();

        // Each WeakMap/WeakSet gets a unique ID
        const wmKey1 = serializer([wm1]);
        const wmKey2 = serializer([wm2]);
        const wsKey1 = serializer([ws1]);
        const wsKey2 = serializer([ws2]);

        expect(wmKey1).to.match(/^wm:_[a-z0-9]+$/);
        expect(wmKey2).to.match(/^wm:_[a-z0-9]+$/);
        expect(wsKey1).to.match(/^ws:_[a-z0-9]+$/);
        expect(wsKey2).to.match(/^ws:_[a-z0-9]+$/);

        // Different instances produce different keys
        expect(wmKey1).to.not.equal(wmKey2);
        expect(wsKey1).to.not.equal(wsKey2);

        // WeakMap and WeakSet no longer collide
        expect(wmKey1).to.not.equal(wsKey1);

        // Same instance produces same key
        expect(serializer([wm1])).to.equal(wmKey1);
    });

    it('should handle arrays correctly', () => {

        expect(serializer([[1, 2, 3]])).to.equal('[1,2,3]');
        expect(serializer([[]])).to.equal('[]');
        expect(serializer([['a', 'b']])).to.equal('[a,b]');
        expect(serializer([[null, undefined]])).to.equal('[null,undefined]');
    });

    it('should handle objects with consistent key ordering', () => {

        const obj1 = { a: 1, b: 2, c: 3 };
        const obj2 = { c: 3, b: 2, a: 1 };
        const obj3 = { b: 2, a: 1, c: 3 };

        const key1 = serializer([obj1]);
        const key2 = serializer([obj2]);
        const key3 = serializer([obj3]);

        // All should produce same key due to sorted keys
        expect(key1).to.equal('{"a":1,"b":2,"c":3}');
        expect(key1).to.equal(key2);
        expect(key2).to.equal(key3);
    });

    it('should handle nested objects', () => {

        const nested = {
            a: 1,
            b: {
                c: 2,
                d: {
                    e: 3
                }
            }
        };

        expect(serializer([nested])).to.equal('{"a":1,"b":{"c":2,"d":{"e":3}}}');
    });

    it('should handle circular references', () => {

        const circular: any = { a: 1 };
        circular.self = circular;

        const result = serializer([circular]);

        // Should contain circ: prefix with unique ID
        expect(result).to.match(/circ:_[a-z0-9]+/);
        expect(result).to.include('"a":1');
    });

    it('should handle Map objects', () => {

        const map1 = new Map([['a', 1], ['b', 2]]);
        const map2 = new Map([['b', 2], ['a', 1]]);

        const key1 = serializer([map1]);
        const key2 = serializer([map2]);

        // Maps with same entries (different order) should produce same key
        expect(key1).to.include('map:');
        expect(key1).to.equal(key2);
    });

    it('should handle Set objects', () => {

        const set1 = new Set([1, 2, 3]);
        const set2 = new Set([3, 2, 1]);

        const key1 = serializer([set1]);
        const key2 = serializer([set2]);

        // Sets with same values (different order) should produce same key
        expect(key1).to.include('set:');
        expect(key1).to.equal(key2);
    });

    it('should handle multiple arguments', () => {

        const result = serializer([1, 'hello', true, null]);

        expect(result).to.equal('1|hello|true|null');
    });

    it('should handle no arguments', () => {

        const result = serializer([]);

        expect(result).to.equal('0');
    });

    it('should handle complex mixed types', () => {

        const complex = [
            42,
            'test',
            true,
            null,
            undefined,
            [1, 2, 3],
            { a: 1, b: 2 },
            new Date(1000),
            /test/i,
            new Map([['key', 'value']]),
            new Set([1, 2, 3])
        ];

        const result = serializer(complex);

        expect(result).to.include('42');
        expect(result).to.include('|test|');
        expect(result).to.include('true');
        expect(result).to.include('null');
        expect(result).to.include('undefined');
        expect(result).to.include('[1,2,3]');
        expect(result).to.include('{"a":1,"b":2}');
        expect(result).to.include('d:1000');
        expect(result).to.include('r:/test/i');
        expect(result).to.include('map:');
        expect(result).to.include('set:');
    });

    it('should distinguish -0 from 0', () => {

        const zero = serializer([0]);
        const negativeZero = serializer([-0]);

        expect(zero).to.equal('0');
        expect(negativeZero).to.equal('-0');
        expect(zero).to.not.equal(negativeZero);
    });

    it('should handle NaN and Infinity', () => {

        expect(serializer([NaN])).to.equal('NaN');
        expect(serializer([Infinity])).to.equal('Infinity');
        expect(serializer([-Infinity])).to.equal('-Infinity');
    });

    it('should clean up WeakSet consistently for all object types', () => {

        // This test verifies that WeakSet cleanup is consistent
        // It's more of a structural test than a behavioral test
        const arr = [1, 2, 3];
        const obj = { a: 1 };
        const map = new Map([['a', 1]]);
        const set = new Set([1, 2, 3]);

        // All should serialize without errors (WeakSet should be cleaned up)
        expect(() => serializer([arr])).to.not.throw();
        expect(() => serializer([obj])).to.not.throw();
        expect(() => serializer([map])).to.not.throw();
        expect(() => serializer([set])).to.not.throw();
    });

    it('should handle objects with same structure but different values', () => {

        const obj1 = { a: 1, b: 2 };
        const obj2 = { a: 1, b: 3 };

        const key1 = serializer([obj1]);
        const key2 = serializer([obj2]);

        expect(key1).to.not.equal(key2);
        expect(key1).to.equal('{"a":1,"b":2}');
        expect(key2).to.equal('{"a":1,"b":3}');
    });
});
