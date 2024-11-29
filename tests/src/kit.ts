import { describe, it, before, beforeEach, after, afterEach } from 'node:test'

import { expect } from 'chai';
import sinon from 'sinon';

import * as Kit from '@logos-ui/kit';

import { log as console } from './_helpers'

describe('@logos-ui/kit', () => {

    const {
        appKit
    } = Kit;

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

    const locales: Kit.ManyLocales<AppLocaleType, LocaleCodes> = {
        en: { code: 'en', text: 'English', labels: locale },
        es: { code: 'es', text: 'Spanish', labels: { bear: 'oso {type}' } },
    }

    const initialState = {
        count: 0,
        name: '',
        age: 0
    };

    type AppStateType = typeof initialState;

    const stateReducer: Kit.ReducerFunction<AppStateType> = (val, state) => {

        return Kit.deepMerge(state, val) as AppStateType;
    }

    type AppStorageType = {
        name: string,
        age: number
    };

    type AppKitType = Kit.MakeKitType<{
        events: AppEventsType,
        storage: AppStorageType,
        locales: {
            locale: AppLocaleType,
            codes: LocaleCodes
        },
        stateMachine: {
            state: AppStateType,
            reducerValue: AppStateType
        },
        fetch: {
            state: {
                authToken: string,
            },
            headers: {
                authorization?: string,
                hmac?: string,
                timestamp?: string
            },
        },
        apis: {
            stripe: {
                headers: { Authorization: string },
                state: {},
                params: {}
            },
            facebook: {
                headers: {},
                params: { access_token: string },
                state: {}
            }
        }
    }>;

    type Opts = Kit.AppKitOpts<AppKitType>;

    const localesOpts: Opts['locales'] = {
        current: 'en',
        fallback: 'en',
        locales
    };

    const observerOpts: Opts['observer'] = {};

    const stateMachineOpts: Opts['stateMachine'] = {
        initial: initialState,
        reducer: stateReducer
    };

    const storageOpts: Opts['storage'] = {
        implementation: window.localStorage,
        prefix: 'kit'
    };

    const fetchOpts: Opts['fetch'] = {
        baseUrl: 'http://localhost:1234',
        defaultType: 'json',
        headers: {
            hmac: '123',
        }
    };

    const apis: Opts['apis'] = {
        stripe: {
            baseUrl: 'https://api.stripe.com',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer sk_',
            }
        },
        facebook: {
            baseUrl: 'https://graph.facebook.com',
            params: {
                access_token: '123'
            },
            headers: {}
        }
    }

    it('provides an appKit', function () {

        expect(Kit.appKit).to.be.a('function');

        const app = Kit.appKit<AppKitType>({
            fetch: fetchOpts,
            locales: localesOpts,
            observer: observerOpts,
            stateMachine: stateMachineOpts,
            storage: storageOpts,
            apis
        });

        expect(app.observer).to.exist;
        expect(app.locale).to.exist;
        expect(app.stateMachine).to.exist;
        expect(app.storage).to.exist;
        expect(app.fetch).to.exist;
        expect(app.apis).to.exist;

        expect(app.apis).to.have.property('stripe');
        expect(app.apis).to.have.property('facebook');

        expect(app.apis.stripe).to.be.an.instanceOf(Kit.FetchFactory);
        expect(app.apis.facebook).to.be.an.instanceOf(Kit.FetchFactory);
        expect(app.fetch).to.be.an.instanceOf(Kit.FetchFactory);

        expect(app.observer).to.be.an.instanceOf(Kit.ObserverFactory);
        expect(app.locale).to.be.an.instanceOf(Kit.LocaleFactory);
        expect(app.stateMachine).to.be.an.instanceOf(Kit.StateMachine);
        expect(app.storage).to.be.an.instanceOf(Kit.StorageFactory);

        app.observer!.on('mint', (data) => data === 'peppermint');
        app.observer!.emit('floss', true);

        app.locale!.t('bear');
        app.locale!.changeTo('en');

        app.fetch!.addHeader({ hmac: '123', nonsensee: '123' });
        app.fetch!.removeHeader('authorization');
        app.fetch!.setState({ authToken: '123' });

        app.apis.stripe.addHeader({ 'Content-Type': 'application/json' });
        app.apis.stripe.removeHeader('Content-Type');
        app.apis.stripe.setState({});

        app.apis.facebook.addParam({ access_token: '123' });
        app.apis.facebook.rmParams('access_token');

        app.storage!.set('age', 123);
        app.storage!.get('name') === 'abc';

        app.stateMachine!.state().age === 123;
        app.stateMachine!.state().name === 'abc';
        app.stateMachine!.dispatch({ age: 123 });

        app.stateMachine!.addListener((state) => state.age == 123);
        app.stateMachine!.addListener((state) => state.name == 'abc');

    });

    it ('optionally instantiates tools', () => {

        const onlyObserver = appKit({ observer: observerOpts });
        const onlyLocale = appKit({ locales: localesOpts })
        const onlyStateMachine = appKit({ stateMachine: stateMachineOpts })
        const onlyStorage = appKit({ storage: storageOpts })
        const onlyFetch = appKit({ fetch: fetchOpts})

        expect(onlyObserver).to.contain.keys('observer');
        expect(onlyObserver).to.contain({
            locale: null,
            stateMachine: null,
            storage: null,
            fetch: null
        });

        expect(onlyLocale).to.contain.keys('locale');
        expect(onlyLocale).to.contain({
            observer: null,
            stateMachine: null,
            storage: null,
            fetch: null
        });

        expect(onlyStateMachine).to.contain.keys('stateMachine');
        expect(onlyStateMachine).to.contain({
            locale: null,
            observer: null,
            storage: null,
            fetch: null
        });

        expect(onlyStorage).to.contain.keys('storage');
        expect(onlyStorage).to.contain({
            locale: null,
            stateMachine: null,
            observer: null,
            fetch: null
        });

        expect(onlyFetch).to.contain.keys('fetch');
        expect(onlyFetch).to.contain({
            locale: null,
            stateMachine: null,
            storage: null,
            observer: null
        });
    });
});
