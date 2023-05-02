import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { RiotComponent } from 'riot';

import {
    mkHook,
    makeOnBeforeMount,
    makeOnMounted,
    makeOnBeforeUpdate,
    makeOnUpdated,
    makeOnBeforeUnmount,
    makeOnUnmounted,
    mergeState,
    makeQueryable,
    QueryableComponent,
    RiotComponentExport
} from '@logos-ui/riot-utils';
import { Func } from '@logos-ui/utils';


type TestState = {
    something: string
}

type FakeComp = {

    someFunction?: Func,
    fake1?: Func,
    fake2?: Func,
}

type FakeRiotComp = RiotComponentExport<FakeComp, {}, TestState>;
type FakeRealComp = RiotComponent<{}, TestState>;

const makeComponent = (): (
    Partial<
        QueryableComponent<FakeRiotComp, TestState>
    > &
    FakeRiotComp &
    {
        state: FakeRealComp['state'],
        update: SinonStub<Parameters<FakeRealComp['update']>>
    }
) => ({
    state: { something: 'intheway' },
    update: sinon.stub()
});
describe('@logos-ui/riot-utils', function () {

    describe('hooks', () => {

        afterEach(() => {

            sinon.resetHistory();
        });

        it('should make custom hooks', function () {

            const original = sinon.stub();
            const override = sinon.stub();

            const hook = mkHook('onBeforeMount');

            const component = {
                onBeforeMount: original
            };

            hook({ component, callback: override });

            component.onBeforeMount();

            expect(original.calledOnce).to.be.true;
            expect(override.calledOnce).to.be.true;
        });

        it('should not error if hook does not exist', () => {

            const override = sinon.stub();

            const hook = mkHook('onBeforeMount');

            const component: any = {};

            hook({ component, callback: override });

            expect(() => component.onBeforeMount()).not.to.throw();
            expect(override.calledOnce).to.be.true;
        });

        it('should run hooks before or after', function () {

            const original = sinon.stub();
            const before = sinon.stub();
            const after = sinon.stub();

            const hook = mkHook('onBeforeMount');

            const component = {
                onBeforeMount: original
            };


            hook({ component, callback: before });

            component.onBeforeMount();
            expect(before.calledOnce, 'runBefore - before').to.be.true;
            expect(after.calledOnce, 'runBefore - after').to.be.false;

            sinon.resetHistory();

            component.onBeforeMount = original;

            hook({ component, callback: after, runAfterOriginal: true });

            component.onBeforeMount();
            expect(before.calledOnce, 'runAfter - before').to.be.false;
            expect(after.calledOnce, 'runAfter - after').to.be.true;
        });

        it('should make riot lifecycle hooks', () => {

            const original = sinon.stub();
            const override = sinon.stub();

            const hooks = [
                'onBeforeMount',
                'onMounted',
                'onBeforeUpdate',
                'onUpdated',
                'onBeforeUnmount',
                'onUnmounted'
            ];

            const component: any = {};

            for (const hook of hooks) {

                component[hook] = original;
            }

            makeOnBeforeMount({ component, callback: override });
            makeOnMounted({ component, callback: override });
            makeOnBeforeUpdate({ component, callback: override });
            makeOnUpdated({ component, callback: override });
            makeOnBeforeUnmount({ component, callback: override });
            makeOnUnmounted({ component, callback: override });

            component.onBeforeMount();
            component.onMounted();
            component.onBeforeUpdate();
            component.onUpdated();
            component.onBeforeUnmount();
            component.onUnmounted();

            expect(original.callCount).to.eq(6);
            expect(override.callCount).to.eq(6);
        });

        it('should merge a components state', () => {

            const component: any = {
                state: { pepe: true }
            };

            mergeState(component, { pupu: 'papa' });

            expect(component.state).to.include({
                pepe: true,
                pupu: 'papa'
            });
        });
    });

    describe('makeQueryable(...)', function () {

        it('should merge existing state with queryable state', function () {

            const queryable = makeQueryable(makeComponent());

            expect(queryable.state).to.contain({
                isFetching: false,
                fetchError: null,
                fetchData: null,
                something: 'intheway'
            })
        });

        it('should set loading to true when setFetching', async () => {

            const component = makeQueryable(makeComponent());

            expect(component.setFetching).to.be.a('function');

            const fake = sinon.stub().resolves({ some: 'state' });

            await component.setFetching(fake);

            sinon.assert.calledOnce(fake);

            const update = component.update as SinonStub;


            expect(
                update.calledWith({
                    isFetching: true,
                    fetchError: null,
                    fetchData: null,
                })
            ).to.be.true;

            expect(
                update.calledWith({
                    isFetching: false,
                    fetchError: null,
                    fetchData: { some: 'state' }
                })
            ).to.be.true;

        });

        it('should capture errors thrown when setFetching', async () => {

            const component = makeQueryable(makeComponent());

            const fake = sinon.stub().rejects(Error('some error'));

            await component.setFetching(fake);

            const update = component.update as SinonStub;

            sinon.assert.calledWith(
                update,
                { isFetching: true, fetchError: null, fetchData: null }
            );

            const { args: [call]} = update.getCall(1);

            expect(call).to.contain({ isFetching: false });
            expect(call.fetchError.message).to.eq('some error');
        });

        it('should convert a function into a fetchable function', async () => {

            const component = makeQueryable(makeComponent());

            const fake = sinon.stub().returns({ some: 'state' });

            component.someFunction = component.fnWillFetch(fake);

            await component.someFunction!('a', 'b', 'c');

            const update = component.update as SinonStub;


            sinon.assert.calledWithExactly(
                update,
                { isFetching: true, fetchError: null, fetchData: null }
            );

            sinon.assert.calledWithExactly(
                update,
                { isFetching: false, fetchError: null, fetchData: { some: 'state' } }
            );

            sinon.assert.calledWithExactly(
                fake,
                'a', 'b', 'c'
            );
        });

        it('should convert an array of functions into fetchables', async () => {

            const component = makeComponent();

            const fake1 = sinon.stub().returns({ some: 'state' });
            const fake2 = sinon.stub().returns({ soom: 'staat' });

            component.fake1 = fake1;
            component.fake2 = fake2;

            component.fetchable = ['fake1', 'fake2'];

            const queryable = makeQueryable(component);

            await queryable.fake1!();
            await queryable.fake2!();

            const update = component.update as SinonStub;

            const [[load1], [res1], [load2], [res2]] = update.args;

            expect(load1).to.include({ isFetching: true, fetchError: null });
            expect(load2).to.include({ isFetching: true, fetchError: null });


            expect(res1).to.include({
                isFetching: false,
                fetchError: null,
            });

            expect(res1.fetchData).to.include({ some: 'state' });

            expect(res2).to.include({
                isFetching: false,
                fetchError: null,
            });

            expect(res2.fetchData).to.include({ soom: 'staat' });
        });

        it('should toggle fetching', async () => {

            const component = makeQueryable(makeComponent());

            const update = component.update as SinonStub;

            component.toggleFetching();

            sinon.assert.calledWith(update, { isFetching: true });

            component.toggleFetching(false);
            sinon.assert.calledWith(update, { isFetching: false });

            component.toggleFetching(false);
            sinon.assert.calledWith(update, { isFetching: false });

            component.toggleFetching(true);
            sinon.assert.calledWith(update, { isFetching: true });

            component.toggleFetching(true);
            sinon.assert.calledWith(update, { isFetching: true });

            component.toggleFetching();
            sinon.assert.calledWith(update, { isFetching: false });
        });

        it('should initialize with a fetching state', () => {

            const component = makeComponent();

            component.state.isFetching = true;

            const queryable = makeQueryable(component);

            expect(queryable.state.isFetching).to.be.true;

        })
    });
});



