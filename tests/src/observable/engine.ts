import { describe, it, before, afterEach } from 'node:test'

import { expect } from 'chai';

import { ObserverEngine } from '../../../packages/observer/src/index.ts';
import { wait } from '../../../packages/utils/src/index.ts';

import { sandbox } from '../_helpers.ts';

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

const stub = {
    observer: null as unknown as ObserverEngine<AppEvents>,
    spy: sandbox.stub(),
    name: 'test',
    component: {} as any
};

const setupForHelpers = () => {

    const observer = new ObserverEngine<AppEvents>(stub);
    const fake = sandbox.stub();

    observer.on('test', fake);
    observer.on('test', fake);
    observer.on('aa', fake);
    observer.on('ba', fake);
    observer.on(/e/, fake);

    return { observer, fake };
}


describe('@logosdx/observer', function () {

    describe('new ObserverEngine(...)', function () {

        afterEach(() => {

            sandbox.resetHistory();
        });

        it('should create a new observer', function () {

            const observer = new ObserverEngine();

            expect(typeof observer.on).to.eq('function');
            expect(typeof observer.once).to.eq('function');
            expect(typeof observer.off).to.eq('function');
            expect(typeof observer.emit).to.eq('function');
            expect(typeof observer.observe).to.eq('function');
        });

        it('should create a new observer with options', function () {

            stub.observer = new ObserverEngine(stub);

            expect(typeof stub.observer.on).to.eq('function');
            expect(typeof stub.observer.once).to.eq('function');
            expect(typeof stub.observer.off).to.eq('function');
            expect(typeof stub.observer.emit).to.eq('function');
            expect(typeof stub.observer.observe).to.eq('function');
        });

        it('should not have enumerable properties', async () => {

            expect(Object.keys(stub.observer!)).to.have.length(0);
        });

        it('should attach a single listener', async () => {

            const { observer } = stub;
            const fake = sandbox.stub();

            observer.on('test', fake);
            observer.emit('test', 'a');

            const { args: [emitted, info] } = fake.getCall(0);

            expect(emitted, 'args is passed the wrong data').to.eq('a');
            expect(info.event, 'args[info] event is wrong').to.eq('test');
            expect(info.listener, 'args[info] listener is wrong').to.eq(fake);

            expect(fake.calledOnce).to.be.true;
            expect(fake.calledWith('a')).to.be.true;
        });

        it('should remove a single listener', async () => {

            const { observer } = stub;
            const fake1 = sandbox.stub();
            const fake2 = sandbox.stub();

            observer.on('test1', fake1);
            observer.on('test1', fake2);
            observer.emit('test1');
            observer.off('test1', fake2);
            observer.emit('test1');

            expect(fake1.callCount).to.eq(2);
            expect(fake2.callCount).to.eq(1);
        });

        it('should remove all listeners', async () => {

            const { observer } = stub;

            const fake = sandbox.stub();

            observer.on('test1', fake);
            observer.on('test2', fake);
            observer.on('test3', fake);

            observer.off(/.*/i);

            observer.emit('test1');
            observer.emit('test2');
            observer.emit('test3');

            expect(fake.callCount).to.eq(0);
        });

        it('should remove all listeners of a specific event', async () => {

            const { observer } = stub;

            const fake1 = sandbox.stub();
            const fake2 = sandbox.stub();
            const fake3 = sandbox.stub();

            observer.on('test', fake1);
            observer.on('test', fake2);
            observer.on('test', fake3);

            observer.on('test3', fake3);

            observer.emit('test');
            observer.emit('test3');

            observer.off('test');

            observer.emit('test');
            observer.emit('test3');

            expect(fake1.callCount).to.eq(1);
            expect(fake2.callCount).to.eq(1);
            expect(fake3.callCount).to.eq(3);
        });

        it('should not error if event does not exist', async () => {

            const { observer } = stub;

            expect(() => observer.off('pops')).not.to.throw();
        });

        it('should listen only once', async () => {

            const { observer } = stub;
            const fake = sandbox.stub();

            observer.once('test', fake);
            observer.emit('test');
            observer.emit('test');

            expect(fake.calledOnce).to.be.true;
        });

        it('should respect listen once when sharing same listener', async () => {

            const { observer } = stub;
            const fake = sandbox.stub();

            observer.once('test', fake);
            observer.on('test', fake);

            observer.emit('test');
            observer.emit('test');
            observer.emit('test');

            expect(fake.callCount).to.eq(4);
        });

        it('should only listen to listener one time', async () => {

            const { observer } = stub;
            const fake = sandbox.stub();

            observer.on('test', fake);
            observer.on('test', fake);
            observer.on('test', fake);

            observer.emit('test');

            expect(fake.callCount).to.eq(1);
        });

        it('should allow spying on observer functions', async () => {

            const { observer } = stub;

            const fake = sandbox.stub();

            observer.on('test', fake);
            observer.once('test1', fake);
            observer.off('test1', fake);
            observer.emit('test', 1);

            expect(stub.spy.callCount).to.eq(4);
            const calls = stub.spy.getCalls();

            expect(calls[0]!.args[0]).to.include({ fn: 'on', event: 'test', data: null });
            expect(calls[1]!.args[0]).to.include({ fn: 'once', event: 'test1', data: null });
            expect(calls[2]!.args[0]).to.include({ fn: 'off', event: 'test1', data: null });
            expect(calls[3]!.args[0]).to.include({ fn: 'emit', event: 'test', data: 1 });

            const contexts = [
                calls[0]!.args[0].context,
                calls[1]!.args[0].context,
                calls[2]!.args[0].context,
                calls[3]!.args[0].context
            ]

            for (const ctx of contexts) {

                expect(ctx === observer).to.be.true;
            }

            expect(calls[3]!.args[0].data).to.equal(1);

            sandbox.resetHistory();
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


            const { observer } = stub;

            const fakeEv = sandbox.stub();
            const fakeRgx = sandbox.stub();

            const bindEv = () => (

                events.map((e) => observer.on(e as any, fakeEv))
            );

            bindEv();

            observer.on(/a/i, fakeRgx);
            observer.emit('aa', 'works');

            expect(fakeEv.getCalls().length).to.eq(1);
            expect(fakeRgx.getCalls().length).to.eq(1);

            const { args: [emitted] } = fakeRgx.getCall(0);

            expect(emitted.event, 'regex arg.event is the wrong event').to.eq('aa');
            expect(emitted.data, 'regex arg.data is the wrong data').to.eq('works');
            expect(emitted.listener, 'regex arg.listener is the wrong listener').to.eq(fakeRgx);

            /** Test for "a" */

            fakeEv.reset(); fakeRgx.reset();

            observer.emit(/a/i, 'works');

            expect(fakeEv.getCalls().length).to.eq(4);
            expect(fakeRgx.getCalls().length).to.eq(0);

            /** Test for "D" */

            fakeEv.reset(); fakeRgx.reset();
            observer.emit(/d/, 'works');
            expect(fakeEv.getCalls().length).to.eq(0);

            observer.emit(/D/, 'works');
            expect(fakeEv.getCalls().length).to.eq(1);

            /** Test for Z and remove Z based on regex */

            fakeEv.reset(); fakeRgx.reset();
            observer.emit(/z/, 'works');
            expect(fakeEv.getCalls().length).to.eq(3);

            observer.off(/z/);
            observer.emit(/z/, 'works');
            expect(fakeEv.getCalls().length).to.eq(3);

            fakeEv.reset(); fakeRgx.reset();

            /** Removes all callbacks */
            observer.clear();

            observer.emit(/a/i, 'works');
            observer.emit('aa', 'works');

            expect(fakeEv.getCalls().length).to.eq(0);
            expect(fakeRgx.getCalls().length).to.eq(0);

            /** Removes all callbacks */
            fakeEv.reset();

            bindEv();

            observer.on(/.+/, fakeRgx);

            events.map((e) => observer.emit(e as any))

            expect(fakeRgx.getCalls().length).to.eq(events.length);
        });

        it('creates an EventGenerator when calling `on` without a listener', async () => {

            const { observer } = stub;
            const generator = observer.on('test');

            expect(typeof generator).to.eq('object');
            expect(typeof generator.emit).to.eq('function');
            expect(typeof generator.next).to.eq('function');
            expect(typeof generator.cleanup).to.eq('function');

            const promise = generator.next();

            observer.emit('test', 'a');

            const resolved1 = await promise;

            expect(resolved1).to.eq('a');

            const promise2 = generator.next();

            observer.emit('test', 'b');

            const resolved2 = await promise2;

            expect(resolved2).to.eq('b');

            const promise3 = generator.next();

            generator.emit('c');

            const resolved3 = await promise3;

            expect(resolved3).to.eq('c');

            generator.cleanup();

            expect(() => generator.next()).to.throw();
            expect(() => generator.emit()).to.throw();
        });

        it('should return a lastValue', async () => {

            const { observer } = stub;
            const generator = observer.on('test');
            const rgxGenerator = observer.on(/te/);

            expect(generator.lastValue).to.be.null;
            expect(rgxGenerator.lastValue).to.be.null;

            generator.emit('a');

            expect(generator.lastValue).to.eq('a');
            expect(rgxGenerator.lastValue?.data).to.eq('a');
            expect(rgxGenerator.lastValue?.event).to.eq('test');

            generator.emit('b');

            expect(generator.lastValue).to.eq('b');
            expect(rgxGenerator.lastValue?.data).to.eq('b');
            expect(rgxGenerator.lastValue?.event).to.eq('test');

            generator.cleanup();
            rgxGenerator.cleanup();

            expect(generator.lastValue).to.be.null;
            expect(rgxGenerator.lastValue).to.be.null;
        });

        it('should iterate over events', async () => {

            const { observer } = stub;
            const generator = observer.on('test');

            const events: string[] = [];

            const listen = (async () => {

                for await (const event of generator) {

                    events.push(event as never);
                }
            })();

            const onceA = generator.next();
            generator.emit('a');
            await onceA;
            await wait(1);

            const onceB = generator.next();
            generator.emit('b');

            await wait(1);
            await onceB;
            await wait(1);

            const onceC = generator.next();
            generator.emit('c');
            await onceC;

            generator.cleanup();

            await listen;

            expect(events).to.deep.eq(['a', 'b', 'c']);
        });


        it('handles regex with EventGenerators', async () => {

            const { observer } = stub;
            const en = observer.on(/some/);

            const forceEmit = (event: string, val: any) => {

                observer.emit(event as never, val as never);
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

            expect(resolved1.data).to.eq('a');
            expect(resolved1.event).to.eq('something');

            expect(resolved2.data).to.eq('b');
            expect(resolved2.event).to.eq('someone');

            expect(resolved3.data).to.eq('c');
            expect(resolved3.event).to.eq('troublesome');
        });

        it('returns a promise when calling `once` without a listener', async () => {

            const { observer } = stub;

            const promise = observer.once('test');

            observer.emit('test', 'a');

            const resolved = await promise;

            expect(resolved).to.eq('a');

            const promise2 = observer.once('test');

            observer.emit('test', 'b');

            const resolved2 = await promise2;

            expect(resolved2).to.eq('b');
        });

        it('handles regex when calling `once` without a listener', async () => {

            const { observer } = stub;

            const promise = observer.once(/some/);

            observer.emit(
                'something' as never,
                'a' as never
            );

            const resolved = await promise;

            expect(resolved.event).to.eq('something');
            expect(resolved.data).to.eq('a');
        });

        it('listens to everything', async () => {

            const { observer } = stub;
            const fake = sandbox.stub();

            observer.on(/.*/, fake);
            observer.emit('test', 'a');
            observer.emit('test1', 'b');
            observer.emit('test2', 'c');

            expect(fake.callCount).to.eq(3);
        });

        it('listens to everything once', async () => {

            const { observer } = stub;
            const fake = sandbox.stub();

            observer.once(/.*/, fake);
            observer.emit('test', 'a');
            observer.emit('test1', 'b');
            observer.emit('test2', 'c');

            expect(fake.callCount).to.eq(1);
        });

        it('emits to everything', async () => {

            const { observer } = stub;
            const fake = sandbox.stub();

            observer.on('test', fake);
            observer.on('test1', fake);
            observer.on('test2', fake);
            observer.emit(/.*/, 'a');

            expect(fake.callCount).to.eq(3);
        });

        it('tests emit validator', async () => {

            const emitValidator: ObserverEngine.EmitValidator<AppEvents> = (ev, data, ctx) => {

                if (ev === 'child-test' && !ctx.$has('child-test')) {

                    throw new Error('Child does not have any listeners');
                }

                if (Array.isArray(data) && data.length > 2) {

                    throw new Error('Data is too long');
                }
            }

            const observer = new ObserverEngine<AppEvents>({ emitValidator });

            expect(() => observer.emit('child-test'), 'emit validator').to.throw();
            expect(() => observer.emit('aa'), 'emit validator').to.not.throw();

            const stub = sandbox.stub();

            observer.on('child-test', stub);

            expect(
                () => observer.emit('child-test'),
                'emit validator'
            ).to.not.throw();

            expect(
                () => observer.emit('child-test', [1, 2] as never),
                'emit validator'
            ).to.not.throw();

            expect(
                () => observer.emit('child-test', [1, 2, 3] as never),
                'emit validator'
            ).to.throw();

            expect(stub.callCount, 'emit validator').to.eq(2);
        });

        it('provides a helper to see if an event has been bound', async () => {

            const { observer } = setupForHelpers();

            expect(observer.$has('test')).to.be.true;
            expect(observer.$has('aa')).to.be.true;
            expect(observer.$has('ba')).to.be.true;
            expect(observer.$has(/e/)).to.be.true;
            expect(observer.$has('pops')).to.be.false;
        });

        it('provides a helper to see facts about the observer', async () => {

            const { observer } = setupForHelpers()

            const facts = observer.$facts();

            expect(facts.listeners).to.include.members([
                'test', 'aa', 'ba'
            ]);

            expect(facts.rgxListeners).to.include.members([
                '/e/'
            ]);

            expect(facts.listenerCounts.test).to.eq(1);
            expect(facts.listenerCounts.aa).to.eq(1);
            expect(facts.listenerCounts.ba).to.eq(1);
            expect(facts.listenerCounts['/e/']).to.eq(1);

            expect(facts.hasSpy).to.be.true;
        });

        it('provides a helper to see internals of the observer', async () => {


            const { observer, fake } = setupForHelpers()

            const internals = observer.$internals();

            expect(internals.listenerMap).to.be.an.instanceOf(Map);
            expect(internals.listenerMap.size).to.eq(3);
            expect(internals.rgxListenerMap).to.be.an.instanceOf(Map);
            expect(internals.rgxListenerMap.size).to.eq(1);
            expect(internals.listenerMap.get('test')).to.be.an.instanceOf(Set);
            expect(internals.listenerMap.get('test')!.size).to.eq(1);
            expect(internals.listenerMap.get('aa')!.size).to.eq(1);
            expect(internals.listenerMap.get('ba')!.size).to.eq(1);
            expect(internals.rgxListenerMap.get('/e/')).to.be.an.instanceOf(Set);

            const lTest = internals.listenerMap.get('test')!.values();
            const lValue = lTest.next().value;

            expect(lValue).to.be.a('function');
            expect(lValue).to.eq(fake);

            const rgxTest = internals.rgxListenerMap.get('/e/')!.values();
            const rgxValue = rgxTest.next().value;

            expect(rgxValue).to.be.a('function');
            expect(rgxValue).to.eq(fake);
        });
    });

    describe('observable.observe(...)', async () => {

        before(() => {

            stub.observer = new ObserverEngine({
                spy: stub.spy as any,
            });

            stub.component = {};

            stub.observer.observe(stub.component);

        })

        afterEach(() => {

            sandbox.resetHistory();
        });

        it('should make child observers', async () => {

            const { observer } = stub;
            const someThing: any = {};

            observer.observe(someThing);

            expect(typeof someThing.on).to.eq('function');
            expect(typeof someThing.once).to.eq('function');
            expect(typeof someThing.off).to.eq('function');
            expect(typeof someThing.emit).to.eq('function');
            expect(typeof someThing.cleanup).to.eq('function');
        });

        it('should have bidirection emit and listen on child observers', async () => {

            const parent = stub.observer!;

            const child: any = {};

            parent.observe(child);

            const parentFake = sandbox.stub();
            const childFake = sandbox.stub();

            parent.on('test', parentFake);
            child.on('test', childFake);

            parent.emit('test');
            child.emit('test');

            expect(parentFake.callCount).to.eq(2);
            expect(childFake.callCount).to.eq(2);
        });

        it('should remove only child listeners on parent', async () => {

            const parent = stub.observer!;

            const child1: any = {};

            parent.observe(child1);

            const parentFake = sandbox.stub();
            const childFake = sandbox.stub();

            parent.on('test1', parentFake);
            parent.on('test2', parentFake);
            child1.on('test1', childFake);
            child1.on('test2', childFake);

            parent.emit('test1');
            parent.emit('test2');
            child1.emit('test1');
            child1.emit('test2');

            child1.clear();

            parent.emit('test1');
            parent.emit('test2');
            child1.emit('test1');
            child1.emit('test2');

            expect(parentFake.callCount).to.eq(8);
            expect(childFake.callCount).to.eq(4);

            parentFake.reset();
            childFake.reset();


            // This part requires inspecting `#callbacks`

            const child2: any = {};

            parent!.observe(child2);

            parent!.on('test1', parentFake);
            parent!.on('test2', parentFake);
            child2.on('test1', childFake);
            child2.on('test2', childFake);

            const beforeParentFacts = parent!.$facts();

            child2.clear();

            const afterParentFacts = parent!.$facts();

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
            parent?.clear();

            const child: any = {};

            parent!.observe(child);

            const parentFake = sandbox.stub();
            const childFake = sandbox.stub();

            parent!.on('test1', parentFake);
            parent!.on('test2', parentFake);
            child.on('test1', childFake);
            child.on('test2', childFake);


            const beforeParentFacts = parent!.$facts();

            child.cleanup();

            const afterParentFacts = parent!.$facts();

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

    describe('extends ObserverEngine', async () => {

        interface MyThingEvents {
            test: string
        }

        class MyThing extends ObserverEngine<MyThingEvents> {
            myProp: string;

            constructor(myProp: string) {
                super();
                this.myProp = myProp;
            }
        }

        it('should extend from observer engine', async () => {

            const observer = new MyThing('test');

            expect(observer.myProp).to.eq('test');

            observer.on('test', () => { });
            observer.emit('test', 'a');

        });
    });
});

