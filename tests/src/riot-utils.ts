import { describe, it, before, beforeEach, after, afterEach } from 'node:test'
import { expect } from 'chai';
import { SinonStub } from 'sinon';

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
import { sandbox } from './_helpers';
type TestState = {
    something: string
}

type FakeComp = {

    someFunction?: Func,
    fake1: Func,
    fake2: Func,
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
    update: sandbox.stub(),
    fake1: () => {},
    fake2: () => {},
});
describe('@logos-ui/riot-utils', function () {

    describe('hooks', () => {

        afterEach(() => {

            sandbox.resetHistory();
        });

        it('should make custom hooks', function () {

            const original = sandbox.stub();
            const override = sandbox.stub();

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

            const override = sandbox.stub();

            const hook = mkHook('onBeforeMount');

            const component: any = {};

            hook({ component, callback: override });

            expect(() => component.onBeforeMount()).not.to.throw();
            expect(override.calledOnce).to.be.true;
        });

        it('should run hooks before or after', function () {

            const original = sandbox.stub();
            const before = sandbox.stub();
            const after = sandbox.stub();

            const hook = mkHook('onBeforeMount');

            const component = {
                onBeforeMount: original
            };


            hook({ component, callback: before });

            component.onBeforeMount();
            expect(before.calledOnce, 'runBefore - before').to.be.true;
            expect(after.calledOnce, 'runBefore - after').to.be.false;

            sandbox.resetHistory();

            component.onBeforeMount = original;

            hook({ component, callback: after, runAfterOriginal: true });

            component.onBeforeMount();
            expect(before.calledOnce, 'runAfter - before').to.be.false;
            expect(after.calledOnce, 'runAfter - after').to.be.true;
        });

        it('should make riot lifecycle hooks', () => {

            const original = sandbox.stub();
            const override = sandbox.stub();

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
                isQuerying: false,
                queryError: null,
                queryData: null,
                something: 'intheway'
            })
        });

        it('should set loading to true when setQuerying', async () => {

            const component = makeQueryable(makeComponent());

            expect(component.setQuerying).to.be.a('function');

            const fake = sandbox.stub().resolves({ some: 'state' });

            await component.setQuerying(fake);

            sandbox.assert.calledOnce(fake);

            const update = component.update as SinonStub;


            expect(
                update.calledWith({
                    isQuerying: true,
                    queryError: null,
                    queryData: null,
                })
            ).to.be.true;

            expect(
                update.calledWith({
                    isQuerying: false,
                    queryError: null,
                    queryData: { some: 'state' }
                })
            ).to.be.true;

        });

        it('should capture errors thrown when setQuerying', async () => {

            const component = makeQueryable(makeComponent());

            const fake = sandbox.stub().rejects(Error('some error'));

            await component.setQuerying(fake);

            const update = component.update as SinonStub;

            sandbox.assert.calledWith(
                update,
                { isQuerying: true, queryError: null, queryData: null }
            );

            const { args: [call]} = update.getCall(1);

            expect(call).to.contain({ isQuerying: false });
            expect(call.queryError.message).to.eq('some error');
        });

        it('should convert a function into a queryable function', async () => {

            const component = makeQueryable(makeComponent());

            const fake = sandbox.stub().returns({ some: 'state' });

            component.someFunction = component.fnWillQuery(fake);

            await component.someFunction!('a', 'b', 'c');

            const update = component.update as SinonStub;


            sandbox.assert.calledWithExactly(
                update,
                { isQuerying: true, queryError: null, queryData: null }
            );

            sandbox.assert.calledWithExactly(
                update,
                { isQuerying: false, queryError: null, queryData: { some: 'state' } }
            );

            sandbox.assert.calledWithExactly(
                fake,
                'a', 'b', 'c'
            );
        });

        it('should convert an array of functions into queryables', async () => {

            const component = makeComponent();

            const fake1 = sandbox.stub().returns({ some: 'state' });
            const fake2 = sandbox.stub().returns({ soom: 'staat' });

            component.fake1 = fake1;
            component.fake2 = fake2;

            component.queryable = ['fake1', 'fake2'];

            const queryable = makeQueryable(component);

            await queryable.fake1!();
            await queryable.fake2!();

            const update = component.update as SinonStub<FakeRealComp['state'][]>;

            type TState = QueryableComponent<FakeRiotComp, TestState>['state'];

            const [[load1], [res1], [load2], [res2]] = update.args as [[TState], [TState], [TState], [TState]];

            expect(load1).to.include({ isQuerying: true, queryError: null });
            expect(load2).to.include({ isQuerying: true, queryError: null });

            expect(res1).to.include({
                isQuerying: false,
                queryError: null,
            });

            expect(res1.queryData).to.include({ some: 'state' });

            expect(res2).to.include({
                isQuerying: false,
                queryError: null,
            });

            expect(res2.queryData).to.include({ soom: 'staat' });
        });

        it('should toggle querying', async () => {

            const component = makeQueryable(makeComponent());

            const update = component.update as SinonStub;

            component.toggleQuerying();

            sandbox.assert.calledWith(update, { isQuerying: true });

            component.toggleQuerying(false);
            sandbox.assert.calledWith(update, { isQuerying: false });

            component.toggleQuerying(false);
            sandbox.assert.calledWith(update, { isQuerying: false });

            component.toggleQuerying(true);
            sandbox.assert.calledWith(update, { isQuerying: true });

            component.toggleQuerying(true);
            sandbox.assert.calledWith(update, { isQuerying: true });

            component.toggleQuerying();
            sandbox.assert.calledWith(update, { isQuerying: false });
        });

        it('should initialize with a querying state', () => {

            const component = makeComponent();

            component.state.isQuerying = true;

            const queryable = makeQueryable(component);

            expect(queryable.state.isQuerying).to.be.true;

        })
    });
});



