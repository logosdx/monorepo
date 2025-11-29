import {
    describe,
    it,
    beforeAll,
    after,
    afterEach,
    expect
} from 'vitest'


import * as fc from 'fast-check';

import {
    clone,
    equals,
    merge,
    addHandlerFor
} from '../../../packages/utils/src/data-structures/index.ts';

import { stubWarn } from '../_helpers.ts';

const stub = {
    obj: {
        a: true,
        b: false
    },
    arr: [1,2,3],
    map: new Map([[1,2], [3,4]]),
    set: new Set([1, 2, 3, 4]),

    sameSymbol: Symbol(),

    any: () => ({
        arr: [{x:1}, {y:2}],
        obj: { z: true },
        str: 'abc',
        num: 123,
        bool: true,
        map: new Map([[1, 'a']]),
        set: new Set(['a', 1])
    }),

    complex: (beer?: any) => ({
        isOpen: true,
        editingMode: false,
        editorOpts: {
            mode: "view",
            mainMenuBar: false
        },
        app: {
            authenticated: false,
            isMobile: false,
            loading: true
        },
        beep: [{
            bop: true,
            beer: [
                { german: [beer]}
            ]
        }]
    }),

    simple: () => ({

        str: 'abc',
        num: 123,
        bool: true,
        nil: null,
        undef: undefined
    }),

    a: {

        obj: {
            a: true,
            b: false
        },
        arr: [1,2,3],
        map: new Map([[1,2], [3,4]]),
        set: new Set([1, 2, 3, 4])
    },
    b: {

        obj: {
            b: true,
            c: false
        },
        arr: [4,5,6],
        map: new Map([[3,7], [4,5]]),
        set: new Set([4, 5, 6, 7])
    }
}

describe('@logosdx/utils', () => {

    describe('clone(...)', () => {

        beforeAll(() => {

            stubWarn.resetHistory();
        });

        afterAll(() => {

            expect(stubWarn.called);
        })

        it('should clone any kind of value', function () {

            const predicate = (a: any) => {
                clone(a);
            };

            fc.assert(
                fc.property(
                    fc.anything(),
                    predicate
                ),
                { numRuns: 10000,verbose: true }
            );

            fc.assert(
                fc.property(
                    fc.date(),
                    predicate
                )
            );
        });

        it('clones different data types', () => {

            const obj = clone(stub.obj);

            expect(obj).not.to.equal(stub.obj);
            expect(obj).to.deep.equal(stub.obj);

            const arr = clone(stub.arr);
            expect(arr).not.to.equal(stub.arr);
            expect(arr).to.deep.equal(stub.arr);

            const map = clone(stub.map);
            expect(map).not.to.equal(stub.map);
            expect(map).to.deep.equal(stub.map);

            const set = clone(stub.set);
            expect(set).not.to.equal(stub.set);
            expect(set).to.deep.equal(stub.set);
        });

        it('clones nested objects', () => {

            const clonedStub = clone(stub);
            expect(clonedStub).not.to.equal(stub);
            expect(clonedStub.obj).not.to.equal(stub.obj);
            expect(clonedStub.arr).not.to.equal(stub.arr);
            expect(clonedStub.map).not.to.equal(stub.map);
            expect(clonedStub.set).not.to.equal(stub.set);
        });

        it('clones errors', () => {

            const error = new Error('test');
            const clonedError = clone(error);
            expect(clonedError).not.to.equal(error);
            expect(clonedError.message).to.equal(error.message);
            expect(clonedError.stack).to.equal(error.stack);
        });

        it('clones dates', () => {

            const date = new Date();
            const clonedDate = clone(date);
            expect(clonedDate).not.to.equal(date);
            expect(clonedDate.getTime()).to.equal(date.getTime());
        });
    });

    describe('equals(...)', () => {

        describe('Args', function () {

            it('should accept any kind of value', function () {

                const predicate = (a: any, b: any) => {

                    equals(a,b)
                };

                fc.assert(
                    fc.property(
                        fc.anything(),
                        fc.anything(),
                        predicate
                    ),
                    { numRuns: 10000 }
                );

                fc.assert(
                    fc.property(
                        fc.anything(),
                        fc.date(),
                        predicate
                    )
                );

                equals(null, null);
                equals(undefined, undefined);
                equals(true, true);
                equals(new Date(), new Date());
                equals(new RegExp('test'), new RegExp('tets'));

                const iterables = [
                    Int8Array,
                    Uint8Array,
                    Uint8ClampedArray,
                    Int16Array,
                    Uint16Array,
                    Int32Array,
                    Uint32Array,
                    Float32Array,
                    Float64Array
                ];

                for (const ClassType of iterables) {

                    equals(
                        new ClassType([21, 32]),
                        new ClassType([22, 43]),
                    )
                }

                const others = [
                    [() => {}, function* () {}],
                    [() => {}, async () => {}],
                ];

                for (const [a, b] of others) {

                    equals(a, b);
                }

            })

            it('should have changes no matter the primitive', function () {

                const state1 = { x: 1 };

                [
                    'string',
                    true,
                    0,
                    null,
                    undefined,
                    Symbol('lol'),
                    new Map(),
                    new Set(),
                    [],
                    {},
                    new Date(),
                    new RegExp('lol')
                ].forEach(x => {

                    const isEqual = equals(state1, { x });
                    expect(isEqual).to.be.false;
                })
            });

            it('should not throw if there is no change and values are undefined or null', function () {

                const hasNull = { x: null };
                const hasUndefined = { x: undefined };

                expect(() => equals(hasNull, { ...hasNull })).to.not.throw();
                expect(() => equals(hasUndefined, { ...hasUndefined })).to.not.throw();
            });

            it('should not error on unequalsable types', () => {

                expect(() => equals(new Function, new WeakMap)).to.not.throw();
                expect(() => equals(new WeakSet, new Promise(() => {}))).to.not.throw();
            });
        });

        describe('Objects and Arrays', function () {

            it('should be false if number of object keys are different', function () {

                const state1 = { x: 1 };
                const state2 = { x: 1, y: 1 };

                const isEqual = equals(state1, state2);
                expect(isEqual).to.be.false;
            });

            it('should be false if missing a key', function () {

                const state1 = { x: 1, z: 1 };
                const state2 = { x: 1, y: 1 };

                const isEqual = equals(state1, state2);
                expect(isEqual).to.be.false;
            });

            it('should be false if value is primitive and changes', function () {

                const state1 = { x: 1, y: 1 };
                const state2 = { x: 1, y: 2 };

                const isEqual = equals(state1, state2);
                expect(isEqual).to.be.false;
            });


            it('should be false on complex structures', function () {

                const state1 = stub.complex('becks')
                const state2 = stub.complex('pauli girl');

                expect(
                    equals(state1, state2)
                ).to.be.false;

            });

            it('should be false on very deep nested', function () {

                const x = 'super';

                const state1 = { x: { x: { x: { x }}}}
                const state2 = { x: { x: { x: { x: `${x}s` }}}}

                const isEqual = equals(state1, state2);
                expect(isEqual).to.be.false;
            });

            it('should implement recursion', function () {

                const state1 = stub.any();
                const state2: { [k: string]: any } = stub.any();

                state2.obj = { y: true };

                const isEqual = equals(state1, state2);

                expect(isEqual).to.be.false;
            });

            it('should not equals mismatching arrays', () => {

                const notEquals = [
                    [ [1,2,3], [2,1,3] ],
                    [ [{ X: true }, 2, 3], [{ x: true }, 1, 3] ],
                    [ [{ x: false }, 2, 3], [{ x: true }, 1, 3] ],
                    [ [{x:1}, {y:2}], [{y:2}, {x:1}] ]
                ];

                for (const [a, b] of notEquals) {

                    expect(equals(a, b)).to.be.false;
                }
            });

            it('should equals matching arrays', () => {

                const n = [1,2,3];
                const b = [true, false];
                const u = [undefined, null];
                const c = [stub.any(), stub.any()];
                const isEquals = [
                    [[...n], [...n]],
                    [[...b], [...b]],
                    [[...u], [...u]],
                    [[...c], [...c]],
                ];

                for (const [a,b] of isEquals) {
                    expect(equals(a, b)).to.be.true;
                }
            });


            it('should equals empty array', () => {

                expect(equals(
                    { t: [1] },
                    { t: [] }
                )).to.be.false


                expect(equals(
                    { t: [] },
                    { t: [1] }
                )).to.be.false

                expect(equals(
                    [1],
                    []
                )).to.be.false

                expect(equals(
                    [],
                    [2]
                )).to.be.false

            });

        });

        describe('Maps and Sets', function () {

            it('should not equal mismatching maps', () => {

                const e1 = new Map(Object.entries(stub.any()));
                const e2 = new Map(Object.entries(stub.complex()));

                expect(equals(e1, e2)).to.be.false;
            });

            it('should equal matching maps', () => {

                const e1 = new Map(Object.entries(stub.complex()));
                const e2 = new Map(Object.entries(stub.complex()));

                expect(equals(e1, e2)).to.be.true;
            });

            it('should not equal mismatching sets', () => {

                const e1 = new Set(Object.values(stub.simple()));
                const e2 = new Set(Object.values(stub.simple()));
                const e3 = new Set(Object.values(stub.simple()));

                e2.add('x');
                e3.add('x');
                e3.delete(null);

                expect(equals(e1, e2)).to.be.false;
                expect(equals(e1, e3)).to.be.false;
                expect(equals(e2, e3)).to.be.false;
            });

            it('should not equals matching sets', () => {

                const e1 = new Set(Object.values(stub.simple()));
                const e2 = new Set(Object.values(stub.simple()));

                expect(equals(e1, e2)).to.be.true;
            });

        });

        describe('Miscellaneous Types', function () {

            it('should not equal mismatching regex', () => {

                const rgx = '^abc123{2,}[a-z]\\d+.+\\s(a|b)';
                const r1 = new RegExp(rgx, 'i');
                const r2 = new RegExp(rgx, 'im');
                const r3 = new RegExp(rgx + '$', 'im');

                expect(equals(r1, r2)).to.be.false;
                expect(equals(r1, r3)).to.be.false;
                expect(equals(r2, r3)).to.be.false;
            });

            it('should equal matching regex', () => {

                const rgx = '^abc123{2,}[a-z]\\d+.+\\s(a|b)';
                const r1 = new RegExp(rgx, 'i');
                const r2 = new RegExp(rgx, 'i');

                expect(equals(r1, r2)).to.be.true;
            });

            it('should not equal mismatching dates', () => {

                const d = new Date();
                const d1 = new Date(+d);
                const d2 = new Date(+d + 1);

                expect(equals(d1, d2)).to.be.false;
            });
            it('should equal matching dates', () => {

                const d = new Date();
                const d1 = new Date(+d);
                const d2 = new Date(+d);

                expect(equals(d1, d2)).to.be.true;
            });
        });
    });

    describe('merge(...)', () => {

        it('should merge arrays', () => {

            const val = merge(stub.a.arr, stub.b.arr);


            expect(val).to.contain.members(stub.a.arr);
            expect(val).to.contain.members(stub.b.arr);
        });

        it('should merge objects', () => {

            const val = merge(stub.a.obj, stub.b.obj);

            expect(val).to.contain({
                a: true,
                b: true,
                c: false
            });
        });

        it('should deep merge objects', () => {

            const objA: any = stub.a.obj;
            const objB: any = stub.b.obj;

            objA.d = { some: 'values' };
            objB.d = { other: 'values' };

            const val = merge(objA, objB) as any;

            expect(val).to.include({
                a: true,
                b: true,
                c: false
            });

            expect(val.d).to.include({
                some: 'values',
                other: 'values'
            })
        });

        it('should merge maps', () => {

            const val = merge(stub.a.map, stub.b.map) as any;

            const keys = [...val.keys()];

            expect(keys).to.contain.members([1, 3, 4])
            expect(val.get(1)).to.equal(2);
            expect(val.get(3)).to.equal(7);
            expect(val.get(4)).to.equal(5);
        });

        it('should deep merge maps', () => {

            const mapA = new Map([
                ['a', { test: true }],
                ['b', { tast: true }],
            ]);

            const mapB = new Map([
                ['a', { tots: true }],
                ['b', { tats: true }],
            ]);

            const val = merge(mapA, mapB) as any;

            expect(val.get('a')).to.include({
                test: true,
                tots: true
            });

            expect(val.get('b')).to.include({
                tast: true,
                tats: true
            });
        });

        it('should merge sets', () => {

            const val = merge(stub.a.set, stub.b.set) as any;

            const values = [...val];

            expect(values).to.contain.members([
                ...stub.a.set,
                ...stub.b.set
            ]);
        });

        it('should override if different types', () => {

            const objA = { test: [] };
            const objB = { test: {} };

            const mapA = new Map([['test', []]]);
            const mapB = new Map([['test', {}]]);

            const obj = merge(objA, objB) as any;
            const map = merge(mapA, mapB) as any;

            expect(obj.test.constructor).to.equal(Object);
            expect(map.get('test')!.constructor).to.equal(Object);
        });

        it('should override undefined or null', () => {

            const objSample = { test: ['ok'] };
            const mapSample = new Map([['test', []]]);

            const objUndefined = merge(objSample, { test: undefined }) as any;
            const mapUndefined = merge(mapSample, new Map([['test', undefined]])) as any;

            expect(objUndefined.test).to.equal(undefined);
            expect(mapUndefined.get('test')).to.equal(undefined);

            const objNull = merge(objSample, { test: null }) as any;
            const mapNull = merge(mapSample, new Map([['test', null]])) as any;

            expect(objNull.test).to.equal(null);
            expect(mapNull.get('test')).to.equal(null);
        });

        it('should allow overwriting of incoming arrays', () => {

            const arrSample = [1,2,3];
            const objArrSample = { test: [1,2,3] };
            const mapArrSample = new Map([['test', [1,2,3]]]);

            const options = { mergeArrays: false };

            const arrSampleResult = merge(
                arrSample,
                [4,5,6],
                options
            );

            const objArrSampleResult = merge(
                objArrSample,
                { test: [4,5,6] },
                options
            ) as any;

            const mapArrSampleResult = merge(
                mapArrSample,
                new Map([['test', [4,5,6]]]),
                options
            ) as any;

            expect(arrSampleResult).to.include.members([4,5,6]);
            expect(objArrSampleResult.test).to.include.members([4,5,6]);
            expect(mapArrSampleResult.get('test')).to.include.members([4,5,6]);

        });

        it('should allow overwriting of incoming sets', () => {

            const setSample = new Set([1,2,3]);
            const objSetSample = { test: new Set([1,2,3]) };
            const mapSetSample = new Map([['test', new Set([1,2,3])]]);

            const options = { mergeArrays: false };

            const setSampleResult = merge(
                setSample,
                new Set([4,5,6]),
                options
            ) as any;

            const objSetSampleResult = merge(
                objSetSample,
                { test: new Set([4,5,6])},
                options
            ) as any;

            const mapSetSampleResult = merge(
                mapSetSample,
                new Map([['test', new Set([4,5,6])]]),
                options
            ) as any;

            expect([...setSampleResult]).to.include.members([4,5,6]);
            expect([...objSetSampleResult.test]).to.include.members([4,5,6]);
            expect([...mapSetSampleResult.get('test')!]).to.include.members([4,5,6]);

        });
    });

    describe('addHandlerFor(...)', () => {

        class Triangle {

            hypotenuse: number;
            a: number;
            b: number;

            constructor(a: number, b: number, hypotenuse: number) {

                this.hypotenuse = hypotenuse,
                this.a = a;
                this.b = b;
            }
        }

        it('should not add constructors without good config', () => {

            expect(() => (addHandlerFor as any)({})).to.throw();
            expect(() => (addHandlerFor as any)({ constructor: Triangle })).to.throw();
            expect(() => (addHandlerFor as any)('poop', { constructor: Triangle })).to.throw(/invalid function/);
            expect(() => (addHandlerFor as any)('merge', { constructor: Triangle })).to.throw(/handler/);
        });

        it('should add special constructor to respective functions', () => {

            const equateTriangle = (target: Triangle, source: Triangle) => {

                return target.hypotenuse === source.hypotenuse;
            };


            const cloneTriangle = (target: Triangle) => {

                return new Triangle(
                    target.a,
                    target.b,
                    target.hypotenuse
                );
            };

            const mergeTriangle = (target: Triangle, source: Triangle) => {

                target.a = source.a;
                target.b = source.b;
                target.hypotenuse = source.hypotenuse;

                return target;
            };

            addHandlerFor('clone', Triangle, cloneTriangle);
            addHandlerFor('equals', Triangle, equateTriangle);
            addHandlerFor('merge', Triangle, mergeTriangle);
        });

        it('should equals custom constructor', () => {

            expect(
                equals(
                    new Triangle(1,2,3),
                    new Triangle(1,2,3)
                )
            ).to.be.true

            expect(
                equals(
                    new Triangle(1,2,3),
                    new Triangle(1,1,3)
                )
            ).to.be.true

            expect(
                equals(
                    new Triangle(1,2,3),
                    new Triangle(1,1,4)
                )
            ).to.be.false
        });

        it('should clone custom constructor', () => {

            const x = new Triangle(1,2,3);
            const y = clone(x);

            expect(x === y).to.be.false;
        });

        it('should merge custom constructor', () => {

            const x = new Triangle(1,2,3);
            const y = new Triangle(1,1,1);

            const z = merge(x, y);

            expect(x.a).to.eq(y.a);
            expect(x.b).to.eq(y.b);
            expect(x.hypotenuse).to.eq(y.hypotenuse);

            expect(x === z).to.be.true;

        });

    });

    describe('Circular Reference Protection', () => {

        it('should clone objects with circular references', () => {

            const obj = { a: 1, b: { c: 2 } } as any;
            obj.circular = obj;
            obj.b.parent = obj;

            const cloned = clone(obj);

            expect(cloned).not.to.equal(obj);
            expect(cloned.circular).to.equal(cloned);
            expect(cloned.b.parent).to.equal(cloned);
            expect(cloned.a).to.equal(1);
            expect(cloned.b.c).to.equal(2);
        });

        it('should handle complex circular references in arrays', () => {

            const arr = [1, 2, { nested: null }] as any;
            (arr[2] as any).nested = arr;
            arr.push(arr);

            const cloned = clone(arr);

            expect(cloned).not.to.equal(arr);
            expect((cloned[2] as any).nested).to.equal(cloned);
            expect(cloned[3]).to.equal(cloned);
            expect(cloned[0]).to.equal(1);
            expect(cloned[1]).to.equal(2);
        });

        it('should handle circular references in Maps', () => {

            const map = new Map();
            const obj = { map: map };
            map.set('self', map);
            map.set('obj', obj);

            const cloned = clone(map);

            expect(cloned).not.to.equal(map);
            expect(cloned.get('self')).to.equal(cloned);
            expect(cloned.get('obj').map).to.equal(cloned);
        });

        it('should handle circular references in Sets', () => {

            const set = new Set();
            const obj = { set: set };
            set.add(set);
            set.add(obj);

            const cloned = clone(set);

            expect(cloned).not.to.equal(set);
            expect(cloned.has(cloned)).to.be.true;

            // Find the object in the cloned set
            const clonedObj = [...cloned].find(item =>
                typeof item === 'object' && item !== cloned
            ) as any;
            expect(clonedObj.set).to.equal(cloned);
        });

        it('should equal objects with same circular structure', () => {

            const obj1 = { a: 1 } as any;
            obj1.self = obj1;

            const obj2 = { a: 1 } as any;
            obj2.self = obj2;

            expect(equals(obj1, obj2)).to.be.true;
        });

        it('should not equal objects with different circular structure', () => {

            const obj1 = { a: 1 } as any;
            obj1.self = obj1;

            const obj2 = { a: 2 } as any;
            obj2.self = obj2;

            expect(equals(obj1, obj2)).to.be.false;
        });
    });

    describe('TypedArray Support', () => {

        const TYPED_ARRAYS = [
            { name: 'Int8Array', constructor: Int8Array, values: [1, -1, 127, -128] },
            { name: 'Uint8Array', constructor: Uint8Array, values: [0, 1, 255, 128] },
            { name: 'Uint8ClampedArray', constructor: Uint8ClampedArray, values: [0, 1, 255, 128] },
            { name: 'Int16Array', constructor: Int16Array, values: [1, -1, 32767, -32768] },
            { name: 'Uint16Array', constructor: Uint16Array, values: [0, 1, 65535, 32768] },
            { name: 'Int32Array', constructor: Int32Array, values: [1, -1, 2147483647, -2147483648] },
            { name: 'Uint32Array', constructor: Uint32Array, values: [0, 1, 4294967295, 2147483648] },
            { name: 'Float32Array', constructor: Float32Array, values: [1.1, -1.1, 3.14159, -3.14159] },
            { name: 'Float64Array', constructor: Float64Array, values: [1.1, -1.1, Math.PI, -Math.PI] },
            { name: 'BigInt64Array', constructor: BigInt64Array, values: [1n, -1n, 9223372036854775807n, -9223372036854775808n] },
            { name: 'BigUint64Array', constructor: BigUint64Array, values: [0n, 1n, 18446744073709551615n, 9223372036854775808n] }
        ];

        TYPED_ARRAYS.forEach(({ name, constructor: TypedArrayConstructor, values }) => {

            describe(name, () => {

                it('should clone correctly', () => {

                    const original = new (TypedArrayConstructor as any)(values);
                    const cloned = clone(original);

                    expect(cloned).not.to.equal(original);
                    expect(cloned.constructor).to.equal(TypedArrayConstructor);
                    expect(cloned.length).to.equal(original.length);

                    for (let i = 0; i < original.length; i++) {

                        expect(cloned[i]).to.equal(original[i]);
                    }
                });

                it('should check equality correctly', () => {

                    const arr1 = new (TypedArrayConstructor as any)(values);
                    const arr2 = new (TypedArrayConstructor as any)(values);
                    const arr3 = new (TypedArrayConstructor as any)(values.slice(0, -1));

                    expect(equals(arr1, arr2)).to.be.true;
                    expect(equals(arr1, arr3)).to.be.false;
                });

                it('should merge correctly (replace)', () => {

                    const target = new (TypedArrayConstructor as any)(values);
                    const source = new (TypedArrayConstructor as any)(values.slice().reverse());
                    const merged = merge(target, source) as any;

                    expect(merged.constructor).to.equal(TypedArrayConstructor);

                    for (let i = 0; i < source.length; i++) {

                        expect(merged[i]).to.equal(source[i]);
                    }
                });
            });
        });

        it('should handle TypedArrays in complex structures', () => {

            const complex = {
                arrays: {
                    int8: new Int8Array([1, 2, 3]),
                    float32: new Float32Array([1.1, 2.2, 3.3])
                },
                map: new Map([
                    ['key1', new Uint8Array([255, 128, 64])],
                    ['key2', new BigInt64Array([1n, 2n, 3n])]
                ] as any),
                set: new Set([
                    new Int16Array([100, 200]),
                    new Float64Array([Math.PI, Math.E])
                ])
            };

            const cloned = clone(complex);

            expect(cloned.arrays.int8).not.to.equal(complex.arrays.int8);
            expect(cloned.arrays.int8.constructor).to.equal(Int8Array);
            expect(equals(cloned.arrays.int8, complex.arrays.int8)).to.be.true;

            expect(cloned.map.get('key1')).not.to.equal(complex.map.get('key1'));
            expect(cloned.map.get('key1')!.constructor).to.equal(Uint8Array);
            expect(equals(cloned.map.get('key1'), complex.map.get('key1'))).to.be.true;
        });
    });

    describe('ArrayBuffer and DataView Support', () => {

        it('should clone ArrayBuffer correctly', () => {

            const buffer = new ArrayBuffer(16);
            const view = new Uint8Array(buffer);
            view[0] = 42;
            view[15] = 255;

            const cloned = clone(buffer);

            expect(cloned).not.to.equal(buffer);
            expect(cloned.byteLength).to.equal(buffer.byteLength);
            expect(equals(cloned, buffer)).to.be.true;

            const clonedView = new Uint8Array(cloned);
            expect(clonedView[0]).to.equal(42);
            expect(clonedView[15]).to.equal(255);
        });

        it('should clone DataView correctly', () => {

            const buffer = new ArrayBuffer(16);
            const view = new DataView(buffer);
            view.setInt32(0, 42);
            view.setFloat64(8, Math.PI);

            const cloned = clone(view);

            expect(cloned).not.to.equal(view);
            expect(cloned.byteLength).to.equal(view.byteLength);
            expect(cloned.byteOffset).to.equal(view.byteOffset);
            expect(cloned.getInt32(0)).to.equal(42);
            expect(cloned.getFloat64(8)).to.equal(Math.PI);
            expect(equals(cloned, view)).to.be.true;
        });

        it('should check ArrayBuffer equality correctly', () => {

            const buffer1 = new ArrayBuffer(8);
            const buffer2 = new ArrayBuffer(8);
            const buffer3 = new ArrayBuffer(16);

            const view1 = new Uint8Array(buffer1);
            const view2 = new Uint8Array(buffer2);

            view1[0] = 42;
            view2[0] = 42;

            expect(equals(buffer1, buffer2)).to.be.true;
            expect(equals(buffer1, buffer3)).to.be.false;

            view2[0] = 43;
            expect(equals(buffer1, buffer2)).to.be.false;
        });

        it('should check DataView equality correctly', () => {

            const buffer1 = new ArrayBuffer(16);
            const buffer2 = new ArrayBuffer(16);

            const view1 = new DataView(buffer1, 4, 8);
            const view2 = new DataView(buffer2, 4, 8);
            const view3 = new DataView(buffer2, 0, 8);

            view1.setInt32(0, 42);
            view2.setInt32(0, 42);

            expect(equals(view1, view2)).to.be.true;
            expect(equals(view1, view3)).to.be.false; // Different offset

            view2.setInt32(0, 43);
            expect(equals(view1, view2)).to.be.false;
        });

        it('should merge ArrayBuffer and DataView correctly', () => {

            const buffer1 = new ArrayBuffer(8);
            const buffer2 = new ArrayBuffer(8);

            const view2 = new Uint8Array(buffer2);
            view2[0] = 42;

            const merged = merge(buffer1, buffer2) as ArrayBuffer;
            const mergedView = new Uint8Array(merged);

            expect(merged).not.to.equal(buffer1);
            expect(merged).not.to.equal(buffer2);
            expect(mergedView[0]).to.equal(42);
        });
    });

    describe('Error Object Support', () => {

        const ERROR_TYPES = [
            { name: 'Error', constructor: Error },
            { name: 'TypeError', constructor: TypeError },
            { name: 'ReferenceError', constructor: ReferenceError },
            { name: 'SyntaxError', constructor: SyntaxError },
            { name: 'RangeError', constructor: RangeError },
            { name: 'EvalError', constructor: EvalError },
            { name: 'URIError', constructor: URIError }
        ];

        ERROR_TYPES.forEach(({ name, constructor: ErrorConstructor }) => {

            describe(name, () => {

                it('should clone correctly', () => {

                    const original = new ErrorConstructor('Test message') as any;
                    original.customProperty = 'custom value';

                    const cloned = clone(original);

                    expect(cloned).not.to.equal(original);
                    expect(cloned.constructor).to.equal(ErrorConstructor);
                    expect(cloned.message).to.equal(original.message);
                    expect(cloned.name).to.equal(original.name);
                    expect((cloned as any).customProperty).to.equal('custom value');
                });

                it('should check equality correctly', () => {

                    const error1 = new ErrorConstructor('Test message') as any;
                    const error2 = new ErrorConstructor('Test message') as any;
                    const error3 = new ErrorConstructor('Different message') as any;

                    error1.customProperty = 'same';
                    error2.customProperty = 'same';
                    error3.customProperty = 'same';

                    expect(equals(error1, error2)).to.be.true;
                    expect(equals(error1, error3)).to.be.false;

                    error2.customProperty = 'different';
                    expect(equals(error1, error2)).to.be.false;
                });

                it('should merge correctly (replace)', () => {

                    const target = new ErrorConstructor('Target message');
                    const source = new ErrorConstructor('Source message') as any;
                    source.customProperty = 'source value';

                    const merged = merge(target, source) as any;

                    expect(merged.constructor).to.equal(ErrorConstructor);
                    expect(merged.message).to.equal('Source message');
                    expect(merged.customProperty).to.equal('source value');
                });
            });
        });

        it('should handle Error objects with nested properties', () => {

            const error = new TypeError('Complex error') as any;
            error.details = {
                code: 500,
                nested: {
                    array: [1, 2, 3],
                    map: new Map([['key', 'value']])
                }
            };

            const cloned = clone(error);

            expect(cloned).not.to.equal(error);
            expect((cloned as any).details).not.to.equal(error.details);
            expect((cloned as any).details.nested).not.to.equal(error.details.nested);
            expect((cloned as any).details.nested.array).not.to.equal(error.details.nested.array);
            expect((cloned as any).details.nested.map).not.to.equal(error.details.nested.map);

            expect(equals(cloned, error)).to.be.true;
        });

        it('should handle Error objects in complex structures', () => {

            const complex = {
                errors: [
                    new TypeError('Type error'),
                    new ReferenceError('Reference error')
                ],
                errorMap: new Map([
                    ['type', new TypeError('Map type error')],
                    ['ref', new ReferenceError('Map ref error')]
                ]),
                nested: {
                    error: new SyntaxError('Nested syntax error')
                }
            };

            (complex.errors[0] as any).context = complex;
            (complex.nested.error as any).parent = complex;

            const cloned = clone(complex);

            expect(cloned.errors[0]).not.to.equal(complex.errors[0]);
            expect((cloned.errors[0] as any).context).to.equal(cloned);
            expect((cloned.nested.error as any).parent).to.equal(cloned);
            expect(cloned.errorMap.get('type')).not.to.equal(complex.errorMap.get('type'));
            expect((cloned.errorMap.get('type') as any).constructor).to.equal(TypeError);
        });
    });

    describe('Mixed Complex Scenarios', () => {

        it('should handle all new types together with circular references', () => {

            const complex = {
                typedArrays: {
                    int8: new Int8Array([1, 2, 3]),
                    float32: new Float32Array([1.1, 2.2])
                },
                binaryData: {
                    buffer: new ArrayBuffer(16),
                    view: new DataView(new ArrayBuffer(8))
                },
                errors: {
                    type: new TypeError('Type error'),
                    range: new RangeError('Range error')
                },
                collections: new Map<string, Set<Uint8Array> | SyntaxError[]>([
                    ['arrays', new Set([new Uint8Array([255, 128])])],
                    ['errors', [new SyntaxError('Syntax error')]]
                ])
            };

            // Add circular references
            (complex as any).self = complex;
            (complex.errors.type as any).context = complex;
            complex.binaryData.view.setInt32(0, 42);

            const cloned = clone(complex);

            // Test circular references
            expect((cloned as any).self).to.equal(cloned);
            expect((cloned.errors.type as any).context).to.equal(cloned);

            // Test TypedArrays
            expect(cloned.typedArrays.int8).not.to.equal(complex.typedArrays.int8);
            expect(equals(cloned.typedArrays.int8, complex.typedArrays.int8)).to.be.true;

            // Test binary data
            expect(cloned.binaryData.buffer).not.to.equal(complex.binaryData.buffer);
            expect(cloned.binaryData.view.getInt32(0)).to.equal(42);

            // Test errors
            expect(cloned.errors.type).not.to.equal(complex.errors.type);
            expect(cloned.errors.type.constructor).to.equal(TypeError);

            // Test collections with new types
            const clonedArraysSet = cloned.collections.get('arrays');
            const originalArray = [...complex.collections.get('arrays')!][0];
            const clonedArray = [...clonedArraysSet!][0];

            expect(clonedArray).not.to.equal(originalArray);
            expect(clonedArray!.constructor).to.equal(Uint8Array);
            expect(equals(clonedArray, originalArray)).to.be.true;
        });

        it('should handle performance with large structures', () => {

            const largeArray = new Float32Array(10000);
            for (let i = 0; i < largeArray.length; i++) {

                largeArray[i] = Math.random();
            }

            const largeBuffer = new ArrayBuffer(40000);
            const largeView = new DataView(largeBuffer);

            const complex = {
                largeTypedArray: largeArray,
                largeBuffer: largeBuffer,
                largeView: largeView,
                manyErrors: Array.from({ length: 100 }, (_, i) =>
                    new Error(`Error ${i}`)
                )
            };

            (complex as any).self = complex;

            const start = performance.now();
            const cloned = clone(complex);
            const end = performance.now();

            expect(cloned).not.to.equal(complex);
            expect((cloned as any).self).to.equal(cloned);
            expect(cloned.largeTypedArray.length).to.equal(10000);
            expect(cloned.largeBuffer.byteLength).to.equal(40000);
            expect(cloned.manyErrors.length).to.equal(100);

            // Performance should be reasonable (adjust threshold as needed)
            expect(end - start).to.be.lessThan(1000); // Less than 1 second
        });
    });

    describe('Prototype Pollution Safeguards', () => {

        let polluted = false;
        afterEach(() => {
            // Ensure a clean prototype after each test
            if (polluted) {
                delete (Object.prototype as any).polluted;
                polluted = false;
            }
        });

        it('clone should not clone properties from the prototype chain', () => {
            const proto = { polluted: true };
            polluted = true;
            const obj = Object.create(proto);
            obj.own = 'value';

            const cloned = clone(obj);

            expect(cloned).to.deep.equal({ own: 'value' });
            expect(cloned).to.not.have.property('polluted');
        });

        it('clone should ignore dangerous properties from the source object', () => {
            const payload = JSON.parse('{ "myProp": "value", "__proto__": {"polluted":true}, "constructor": {"polluted":true}, "prototype": {"polluted":true} }');
            polluted = true;
            const cloned = clone(payload);

            expect(cloned).to.deep.equal({ myProp: 'value' });
            expect(Object.prototype.hasOwnProperty.call(cloned, '__proto__')).to.be.false;
            expect(Object.prototype.hasOwnProperty.call(cloned, 'constructor')).to.be.false;
            expect(Object.prototype.hasOwnProperty.call(cloned, 'prototype')).to.be.false;

            // Check that no pollution occurred
            expect(({} as any).polluted).to.be.undefined;
        });

        it('merge should not merge dangerous __proto__ properties', () => {
            const target = {};
            const source = JSON.parse('{"__proto__": {"polluted": true}}');
            polluted = true;
            merge(target, source);

            expect(target).to.deep.equal({});
            expect(({} as any).polluted).to.be.undefined;
        });

        it('merge should not merge dangerous constructor/prototype properties', () => {
            const target = {};
            const source = JSON.parse('{"constructor": {"prototype": {"polluted": true}}}');
            polluted = true;
            merge(target, source);

            expect(target).to.deep.equal({});
            expect(({} as any).polluted).to.be.undefined;
        });

        it('merge on nested objects should not allow pollution', () => {
            const target = { nested: {} };
            const source = JSON.parse('{ "nested": { "__proto__": { "polluted": true } } }');
            polluted = true;
            merge(target, source);

            expect(target.nested).to.deep.equal({});
            expect(({} as any).polluted).to.be.undefined;
        });

        it('equals should ignore prototype chain for equality', () => {
            const obj1 = { a: 1 };
            const maliciousObj = JSON.parse('{"a": 1, "__proto__": {"polluted": true}}');
            polluted = true;
            expect(equals(obj1, maliciousObj)).to.be.true;
            expect(({} as any).polluted).to.be.undefined;
        });
    });
});
