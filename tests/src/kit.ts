import * as Kit from '@logos-ui/kit';

import { expect } from 'chai';
import sinon from 'sinon';

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

        return Kit.merge(state, val);
    }

    type AppStorageType = {
        name: string,
        age: number
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
            },
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

    it('provides an appKit', function () {

        expect(Kit.appKit).to.be.a('function');

        const app = Kit.appKit<AppKitType>({
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

        expect(app.locale).to.be.an.instanceOf(Kit.LocaleFactory);
        expect(app.stateMachine).to.be.an.instanceOf(Kit.StateMachine);
        expect(app.storage).to.be.an.instanceOf(Kit.StorageFactory);
        expect(app.fetch).to.be.an.instanceOf(Kit.FetchFactory);

        app.observer.on('mint', (data) => data === 'peppermint');
        app.observer.trigger('floss', true);

        app.locale.t('bear');
        app.locale.changeTo('es');

        app.fetch.addHeader({ hmac: '123' });
        app.fetch.removeHeader('authorization');
        app.fetch.setState({ authToken: '123' });

        app.storage.set('age', 123);
        app.storage.get('name') === 'abc';

        app.stateMachine.state().age === 123;
        app.stateMachine.state().name === 'abc';
        app.stateMachine.dispatch({ age: 123 });

        app.stateMachine.addListener((state) => state.age == 123);
        app.stateMachine.addListener((state) => state.name == 'abc');

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
