import { describe, it, before, beforeEach, after, afterEach } from 'node:test'
import { SinonSpy } from 'sinon';

// @ts-expect-error - chai is not a module
import { expect } from 'chai';

import {
    StorageEvent,
    StorageAdapter,
    StorageImplementation
} from '../../packages/storage/src/index.ts';

import { sandbox } from './_helpers';

const clearStores = () => {

    window.localStorage.clear()
    window.sessionStorage.clear()
}

type StorageItems = {
    test: number[] | boolean,
    one: string,
    buckle: string,
    cur: object | string,
    test1: true,
    test2: true,
    test3: true,
    a: string,
    b: string,
    c: string,

    wee: {

        a: string,
        b: string,
        c: string,
        ign?: string,
    }
}

// .get('test')).to.include.members([1,2,3,4])
// .get(['one', 'buckle']);
// .get('test')).to.not.exist;
// .get()).to.include({
// .get()).to.include({
// .get('cur')).to.not.include(assign);
// .get('cur')).to.include(cur);
// .get('cur')).to.include(assign);
// .get('cur')).to.not.include(assign);
// .get('cur')).to.not.include(assign);

describe('@logosdx/storage', () => {

    before(clearStores)
    after(clearStores)

    it('References localStorage or sessionStorage', () => {

        const ls = new StorageAdapter<StorageItems>(window.localStorage);
        const ss = new StorageAdapter<StorageItems>(window.sessionStorage);

        expect(ls.storage).to.equal(window.localStorage);
        expect(ss.storage).to.equal(window.sessionStorage);
    });

    // Test both local storage and session storage
    const testSuites: [string, StorageImplementation & Record<string, string>][] = [
        // name          storage reference
        ['LocalStorage', window.localStorage],
        ['SessionStorage', window.sessionStorage],
    ];

    testSuites.forEach(([name, storage]) => {

        const store: {
            store: StorageAdapter<StorageItems>;
            prefixed?: StorageAdapter<StorageItems>;
        } = {
            store: new StorageAdapter<StorageItems>(storage)
        };

        describe(name, () => {


            it(`Sets json stringified keys`, async () => {


                const val = [1,2,3,4];
                store.store.set('test', val);

                expect(storage.test, name).to.equal(JSON.stringify(val));
            });

            it(`Sets an entire object as keys`, async () => {

                const val = {
                    one: 'two',
                    buckle: 'myshow'
                };

                store.store.set(val);

                expect(storage.one, name).to.equal(JSON.stringify(val.one));
                expect(storage.buckle, name).to.equal(JSON.stringify(val.buckle));
            });

            it(`Gets and parses a single key`, async () => {

                expect(store.store.get('test'), name).to.include.members([1,2,3,4])
            });

            it(`Gets and returns an object of key values when passed multiple values`, async () => {

                const vals = store.store.get(['one', 'buckle']);
                expect(vals, name).to.include({
                    one: 'two',
                    buckle: 'myshow'
                });
            });

            it(`Checks to see if has keys`, async () => {

                expect(store.store.has('test'), name).to.equal(true);
                expect(store.store.has(['test', 'one', 'buckle']), name).to.have.members([true, true, true]);
                expect(store.store.has(['test', 'one', 'buckle', 'three']), name).to.have.members([true, true, true, false]);
            });

            it(`Removes item from store`, async () => {

                store.store.rm('test');
                expect(store.store.get('test'), name).to.not.exist;
            });

            it(`Retrieves a copy of entire store`, async () => {

                store.store.set('test1', true);
                store.store.set('test2', true);
                store.store.set('test3', true);

                expect(store.store.get(), name).to.include({
                    one: 'two',
                    buckle: 'myshow',
                    test1: true,
                    test2: true,
                    test3: true
                });
            });

            it(`Clears storage`, async () => {

                store.store.clear();

                const ssKeys = store.store.keys();
                const sKeys = store.store.keys();
                expect(ssKeys.length, name).to.equal(0);
                expect(sKeys.length, name).to.equal(0);
            })

            it(`Sets keys using a prefix`, async () => {

                store.prefixed = new StorageAdapter<StorageItems>(storage, 'test');
                const store2 = new StorageAdapter<StorageItems>(storage, 'test2');

                store.prefixed!.set('test', true);
                store2.set('test', false);

                expect(storage.test, name).to.not.exist;
                expect(storage['test:test'], name).to.exist;
                expect(storage['test2:test'], name).to.exist;
                expect(storage['test:test'], name).to.equal('true');
                expect(storage['test2:test'], name).to.equal('false');
            });

            it(`Retrieves prefixed storage length accurately`, async () => {

                store.prefixed!.set('test1', true);
                store.prefixed!.set('test2', true);
                store.prefixed!.set('test3', true);

                const pKeys = store.prefixed!.keys();
                const sKeys = Object.keys(storage);

                expect(sKeys.length, name).to.equal(5);
                expect(pKeys.length, name).to.equal(4);
            });

            it(`Checks if it has prefixed items`, async () => {

                const t1 = store.prefixed!.has('test1');
                const [t2, t3, t4] = store.prefixed!.has(['test2', 'test3', 'qqq']);

                expect(t1, name).to.be.true;
                expect(t2, name).to.be.true;
                expect(t3, name).to.be.true;
                expect(t4, name).to.be.false;

                const pKeys = store.prefixed!.keys();

                expect(pKeys.length, name).to.equal(4);
            });

            it(`Retrieves all prefixed items`, async () => {

                expect(store.prefixed!.get(), name).to.include({
                    test: true,
                    test1: true,
                    test2: true,
                    test3: true
                });
            })

            it(`Clears all prefixed items`, async () => {

                store.prefixed!.clear();

                const pKeys = store.prefixed!.keys();
                const sKeys = Object.keys(storage);

                expect(pKeys.length, name).to.equal(0);
                expect(sKeys.length, name).to.equal(1);
            });

            it(`Object assigns to a current object in store`, async () => {

                const cur = { a: true };
                const assign = { b: false };
                store.store.set('cur', cur);

                expect(store.store.get('cur'), name).to.not.include(assign);

                store.store.assign('cur', assign);

                expect(store.store.get('cur'), name).to.include(cur);
                expect(store.store.get('cur'), name).to.include(assign);
            });

            it(`Does not allow assigns if value not an object`, async () => {

                const cur = { a: true };
                const assign = 'wat';
                store.store.set('cur', cur);

                try {

                    store.store.assign('cur', assign as any);
                    expect(store.store.get('cur'), name).to.not.include(assign);
                }
                catch (e) {

                    expect(e, name).to.be.an('error');
                }
            });

            it(`Does not allow assigns if item not an object`, async () => {

                const cur = 'wat';
                const assign = { a: true };
                store.store.set('cur', cur);

                try {

                    store.store.assign('cur', assign);
                    expect(store.store.get('cur'), name).to.not.include(assign);
                }
                catch (e) {

                    expect(e, name).to.be.an('error');
                }
            });
        });
    });

    describe('Handles events', async () => {

        const onBeforeSet = sandbox.fake <[StorageEvent<StorageItems>]>();
        const onAfterSet = sandbox.fake <[StorageEvent<StorageItems>]>();
        const onBeforeRemove = sandbox.fake <[StorageEvent<StorageItems>]>();
        const onAfterRemove = sandbox.fake <[StorageEvent<StorageItems>]>();

        const storage = new StorageAdapter<StorageItems>(window.localStorage, 'hooks');

        storage.on('storage-before-set', onBeforeSet);
        storage.on('storage-before-unset', onBeforeRemove);
        storage.on('storage-after-set', onAfterSet);
        storage.on('storage-after-unset', onAfterRemove);

        beforeEach(() => {

            sandbox.reset();
        });

        const getKeys = (setTo: Partial<StorageItems>) => Object.keys(setTo) as (keyof StorageItems)[];
        const getVals = (setTo: Partial<StorageItems>) => Object.keys(setTo) as (StorageItems[keyof StorageItems])[];
        const mapArgs = <S extends SinonSpy<[StorageEvent<StorageItems>]>>(spy: S) => spy.args.map(([e]) => e)

        it('dispatches events on set', () => {

            storage.set('test', true);

            const [beforeEv1] = mapArgs(onBeforeSet);
            const [afterEv1] = mapArgs(onAfterSet);

            expect(beforeEv1!.key, 'before set test key').to.eq('test');
            expect(afterEv1!.key, 'after set test key').to.eq('test');

            expect(beforeEv1!.value, 'before set test value').to.eq(true);
            expect(afterEv1!.value, 'after set test value').to.eq(true);

            const _with: Partial<StorageItems> = {
                buckle: 'my shoe',
                test: true
            };

            storage.set(_with);

            const [,bEv2,bEv3] = mapArgs(onBeforeSet);
            const [,aEv2,aEv3] = mapArgs(onAfterSet);

            expect(
                [bEv2!.key, bEv3!.key],
                'before set object key'
            ).to.contain.members(['buckle', 'test'])
            expect(
                [bEv2!.value, bEv3!.value],
                'before set object value'
            ).to.contain.members(['my shoe', true])

            expect(
                [bEv2!.key, bEv3!.key],
                'before set object key'
            ).to.contain.members(['buckle', 'test'])
            expect(
                [aEv2!.value, aEv3!.value],
                'before set object value'
            ).to.contain.members(['my shoe', true])
        });

        it('dispatches events on remove', () => {

            storage.set('test', true);

            const setThis = {
                a: '1',
                b: '2',
                c: '3'
            };

            storage.set(setThis);
            storage.rm('test');

            const keys = getKeys(setThis);

            storage.rm(keys);

            const [bEv1, bEv2, bEv3, bEv4] = mapArgs(onBeforeSet);
            const [aEv1, aEv2, aEv3, aEv4] = mapArgs(onAfterSet);

            expect(
                [bEv2!.key, bEv3!.key, bEv4!.key],
                'before '+keys.toString()
            ).to.include.members(keys);

            expect(
                [aEv2!.key, aEv3!.key, aEv4!.key],
                'after '+keys.toString()
            ).to.include.members(keys);

            expect(bEv1!.key, 'test before').to.eq('test');
            expect(aEv1!.key, 'test after').to.eq('test');
        });

        it('dispatches events on assign', () => {

            const setThis = {
                a: '1',
                b: '2',
                c: '3'
            };

            const assign = { ign: 'true' };

            storage.set('wee', setThis);
            storage.assign('wee', assign);

            const [,bEv2] = mapArgs(onBeforeSet);
            const [,aEv2] = mapArgs(onAfterSet);

            expect(bEv2!.key, 'before assign set').to.eq('wee')
            expect(bEv2!.value, 'before assign set').to.contain(setThis);
            expect(bEv2!.value, 'before assign set').to.contain(assign);

            expect(aEv2!.key, 'after assign set').to.eq('wee')
            expect(aEv2!.value, 'after assign set').to.contain(setThis);
            expect(aEv2!.value, 'after assign set').to.contain(assign);

        });
    });

    describe('Wrap', () => {

        const onBeforeSet = sandbox.fake <[StorageEvent<StorageItems>]>();
        const onAfterSet = sandbox.fake <[StorageEvent<StorageItems>]>();
        const onBeforeRemove = sandbox.fake <[StorageEvent<StorageItems>]>();
        const onAfterRemove = sandbox.fake <[StorageEvent<StorageItems>]>();

        const storage = new StorageAdapter<StorageItems>(window.localStorage, 'wrap');

        storage.on('storage-before-set', onBeforeSet);
        storage.on('storage-before-unset', onBeforeRemove);
        storage.on('storage-after-set', onAfterSet);
        storage.on('storage-after-unset', onAfterRemove);

        afterEach(() => {

            sandbox.resetHistory();
        });


        it('should wrap functions around a single key', () => {

            const wrapped = storage.wrap('wee');

            const val = {
                a: '1',
                b: '2',
                c: '3'
            }

            wrapped.set(val);

            expect(storage.get('wee')).to.contain(val);

            const gotten = wrapped.get();
            expect(gotten).to.contain(val);

            const assign = { ign: 'ass' };
            wrapped.assign(assign);

            expect(wrapped.get()).to.contain(val);
            expect(wrapped.get()).to.contain(assign);


            wrapped.remove();

            expect(storage.get('wee') === null).to.be.true;
        });

    });

});