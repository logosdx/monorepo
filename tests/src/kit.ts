import { describe, it } from 'node:test'

import { expect } from 'chai';

import * as Kit from '../../packages/kit/src/index.ts';

describe('@logosdx/kit', () => {

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

    const locales: Kit.LocaleManager.ManyLocales<AppLocaleType, LocaleCodes> = {
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

        return Kit.merge(state, val) as AppStateType;
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

        expect(app.apis.stripe).to.be.an.instanceOf(Kit.FetchEngine);
        expect(app.apis.facebook).to.be.an.instanceOf(Kit.FetchEngine);
        expect(app.fetch).to.be.an.instanceOf(Kit.FetchEngine);

        expect(app.observer).to.be.an.instanceOf(Kit.ObserverEngine);
        expect(app.locale).to.be.an.instanceOf(Kit.LocaleManager);
        expect(app.stateMachine).to.be.an.instanceOf(Kit.StateMachine);
        expect(app.storage).to.be.an.instanceOf(Kit.StorageAdapter);

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

    it('can compose a custom type', () => {

        type MyKit = Kit.MakeKitType<{
            apis: {
                stripe: {
                    headers: { Authorization: string },
                    state: {},
                    params: {}
                }
            },
            events: {
                test: true
            },
            locales: {
                locale: {
                    test: 'test',
                    test2: 'test2',
                    nested: {
                        test3: 'test3'
                    }
                },
                codes: 'en' | 'es'
            },
            storage: {
                name: 'test',
                age: 123
            },
            stateMachine: {
                state: {
                    name: 'test'
                },
                reducerValue: {
                    name: 'test'
                }
            },
        }>

        const kit = appKit<MyKit>({});

        kit.apis?.stripe?.addHeader({ Authorization: 'Bearer 123' });

        kit.observer?.on('test', (bool) => {

            bool === true;
        });

        kit.observer?.emit('test', true);

        kit.locale?.t('test');
        kit.locale?.t('nested.test3');

        kit.locale?.changeTo('en');

        kit.storage?.set('name', 'test');
        kit.storage?.get('name') === 'test';

        kit.stateMachine?.dispatch({ name: 'test' });
        kit.stateMachine?.state().name === 'test';
    });
});
