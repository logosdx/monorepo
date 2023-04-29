import { expect } from 'chai';
import sinon from 'sinon';

import { Observable } from '@logos-ui/observer';

interface ObservableEvents {
    test: string | number
    test1: string
    test2: string
    test3: string
    pooop: string

    aa: string
    ba: string
    bc: string
    cda: string
    zo: string
    zu: string
    za: string

    'child-test': string
}


const stub: {
    observer?: Observable<any, ObservableEvents, 'child'>,
    component?: any,
    spy: sinon.SinonStub,
    ref: string
} = {
    spy: sinon.stub(),
    ref: 'test'
};

interface RunTestOnBoth {
    (observed: Observable<any, ObservableEvents, 'child'>, which: string): void
}

const doToBoth = (fn: RunTestOnBoth) => {

    fn(stub.observer!, 'observer');
    fn(stub.component, 'component');

    stub.observer!.off('*');
    stub.component.off('*');
};
describe('@logos-ui/observer', function () {

    describe('new Observable(...)', function () {

        afterEach(() => {

            sinon.resetHistory();
        });

        it('should create a new observer', function () {

            const observer = new Observable();

            expect(typeof observer.on).to.eq('function');
            expect(typeof observer.one).to.eq('function');
            expect(typeof observer.off).to.eq('function');
            expect(typeof observer.trigger).to.eq('function');
            expect(typeof observer.observe).to.eq('function');
        });

        it('should create a new observer with options', function () {

            stub.observer = new Observable(null, {
                spy: stub.spy,
                ref: stub.ref
            });

            expect(typeof stub.observer.on).to.eq('function');
            expect(typeof stub.observer.one).to.eq('function');
            expect(typeof stub.observer.off).to.eq('function');
            expect(typeof stub.observer.trigger).to.eq('function');
            expect(typeof stub.observer.observe).to.eq('function');
        });

        it('should add an observable API to an existing component', () => {

            stub.component = {};

            expect(typeof stub.component.on).to.eq('undefined');
            expect(typeof stub.component.one).to.eq('undefined');
            expect(typeof stub.component.off).to.eq('undefined');
            expect(typeof stub.component.trigger).to.eq('undefined');
            expect(typeof stub.component.observe).to.eq('undefined');

            new Observable(stub.component, {
                spy: stub.spy,
                ref: stub.ref
            });

            expect(typeof stub.component.on).to.eq('function');
            expect(typeof stub.component.one).to.eq('function');
            expect(typeof stub.component.off).to.eq('function');
            expect(typeof stub.component.trigger).to.eq('function');
            expect(typeof stub.component.observe).to.eq('function');
        });

        it('should not have enumerable properties', () => {

            console.log(Object.keys(stub.observer));

            doToBoth((observed, which) => {

                expect(Object.keys(observed), which).to.have.length(0);
            });
        });

        it('should attach a single listener', () => {


            doToBoth((observed, which) => {

                const fake = sinon.stub();

                observed.on('test', fake);

                observed.trigger('test', 'a');

                expect(fake.calledOnce, which).to.be.true;
                expect(fake.calledWith('a'), which).to.be.true;
            });
        });

        it('should remove a single listener', () => {

            doToBoth((observed, which) => {

                const fake1 = sinon.stub();
                const fake2 = sinon.stub();

                observed.on('test1', fake1);
                observed.on('test1', fake2);

                observed.trigger('test1');

                observed.off('test1', fake2);

                observed.trigger('test1');

                expect(fake1.callCount, which).to.eq(2);
                expect(fake2.callCount, which).to.eq(1);
            });
        });

        it('should remove all listeners', () => {

            doToBoth((observed, which) => {

                const fake = sinon.stub();

                observed.on('test1', fake);
                observed.on('test2', fake);
                observed.on('test3', fake);

                observed.off('*');

                observed.trigger('test1');
                observed.trigger('test2');
                observed.trigger('test3');

                expect(fake.callCount, which).to.eq(0);
            });
        });

        it('should remove all listeners of a specific event', () => {

            doToBoth((observed, which) => {

                const fake1 = sinon.stub();
                const fake2 = sinon.stub();
                const fake3 = sinon.stub();

                observed.on('test', fake1);
                observed.on('test', fake2);
                observed.on('test', fake3);

                observed.on('test3', fake3);

                observed.trigger('test');
                observed.trigger('test3');

                observed.off('test');

                observed.trigger('test');
                observed.trigger('test3');

                expect(fake1.callCount, which).to.eq(1);
                expect(fake2.callCount, which).to.eq(1);
                expect(fake3.callCount, which).to.eq(3);
            });
        });

        it('should not error if event does not exist', () => {

            doToBoth((observed, which) => {

                expect(() => observed.off('pooop'), which).not.to.throw();
            });
        });

        it('should listen only once', () => {

            doToBoth((observed, which) => {


                const fake = sinon.stub();

                observed.one('test', fake);

                observed.trigger('test');
                observed.trigger('test');

                expect(fake.calledOnce, which).to.be.true;
            });
        });

        it('should respect listen once when sharing same listener', () => {

            doToBoth((observed, which) => {

                const fake = sinon.stub();

                observed.one('test', fake);
                observed.on('test', fake);

                observed.trigger('test');
                observed.trigger('test');
                observed.trigger('test');

                expect(fake.callCount, which).to.eq(4);
            });
        });

        it('should only listen to listener one time', () => {

            doToBoth((observed, which) => {

                const fake = sinon.stub();

                observed.on('test', fake);
                observed.on('test', fake);
                observed.on('test', fake);

                observed.trigger('test');

                expect(fake.callCount, which).to.eq(1);
            });
        });

        it('should allow spying on observer functions', () => {

            doToBoth((observed, which) => {

                const fake = sinon.stub();

                observed.on('test', fake);
                observed.one('test1', fake);
                observed.off('test1', fake);
                observed.trigger('test', 1);

                expect(stub.spy.callCount, which).to.eq(5);
                const calls = stub.spy.getCalls();

                expect(calls[0].args[0], which).to.include({ fn: 'on', event: 'test', data: null });
                expect(calls[1].args[0], which).to.include({ fn: 'one', event: 'test1', data: null });
                expect(calls[2].args[0], which).to.include({ fn: 'on', event: 'test1', data: null });
                expect(calls[3].args[0], which).to.include({ fn: 'off', event: 'test1', data: null });
                expect(calls[4].args[0], which).to.include({ fn: 'trigger', event: 'test', data: 1 });

                const contexts = [
                    calls[0].args[0].context,
                    calls[1].args[0].context,
                    calls[2].args[0].context,
                    calls[3].args[0].context,
                    calls[4].args[0].context
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

                expect(calls[4].args[0].data).to.equal(1);

                sinon.resetHistory();
            });
        });

        it('should allow listening to events based on regex', () => {

            const events = [
                'aa', // a x 4
                'ba', // b x 2
                'bc', // c x 2
                'cDa', // D x 1
                'zo', // z x 3
                'zu',
                'za'
            ];

            doToBoth((observed, which) => {

                const fakeEv = sinon.stub();
                const fakeRgx = sinon.stub();

                const bindEv = () => (

                    events.map((e) => observed.on(e as any, fakeEv))
                );

                bindEv();

                observed.on(/a/i, fakeRgx);
                observed.trigger('aa', 'works');

                expect(fakeEv.getCalls().length, which).to.eq(1);
                expect(fakeRgx.getCalls().length, which).to.eq(1);

                /** Test for "a" */

                fakeEv.reset(); fakeRgx.reset();

                observed.trigger(/a/i, 'works');

                expect(fakeEv.getCalls().length, which).to.eq(4);
                expect(fakeRgx.getCalls().length, which).to.eq(0);

                /** Test for "D" */

                fakeEv.reset(); fakeRgx.reset();
                observed.trigger(/d/, 'works');
                expect(fakeEv.getCalls().length, which).to.eq(0);

                observed.trigger(/D/, 'works');
                expect(fakeEv.getCalls().length, which).to.eq(1);

                /** Test for Z and remove Z based on regex */

                fakeEv.reset(); fakeRgx.reset();
                observed.trigger(/z/, 'works');
                expect(fakeEv.getCalls().length, which).to.eq(3);

                observed.off(/z/);
                observed.trigger(/z/, 'works');
                expect(fakeEv.getCalls().length, which).to.eq(3);

                fakeEv.reset(); fakeRgx.reset();

                /** Removes all callbacks */
                observed.off('*');

                observed.trigger(/a/i, 'works');
                observed.trigger('aa', 'works');

                expect(fakeEv.getCalls().length, which).to.eq(0);
                expect(fakeRgx.getCalls().length, which).to.eq(0);

                /** Removes all callbacks */
                fakeEv.reset();

                bindEv();

                observed.on(/.+/, fakeRgx);

                events.map((e) => observed.trigger(e as any))

                expect(fakeRgx.getCalls().length, which).to.eq(events.length);
            });
        });
    });

    describe('observable.observe(...)', () => {

        afterEach(() => {

            sinon.resetHistory();
        });

        it('should make child observers', () => {

            doToBoth((observed, which) => {

                const someThing: any = {};

                observed.observe(someThing);

                expect(typeof someThing.on, which).to.eq('function');
                expect(typeof someThing.one, which).to.eq('function');
                expect(typeof someThing.off, which).to.eq('function');
                expect(typeof someThing.trigger, which).to.eq('function');
                expect(typeof someThing.cleanup, which).to.eq('function');
            });
        });

        it('should have bidirection emit and listen on child observers', () => {

            doToBoth((parent, which) => {

                const child: any = {};

                parent.observe(child);

                const parentFake = sinon.stub();
                const childFake = sinon.stub();

                parent.on('test', parentFake);
                child.on('test', childFake);

                parent.trigger('test');
                child.trigger('test');

                expect(parentFake.callCount, which).to.eq(2);
                expect(childFake.callCount, which).to.eq(2);
            });
        });

        it('should have prefixed listeners child observers', () => {

            doToBoth((parent, which) => {

                const child: any = {};

                parent.observe(child, 'child');

                const parentFake = sinon.stub();
                const childFake = sinon.stub();

                parent.on('test', parentFake);
                child.on('test', childFake);

                parent.trigger('test');
                child.trigger('test');

                expect(parentFake.callCount, which).to.eq(1);
                expect(childFake.callCount, which).to.eq(1);

                parent.trigger('child-test');

                expect(parentFake.callCount, which).to.eq(1);
                expect(childFake.callCount, which).to.eq(2);
            });
        });

        it('should remove only child listeners on parent', () => {

            doToBoth((parent, which) => {

                const child: any = {};

                parent.observe(child);

                const parentFake = sinon.stub();
                const childFake = sinon.stub();

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

            parent!.observe(child, 'child');

            const parentFake = sinon.stub();
            const childFake = sinon.stub();

            parent!.on('test1', parentFake);
            parent!.on('test2', parentFake);
            child.on('test1', childFake);
            child.on('test2', childFake);

            const beforeOff = [...parent!.$_listenerMap.keys()];

            child.off('*');

            const afterOff = [...parent!.$_listenerMap.keys()];

            expect(beforeOff).to.include.members([
                'child-test1', 'child-test2'
            ]);

            expect(afterOff).not.to.include.members([
                'child-test1', 'child-test2'
            ]);

            expect(afterOff).to.include.members([
                'test1', 'test2'
            ]);
        });


        it('should cleanup child observers', () => {

            const parent = stub.observer;

            const child: any = {};

            parent!.observe(child, 'child');

            const parentFake = sinon.stub();
            const childFake = sinon.stub();

            parent!.on('test1', parentFake);
            parent!.on('test2', parentFake);
            child.on('test1', childFake);
            child.on('test2', childFake);

            const beforeOff = [...parent!.$_listenerMap.keys()];

            child.cleanup();

            const afterOff = [...parent!.$_listenerMap.keys()];

            expect(beforeOff).to.include.members([
                'child-test1', 'child-test2'
            ]);

            expect(afterOff).not.to.include.members([
                'child-test1', 'child-test2'
            ]);

            expect(afterOff).to.include.members([
                'test1', 'test2'
            ]);
        });

    });
});



