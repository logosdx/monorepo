import * as RiotKit from '@logos-ui/riot-kit';

import { expect } from 'chai';
import sinon from 'sinon';

describe('@logos-ui/riot-kit', () => {

    const install = sinon.stub();

    type AppEventsType = {
        'mint': (
            'spearmint' |
            'peppermint'
        ),
        'toothpaste': { colgate?: boolean, crest?: boolean },
        floss: boolean
    }

    const locale = {
        some: {
            label: 'wee'
        },
        poo: 'weenie',
        bear: '{type} bear'
    };

    type AppLocaleType = typeof locale;
    type LocaleCodes = 'en' | 'es';

    const locales: RiotKit.ManyLocales<AppLocaleType, LocaleCodes> = {
        en: { code: 'en', text: 'English', labels: locale },
        es: { code: 'es', text: 'Spanish', labels: { bear: 'oso {type}' } },
    }

    const initialState = {
        count: 0,
        name: '',
        age: 0,
    };

    type AppStateType = typeof initialState;

    const stateReducer: RiotKit.ReducerFunction<AppStateType> = (val, state) => {

        return RiotKit.merge(state, val);
    }

    type AppStorageType = {
        name: string,
        age: number
        s1: { s1: boolean }
    };

    type AppKitType = {
        eventsType: AppEventsType,
        storageType: AppStorageType,
        locales: {
            localeType: AppLocaleType,
            codes: LocaleCodes
        },
        stateMachine: {
            stateType: AppStateType,
            reducerValType: AppStateType
        },
        fetch: {
            stateType: {
                authToken: string
            },
            headersType: {
                authorization?: string,
                hmac?: string,
                timestamp?: string
            }
        }
    };

    const localesOpts: any = {
        current: 'en',
        fallback: 'en',
        locales
    };

    const observerOpts = {};

    const stateMachineOpts = {
        initial: initialState,
        reducer: stateReducer
    };

    const storageOpts = {
        implementation: window.localStorage,
        prefix: 'kit'
    };

    const fetchOpts: any = {
        baseUrl: 'http://localhost:1234',
        type: 'json',
        headers: {}
    };

    let app: ReturnType<typeof RiotKit.riotKit<AppKitType>> = null;

    it('provides an riotKit', function () {

        expect(RiotKit.riotKit).to.be.a('function');

        app = RiotKit.riotKit<AppKitType>({
            riotInstallFunction: install,
            fetch: fetchOpts,
            locales: localesOpts,
            observer: observerOpts,
            stateMachine: stateMachineOpts,
            storage: storageOpts
        });

        expect(app.observer).to.exist;
        expect(app.locale).to.exist;
        expect(app.stateMachine).to.exist;
        expect(app.storage).to.exist;
        expect(app.fetch).to.exist;


        expect(app.observer).to.have.property('on');
        expect(app.observer).to.have.property('one');
        expect(app.observer).to.have.property('off');
        expect(app.observer).to.have.property('trigger');

        expect(app.locale).to.be.an.instanceOf(RiotKit.LocaleFactory);
        expect(app.stateMachine).to.be.an.instanceOf(RiotKit.StateMachine);
        expect(app.storage).to.be.an.instanceOf(RiotKit.StorageFactory);
        expect(app.fetch).to.be.an.instanceOf(RiotKit.FetchFactory);

        expect(install.calledOnce).to.be.true;

        const [[decorator]] = install.args;

        expect(decorator).to.be.a('function');

    });

    it('decorates an observable component', () => {

        const [[decorator]] = install.args;

        const observ = { observable: true };

        const observDeco = decorator(observ);

        expect(observDeco.on).to.be.a('function');
        expect(observDeco.one).to.be.a('function');
        expect(observDeco.off).to.be.a('function');
        expect(observDeco.trigger).to.be.a('function');
    });

    it('decorates mapToState', () => {

        const [[decorator]] = install.args;

        const update = sinon.stub();
        const stated = {
            state: { test: true, count: null },
            update(...args: any) {

                RiotKit.merge(stated.state, args[0]);

                return update.apply(this, args);
            },
            mapToState(aState, cState) {

                return RiotKit.applyDefaults({}, cState, aState);
            }
        };

        const statedDeco = decorator(stated);

        expect(statedDeco.onUpdated).to.be.a('function');
        expect(statedDeco.onBeforeMount).to.be.a('function');
        expect(statedDeco.onBeforeUnmount).to.be.a('function');

        expect(stated.state).to.not.include.keys(
            'count',
            'name',
            'age'
        );

        expect(stated.state.count).to.eq(null);

        statedDeco.onBeforeMount({}, stated.state);

        expect(stated.state).to.include.keys(
            'count',
            'name',
            'age'
        );

        expect(stated.state.count).to.eq(0);

        app.stateMachine.dispatch({ count: 99 });
        expect(update.callCount).to.eq(1);
        expect(stated.state.count).to.equal(99);

        app.stateMachine.dispatch({ count: 95 });
        expect(update.callCount).to.eq(2);
        expect(stated.state.count).to.equal(95);

        statedDeco.onBeforeUnmount({}, stated.state);
        app.stateMachine.dispatch({ count: 90 });

        expect(stated.state.count).to.equal(95);
        expect(update.callCount).to.eq(2);
    });

    it('decorates locales', () => {

        const [[decorator]] = install.args;

        const update = sinon.stub();

        const l10n = {
            translatable: true,
            update
        };

        const l10nDeco = decorator(l10n);

        expect(l10nDeco.t).to.be.a('function');
        expect(l10nDeco.onBeforeMount).to.be.a('function');
        expect(l10nDeco.onBeforeUnmount).to.be.a('function');

        l10nDeco.onBeforeMount();

        expect(update.callCount, 'before change').to.eq(0);

        app.locale.changeTo('es');
        expect(update.callCount, 'after change').to.eq(1);

        app.locale.changeTo('es');
        expect(update.callCount, 'no change').to.eq(1);

        l10nDeco.onBeforeUnmount();

        app.locale.changeTo('en');
        expect(update.callCount, 'after unmount').to.eq(1);
    });

    it('decorates storage', () => {

        const [[decorator]] = install.args;

        const s1 = {
            saveInKey: 's1',
            state: { s1: null }
        };

        const s2 = {
            loadStorage: ['age', 'name'],
            state: {}
        }

        const s1Deco = decorator(s1);
        const s2Deco = decorator(s2);

        expect(s1Deco.onBeforeMount).to.be.a('function');
        expect(s1Deco.onUpdated).to.be.a('function');
        expect(s2Deco.onBeforeMount).to.be.a('function');
        expect(s2Deco.onUpdated).to.be.a('function');

        const age = 300;
        const name = 'pepe';
        const s1State = { s1: true };

        app.storage.set({ age, name, s1: s1State });

        expect(s1.state).to.not.include(s1State);

        s1Deco.onBeforeMount();

        expect(s1.state).to.include(s1State);

        expect(s2.state).to.not.include({ name, age });

        s2Deco.onBeforeMount();

        expect(s2.state).to.include({ name, age });


        expect(app.storage.get('s1')).to.include({ s1: true });
        s1Deco.onUpdated({}, { s1: false });

        expect(app.storage.get('s1')).to.include({ s1: false });
    });

    it ('decorates fetchable', () => {

        const [[decorator]] = install.args;

        const someFn = sinon.stub();
        const otherFn = sinon.stub();
        const update = sinon.stub();

        const f = {
            state: {},
            someFn,
            otherFn,
            update,
            fetchable: ['someFn']
        };

        const fDeco = decorator(f);

        expect(fDeco.someFn === someFn).to.be.false;
        expect(fDeco.otherFn === otherFn).to.be.true;

        expect(fDeco.state).to.include({
            isFetching: false,
            fetchError: null,
            fetchData: null
        });

        expect(fDeco.setFetching, 'decorated setFetching').to.be.a('function');
        expect(fDeco.fnWillFetch, 'decorated fnWillFetch').to.be.a('function');
        expect(fDeco.toggleFetching, 'decorated toggleFetching').to.be.a('function');

    });
});
