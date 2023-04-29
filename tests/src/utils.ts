import { expect } from 'chai';
import * as fc from 'fast-check';

import {
    clone,
    deepEqual,
    addConstructorCheck,
    merge,
} from '@logos-ui/utils';

import * as otherUtils from '@logos-ui/utils';

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

describe('@logos-ui/utils', () => {

    describe('clone(...)', () => {


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

            const arr = clone(stub.arr);
            expect(arr).not.to.equal(stub.arr);

            const map = clone(stub.map);
            expect(map).not.to.equal(stub.map);

            const set = clone(stub.set);
            expect(set).not.to.equal(stub.set);
        });

        it('clones nested objects', () => {

            const clonedStub = clone(stub);
            expect(clonedStub).not.to.equal(stub);
            expect(clonedStub.obj).not.to.equal(stub.obj);
            expect(clonedStub.arr).not.to.equal(stub.arr);
            expect(clonedStub.map).not.to.equal(stub.map);
            expect(clonedStub.set).not.to.equal(stub.set);
        });
    });

    describe('deepEquals(...)', () => {

        describe('Args', function () {

            it('should accept any kind of value', function () {

                const predicate = (a: any, b: any) => {

                    deepEqual(a,b)
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

                deepEqual(null, null);
                deepEqual(undefined, undefined);
                deepEqual(true, true);
                deepEqual(new Date(), new Date());
                deepEqual(new RegExp('test'), new RegExp('tets'));

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

                for (const Klass of iterables) {

                    deepEqual(
                        new Klass([21, 32]),
                        new Klass([22, 43]),
                    )
                }

                const others = [
                    [() => {}, function* () {}],
                    [() => {}, async () => {}],
                ];

                for (const [a, b] of others) {

                    deepEqual(a, b);
                }

            }).timeout(10 * 1000);

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

                    const isEqual = deepEqual(state1, { x });
                    expect(isEqual).to.be.false;
                })
            });

            it('should not throw if there is no change and values are undefined or null', function () {

                const hasNull = { x: null };
                const hasUndefined = { x: undefined };

                expect(() => deepEqual(hasNull, { ...hasNull })).to.not.throw();
                expect(() => deepEqual(hasUndefined, { ...hasUndefined })).to.not.throw();
            });

            it('should not error on undeepEqualable types', () => {

                expect(() => deepEqual(new Function, new WeakMap)).to.not.throw();
                expect(() => deepEqual(new WeakSet, new Promise(() => {}))).to.not.throw();
            });
        });

        describe('Objects and Arrays', function () {

            it('should be false if number of object keys are different', function () {

                const state1 = { x: 1 };
                const state2 = { x: 1, y: 1 };

                const isEqual = deepEqual(state1, state2);
                expect(isEqual).to.be.false;
            });

            it('should be false if missing a key', function () {

                const state1 = { x: 1, z: 1 };
                const state2 = { x: 1, y: 1 };

                const isEqual = deepEqual(state1, state2);
                expect(isEqual).to.be.false;
            });

            it('should be false if value is primitive and changes', function () {

                const state1 = { x: 1, y: 1 };
                const state2 = { x: 1, y: 2 };

                const isEqual = deepEqual(state1, state2);
                expect(isEqual).to.be.false;
            });


            it('should be false on complex structures', function () {

                const state1 = stub.complex('becks')
                const state2 = stub.complex('pauli girl');

                expect(
                    deepEqual(state1, state2)
                ).to.be.false;

            });

            it('should be false on very deep nested', function () {

                const x = 'super';

                const state1 = { x: { x: { x: { x }}}}
                const state2 = { x: { x: { x: { x: `${x}s` }}}}

                const isEqual = deepEqual(state1, state2);
                expect(isEqual).to.be.false;
            });

            it('should implement recursion', function () {

                const state1 = stub.any();
                const state2: { [k: string]: any } = stub.any();

                state2.obj = { y: true };

                const isEqual = deepEqual(state1, state2);

                expect(isEqual).to.be.false;
            });

            it('should not deepEqual mismatching arrays', () => {

                const notEquals = [
                    [ [1,2,3], [2,1,3] ],
                    [ [{ X: true }, 2, 3], [{ x: true }, 1, 3] ],
                    [ [{ x: false }, 2, 3], [{ x: true }, 1, 3] ],
                    [ [{x:1}, {y:2}], [{y:2}, {x:1}] ]
                ];

                for (const [a, b] of notEquals) {

                    expect(deepEqual(a, b)).to.be.false;
                }
            });

            it('should deepEqual matching arrays', () => {

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
                    expect(deepEqual(a, b)).to.be.true;
                }
            });


            it('should deepEqual empty array', () => {

                expect(deepEqual(
                    { t: [1] },
                    { t: [] }
                )).to.be.false


                expect(deepEqual(
                    { t: [] },
                    { t: [1] }
                )).to.be.false

                expect(deepEqual(
                    [1],
                    []
                )).to.be.false

                expect(deepEqual(
                    [],
                    [2]
                )).to.be.false

            });

        });


        describe('Maps and Sets', function () {

            it('should not equal mismatching maps', () => {

                const e1 = new Map(Object.entries(stub.any()));
                const e2 = new Map(Object.entries(stub.complex()));

                expect(deepEqual(e1, e2)).to.be.false;
            });

            it('should equal matching maps', () => {

                const e1 = new Map(Object.entries(stub.complex()));
                const e2 = new Map(Object.entries(stub.complex()));

                expect(deepEqual(e1, e2)).to.be.true;
            });

            it('should not equal mismatching sets', () => {

                const e1 = new Set(Object.values(stub.simple()));
                const e2 = new Set(Object.values(stub.simple()));
                const e3 = new Set(Object.values(stub.simple()));

                e2.add('x');
                e3.add('x');
                e3.delete(null);

                expect(deepEqual(e1, e2)).to.be.false;
                expect(deepEqual(e1, e3)).to.be.false;
                expect(deepEqual(e2, e3)).to.be.false;
            });

            it('should not deepEqual matching sets', () => {

                const e1 = new Set(Object.values(stub.simple()));
                const e2 = new Set(Object.values(stub.simple()));

                expect(deepEqual(e1, e2)).to.be.true;
            });

        });


        describe('Miscellaneous Types', function () {

            it('should not equal mismatching regex', () => {

                const rgx = '^abc123{2,}[a-z]\\d+.+\\s(a|b)';
                const r1 = new RegExp(rgx, 'i');
                const r2 = new RegExp(rgx, 'im');
                const r3 = new RegExp(rgx + '$', 'im');

                expect(deepEqual(r1, r2)).to.be.false;
                expect(deepEqual(r1, r3)).to.be.false;
                expect(deepEqual(r2, r3)).to.be.false;
            });

            it('should equal matching regex', () => {

                const rgx = '^abc123{2,}[a-z]\\d+.+\\s(a|b)';
                const r1 = new RegExp(rgx, 'i');
                const r2 = new RegExp(rgx, 'i');

                expect(deepEqual(r1, r2)).to.be.true;
            });

            it('should not equal mismatching dates', () => {

                const d = new Date();
                const d1 = new Date(+d);
                const d2 = new Date(+d + 1);

                expect(deepEqual(d1, d2)).to.be.false;
            });
            it('should equal matching dates', () => {

                const d = new Date();
                const d1 = new Date(+d);
                const d2 = new Date(+d);

                expect(deepEqual(d1, d2)).to.be.true;
            });
        });

        describe('Add Special Types', function () {

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

            class TriangleB extends Triangle {};

            it('should not add constructors without good config', () => {

                expect(() => addConstructorCheck({})).to.throw();
                expect(() => addConstructorCheck({ constructor: Triangle })).to.throw();
            });

            it('should add special constructor and treat as object', () => {

                expect(() => addConstructorCheck({
                    constructor: Triangle,
                    treatAs: Object
                })).not.to.throw();
            });

            it('should deepEqual new constructor with treat as', () => {

                expect(
                    deepEqual(
                        new Triangle(1,2,3),
                        new Triangle(1,2,3)
                    )
                ).to.be.true

                expect(
                    deepEqual(
                        new Triangle(1,2,3),
                        new Triangle(1,1,3)
                    )
                ).to.be.false
            });

            it('should add special constructor with custom deepEqual func', () => {

                expect(() => addConstructorCheck({
                    constructor: TriangleB,
                    deepEqualFunc: (a, b) => a.hypotenuse === b.hypotenuse
                })).not.to.throw();
            });

            it('should deepEqual new constructor with custom deepEqual func', () => {

                expect(
                    deepEqual(
                        new TriangleB(1,2,3),
                        new TriangleB(11,12,3)
                    )
                ).to.be.true

                expect(
                    deepEqual(
                        new TriangleB(1,2,3),
                        new TriangleB(1,2,4)
                    )
                ).to.be.false
            });
        });
    });


    describe('merge(...)', function () {

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

            const val = merge(objA, objB);

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

            const val = merge(stub.a.map, stub.b.map);

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

            const val = merge(mapA, mapB);


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

            const val = merge(stub.a.set, stub.b.set);

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

            const obj = merge(objA, objB);
            const map = merge(mapA, mapB);

            expect(obj.test.constructor).to.equal(Object);
            expect(map.get('test')!.constructor).to.equal(Object);
        });

        it('should override undefined or null', () => {

            const objSample = { test: ['ok'] };
            const mapSample = new Map([['test', []]]);

            const objUndefined = merge(objSample, { test: undefined }) as typeof objSample;
            const mapUndefined = merge(mapSample, new Map([['test', undefined]]));

            expect(objUndefined.test).to.equal(undefined);
            expect(mapUndefined.get('test')).to.equal(undefined);

            const objNull = merge(objSample, { test: null }) as typeof objSample;
            const mapNull = merge(mapSample, new Map([['test', null]]));

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
            );

            const mapArrSampleResult = merge(
                mapArrSample,
                new Map([['test', [4,5,6]]]),
                options
            );

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
            );

            const objSetSampleResult = merge(
                objSetSample,
                { test: new Set([4,5,6])},
                options
            );

            const mapSetSampleResult = merge(
                mapSetSample,
                new Map([['test', new Set([4,5,6])]]),
                options
            );

            expect([...setSampleResult]).to.include.members([4,5,6]);
            expect([...objSetSampleResult.test]).to.include.members([4,5,6]);
            expect([...mapSetSampleResult.get('test')!]).to.include.members([4,5,6]);

        });
    });

});