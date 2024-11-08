import { describe, it, before, beforeEach, after, afterEach } from 'node:test'

import { expect } from 'chai';

import { ObserverFactory } from '@logos-ui/observer';
import { SinonStub } from 'sinon';
import { sandbox } from './_helpers';
import { Deferred } from '@logos-ui/utils';

interface AppEvents {
    test: string | number
    test1: string
    test2: string
    test3: string
    pops: string

    aa: string
    ba: string
    bc: string
    cda: string
    zo: string
    zu: string
    za: string

    'child-test': string
}

type TestObserver = ObserverFactory<any, AppEvents>;

const stub: {
    observer?: TestObserver,
    component?: any,
    spy: SinonStub<[{
        fn: string,
        event: string,
        data: any,
        context: TestObserver
    }]>,
    ref: string
} = {
    spy: sandbox.stub(),
    ref: 'test'
};

interface RunTestOnBoth {
    (observed: TestObserver, which: string): void
}

const doToBoth = async (fn: RunTestOnBoth) => {

    await fn(stub.observer!, 'observer');
    await fn(stub.component, 'component');

    stub.observer!.off('*');
    stub.component.off('*');
};

describe('@logos-ui/observer', function () {

    describe('new ObserverFactory(...)', function () {

        afterEach(() => {

            sandbox.resetHistory();
        });

        it('should create a new observer', function () {

            const observer = new ObserverFactory();

            expect(typeof observer.on).to.eq('function');
            expect(typeof observer.one).to.eq('function');
            expect(typeof observer.off).to.eq('function');
            expect(typeof observer.trigger).to.eq('function');
            expect(typeof observer.observe).to.eq('function');
        });

        it('should create a new observer with options', function () {

            stub.observer = new ObserverFactory(null, {
                spy: stub.spy as any,
                ref: stub.ref
            });

            expect(typeof stub.observer.on).to.eq('function');
            expect(typeof stub.observer.one).to.eq('function');
            expect(typeof stub.observer.off).to.eq('function');
            expect(typeof stub.observer.trigger).to.eq('function');
            expect(typeof stub.observer.observe).to.eq('function');
        });

        it('should add an observable API to an existing component', async () => {

            stub.component = {};

            expect(typeof stub.component.on).to.eq('undefined');
            expect(typeof stub.component.one).to.eq('undefined');
            expect(typeof stub.component.off).to.eq('undefined');
            expect(typeof stub.component.trigger).to.eq('undefined');
            expect(typeof stub.component.observe).to.eq('undefined');

            new ObserverFactory(stub.component, {
                spy: stub.spy as any,
                ref: stub.ref
            });

            expect(typeof stub.component.on).to.eq('function');
            expect(typeof stub.component.one).to.eq('function');
            expect(typeof stub.component.off).to.eq('function');
            expect(typeof stub.component.trigger).to.eq('function');
            expect(typeof stub.component.observe).to.eq('function');
        });

        it('should not have enumerable properties', async () => {

            await doToBoth((observed, which) => {

                expect(Object.keys(observed), which).to.have.length(0);
            });
        });

        it('should attach a single listener', async () => {

            await doToBoth((observed, which) => {

                const fake = sandbox.stub();

                observed.on('test', fake);

                observed.emit('test', 'a');

                expect(fake.calledOnce, which).to.be.true;
                expect(fake.calledWith('a'), which).to.be.true;
            });
        });

        it('should remove a single listener', async () => {

            await doToBoth((observed, which) => {

                const fake1 = sandbox.stub();
                const fake2 = sandbox.stub();

                observed.on('test1', fake1);
                observed.on('test1', fake2);

                observed.emit('test1');

                observed.off('test1', fake2);

                observed.emit('test1');

                expect(fake1.callCount, which).to.eq(2);
                expect(fake2.callCount, which).to.eq(1);
            });
        });

        it('should remove all listeners', async () => {

            await doToBoth((observed, which) => {

                const fake = sandbox.stub();

                observed.on('test1', fake);
                observed.on('test2', fake);
                observed.on('test3', fake);

                observed.off('*');

                observed.emit('test1');
                observed.emit('test2');
                observed.emit('test3');

                expect(fake.callCount, which).to.eq(0);
            });
        });

        it('should remove all listeners of a specific event', async () => {

            await doToBoth((observed, which) => {

                const fake1 = sandbox.stub();
                const fake2 = sandbox.stub();
                const fake3 = sandbox.stub();

                observed.on('test', fake1);
                observed.on('test', fake2);
                observed.on('test', fake3);

                observed.on('test3', fake3);

                observed.emit('test');
                observed.emit('test3');

                observed.off('test');

                observed.emit('test');
                observed.emit('test3');

                expect(fake1.callCount, which).to.eq(1);
                expect(fake2.callCount, which).to.eq(1);
                expect(fake3.callCount, which).to.eq(3);
            });
        });

        it('should not error if event does not exist', async () => {

            await doToBoth((observed, which) => {

                expect(() => observed.off('pops'), which).not.to.throw();
            });
        });

        it('should listen only once', async () => {

            await doToBoth((observed, which) => {


                const fake = sandbox.stub();

                observed.once('test', fake);

                observed.emit('test');
                observed.emit('test');

                expect(fake.calledOnce, which).to.be.true;
            });
        });

        it('should respect listen once when sharing same listener', async () => {

            await doToBoth((observed, which) => {

                const fake = sandbox.stub();

                observed.once('test', fake);
                observed.on('test', fake);

                observed.emit('test');
                observed.emit('test');
                observed.emit('test');

                expect(fake.callCount, which).to.eq(4);
            });
        });

        it('should only listen to listener one time', async () => {

            await doToBoth((observed, which) => {

                const fake = sandbox.stub();

                observed.on('test', fake);
                observed.on('test', fake);
                observed.on('test', fake);

                observed.emit('test');

                expect(fake.callCount, which).to.eq(1);
            });
        });

        it('should allow spying on observer functions', async () => {

            await doToBoth((observed, which) => {

                const fake = sandbox.stub();

                observed.on('test', fake);
                observed.once('test1', fake);
                observed.off('test1', fake);
                observed.emit('test', 1);

                expect(stub.spy.callCount, which).to.eq(4);
                const calls = stub.spy.getCalls();

                expect(calls[0]!.args[0], which).to.include({ fn: 'on', event: 'test', data: null });
                expect(calls[1]!.args[0], which).to.include({ fn: 'once', event: 'test1', data: null });
                expect(calls[2]!.args[0], which).to.include({ fn: 'off', event: 'test1', data: null });
                expect(calls[3]!.args[0], which).to.include({ fn: 'emit', event: 'test', data: 1 });

                const contexts = [
                    calls[0]!.args[0].context,
                    calls[1]!.args[0].context,
                    calls[2]!.args[0].context,
                    calls[3]!.args[0].context
                ]

                let context = observed;

                // Component has a reference to the observable
                // instance that it wraps
                if (which === 'component') {

                    context = (observed as any).$_observer;
                }

                for (const ctx of contexts) {

                    expect(ctx === context, which).to.be.true;
                }

                expect(calls[3]!.args[0].data).to.equal(1);

                sandbox.resetHistory();
            });
        });

        it('should allow listening to events based on regex', async () => {

            const events = [
                'aa', // a x 4
                'ba', // b x 2
                'bc', // c x 2
                'cDa', // D x 1
                'zo', // z x 3
                'zu',
                'za'
            ];

            await doToBoth((observed, which) => {

                const fakeEv = sandbox.stub();
                const fakeRgx = sandbox.stub();

                const bindEv = () => (

                    events.map((e) => observed.on(e as any, fakeEv))
                );

                bindEv();

                observed.on(/a/i, fakeRgx);
                observed.emit('aa', 'works');

                expect(fakeEv.getCalls().length, which).to.eq(1);
                expect(fakeRgx.getCalls().length, which).to.eq(1);

                /** Test for "a" */

                fakeEv.reset(); fakeRgx.reset();

                observed.emit(/a/i, 'works');

                expect(fakeEv.getCalls().length, which).to.eq(4);
                expect(fakeRgx.getCalls().length, which).to.eq(0);

                /** Test for "D" */

                fakeEv.reset(); fakeRgx.reset();
                observed.emit(/d/, 'works');
                expect(fakeEv.getCalls().length, which).to.eq(0);

                observed.emit(/D/, 'works');
                expect(fakeEv.getCalls().length, which).to.eq(1);

                /** Test for Z and remove Z based on regex */

                fakeEv.reset(); fakeRgx.reset();
                observed.emit(/z/, 'works');
                expect(fakeEv.getCalls().length, which).to.eq(3);

                observed.off(/z/);
                observed.emit(/z/, 'works');
                expect(fakeEv.getCalls().length, which).to.eq(3);

                fakeEv.reset(); fakeRgx.reset();

                /** Removes all callbacks */
                observed.off('*');

                observed.emit(/a/i, 'works');
                observed.emit('aa', 'works');

                expect(fakeEv.getCalls().length, which).to.eq(0);
                expect(fakeRgx.getCalls().length, which).to.eq(0);

                /** Removes all callbacks */
                fakeEv.reset();

                bindEv();

                observed.on(/.+/, fakeRgx);

                events.map((e) => observed.emit(e as any))

                expect(fakeRgx.getCalls().length, which).to.eq(events.length);
            });
        });

        it('creates an EventGenerator when calling `on` without a listener', async () => {

            await doToBoth(
                async (observer, which) => {

                    const generator = observer.on('test');

                    expect(typeof generator, which).to.eq('object');
                    expect(typeof generator.emit, which).to.eq('function');
                    expect(typeof generator.next, which).to.eq('function');
                    expect(typeof generator.destroy, which).to.eq('function');

                    const promise = generator.next();

                    observer.emit('test', 'a');

                    const resolved1 = await promise;

                    expect(resolved1, which).to.eq('a');

                    const promise2 = generator.next();

                    observer.emit('test', 'b');

                    const resolved2 = await promise2;

                    expect(resolved2, which).to.eq('b');

                    const promise3 = generator.next();

                    generator.emit('c');

                    const resolved3 = await promise3;

                    expect(resolved3, which).to.eq('c');

                    generator.destroy();

                    const promise4 = generator.next();

                    const deferred = new Deferred();

                    promise4.then(
                        () => deferred.reject(
                            new Error('Should not resolve')
                        )
                    ).catch(deferred.resolve);

                    const errored = await deferred.promise as Error;

                    expect(errored, which).to.be.instanceOf(Error);
                }
            );
        });

        it('handles regex with EventGenerators', async () => {

            await doToBoth(async (observed, which) => {

                const en = observed.on(/some/);

                const forceEmit = (event: string, val: any) => {

                    observed.emit(event as never, val as never);
                }

                const p1 = en.next();
                forceEmit('something', 'a');

                const p2 = en.next();
                forceEmit('someone', 'b');

                const p3 = en.next();
                forceEmit('troublesome', 'c');

                const resolved1 = await p1;
                const resolved2 = await p2;
                const resolved3 = await p3;

                expect(resolved1, which).to.eq('a');
                expect(resolved2, which).to.eq('b');
                expect(resolved3, which).to.eq('c');
            });
        });

        it('Returns a promise when calling `once` without a listener', async () => {

            await doToBoth(async (observer, which) => {

                const promise = observer.once('test');

                observer.emit('test', 'a');

                const resolved = await promise;

                expect(resolved, which).to.eq('a');

                const promise2 = observer.once('test');

                observer.emit('test', 'b');

                const resolved2 = await promise2;

                expect(resolved2, which).to.eq('b');
            })
        });
    });

    describe('observable.observe(...)', async () => {

        before(() => {

            stub.observer = new ObserverFactory(null, {
                spy: stub.spy as any,
                ref: stub.ref
            });

            stub.component = {};

            new ObserverFactory(stub.component, {
                spy: stub.spy as any,
                ref: stub.ref
            });

        })

        afterEach(() => {

            sandbox.resetHistory();
        });

        it('should make child observers', async () => {

            await doToBoth((observed, which) => {

                const someThing: any = {};

                observed.observe(someThing);

                expect(typeof someThing.on, which).to.eq('function');
                expect(typeof someThing.one, which).to.eq('function');
                expect(typeof someThing.off, which).to.eq('function');
                expect(typeof someThing.trigger, which).to.eq('function');
                expect(typeof someThing.cleanup, which).to.eq('function');
            });
        });

        it('should have bidirection emit and listen on child observers', async () => {

            await doToBoth((parent, which) => {

                const child: any = {};

                parent.observe(child);

                const parentFake = sandbox.stub();
                const childFake = sandbox.stub();

                parent.on('test', parentFake);
                child.on('test', childFake);

                parent.trigger('test');
                child.trigger('test');

                expect(parentFake.callCount, which).to.eq(2);
                expect(childFake.callCount, which).to.eq(2);
            });
        });

        it('should remove only child listeners on parent', async () => {

            await doToBoth((parent, which) => {

                const child: any = {};

                parent.observe(child);

                const parentFake = sandbox.stub();
                const childFake = sandbox.stub();

                parent.on('test1', parentFake);
                parent.on('test2', parentFake);
                child.on('test1', childFake);
                child.on('test2', childFake);

                parent.trigger('test1');
                parent.trigger('test2');
                child.trigger('test1');
                child.trigger('test2');

                child.off('*');

                parent.trigger('test1');
                parent.trigger('test2');
                child.trigger('test1');
                child.trigger('test2');

                expect(parentFake.callCount, which).to.eq(8);
                expect(childFake.callCount, which).to.eq(4);
            });

            // This part requires inspecting `$_callbacks`
            const parent = stub.observer;

            const child: any = {};

            parent!.observe(child);

            const parentFake = sandbox.stub();
            const childFake = sandbox.stub();

            parent!.on('test1', parentFake);
            parent!.on('test2', parentFake);
            child.on('test1', childFake);
            child.on('test2', childFake);

            const beforeParentFacts = parent!.$_facts();

            child.off('*');

            const afterParentFacts = parent!.$_facts();

            expect(beforeParentFacts.listeners).to.include.members([
                'test1', 'test2'
            ]);

            expect(afterParentFacts.listeners).to.include.members([
                'test1', 'test2'
            ]);

            expect(beforeParentFacts.listenerCounts.test1).to.eq(2);
            expect(beforeParentFacts.listenerCounts.test2).to.eq(2);

            expect(afterParentFacts.listenerCounts.test1).to.eq(1);
            expect(afterParentFacts.listenerCounts.test2).to.eq(1);
        });


        it('should cleanup child observers', async () => {

            const parent = stub.observer;
            parent?.off('*');

            const child: any = {};

            parent!.observe(child);

            const parentFake = sandbox.stub();
            const childFake = sandbox.stub();

            parent!.on('test1', parentFake);
            parent!.on('test2', parentFake);
            child.on('test1', childFake);
            child.on('test2', childFake);


            const beforeParentFacts = parent!.$_facts();

            child.cleanup();

            const afterParentFacts = parent!.$_facts();

            expect(beforeParentFacts.listeners).to.include.members([
                'test1', 'test2'
            ]);

            expect(afterParentFacts.listeners).to.include.members([
                'test1', 'test2'
            ]);

            expect(beforeParentFacts.listenerCounts.test1).to.eq(2);
            expect(beforeParentFacts.listenerCounts.test2).to.eq(2);

            expect(afterParentFacts.listenerCounts.test1).to.eq(1);
            expect(afterParentFacts.listenerCounts.test2).to.eq(1);
        });
    });

});



