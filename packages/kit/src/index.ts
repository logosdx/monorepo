import { LocaleManager } from '@logosdx/localize';
import { ObserverEngine } from '@logosdx/observer';
import { ReducerFunction, StateMachine, StateMachineOptions } from '@logosdx/state-machine';
import { StorageImplementation } from '@logosdx/storage';
import { StorageAdapter } from '@logosdx/storage';
import { FetchEngine } from '@logosdx/fetch';
import { assert, isObject, NotUndefined } from '@logosdx/utils';

export * from '@logosdx/fetch';
export * from '@logosdx/localize';
export * from '@logosdx/observer';
export * from '@logosdx/state-machine';
export * from '@logosdx/storage';
export * from '@logosdx/utils';

export type AppKitLocale = {
    locale: LocaleManager.LocaleType,
    codes: string
}

export type AppKitStateMachine = {
    state: unknown,
    reducerValue: unknown
}

export type AppKitFetch = {
    state?: unknown,
    headers?: Record<string, string>,
    params?: Record<string, string>
}

export type AppKitType = {
    events?: Record<string, unknown>,
    storage?: Record<string, unknown>,
    locales?: AppKitLocale,
    stateMachine?: AppKitStateMachine,
    fetch?: AppKitFetch,
    apis?: {
        [key: string]: AppKitFetch
    }
}

export type MakeKitType<KitType extends AppKitType> = KitType

export type AppKitOpts<KitType extends AppKitType> = {
    observer?: ObserverEngine.Options<KitType['events']>,
    stateMachine?: {
            initial: NotUndefined<KitType['stateMachine']>['state']
            options?: StateMachineOptions,
            reducer: ReducerFunction<
                NotUndefined<KitType['stateMachine']>['state'],
                NotUndefined<KitType['stateMachine']>['reducerValue']
            >
        },
    locales?: LocaleManager.LocaleOpts<
        NotUndefined<KitType['locales']>['locale'],
        NotUndefined<KitType['locales']>['codes']
    >,
    storage?: {
        implementation: StorageImplementation,
        prefix?: string
    },
    fetch?: FetchEngine.Options<
        NotUndefined<KitType['fetch']>['headers'],
        NotUndefined<KitType['fetch']>['state']
    >,
    apis?: {
        [key in keyof KitType['apis']]: FetchEngine.Options<
            NotUndefined<KitType['apis']>[key]['headers'],
            NotUndefined<KitType['apis']>[key]['params'],
            NotUndefined<KitType['apis']>[key]['state']
        >
    }
}

/**
 * Automatically instantiates UI components when passed opts.
 *
 * @param opts configs for different logosdx components
 * @returns
 */
export const appKit = <Kit extends AppKitType = any>(
    opts: AppKitOpts<Kit>
) => {

    type LocaleType = NotUndefined<Kit['locales']>['locale'];
    type LocaleCodes = NotUndefined<Kit['locales']>['codes'];
    type StateType = NotUndefined<Kit['stateMachine']>['state'];
    type ReducerValType = NotUndefined<Kit['stateMachine']>['reducerValue'];
    type FetchStateType = NotUndefined<Kit['fetch']>['state'];
    type FetchHeadersType = NotUndefined<Kit['fetch']>['headers'];

    type KitObserver = ObserverEngine<Kit['events']>;
    type KitLocales = LocaleManager<LocaleType, LocaleCodes>;
    type KitStateMachine = StateMachine<StateType, ReducerValType>;
    type KitStorage = StorageAdapter<Kit['storage']>;
    type KitFetch = FetchEngine<FetchStateType, FetchHeadersType>;
    type KitApis = {
        [key in keyof Kit['apis']]: FetchEngine<
            NotUndefined<Kit['apis']>[key]['headers'],
            NotUndefined<Kit['apis']>[key]['state']
        >
    }

    let observer: null | KitObserver = null;
    let locale: null | KitLocales = null;
    let stateMachine: null | KitStateMachine = null;
    let storage: null | KitStorage = null;
    let fetch: null | KitFetch = null;
    let apis: null | KitApis = null;

    if (opts.observer) {

        observer = new ObserverEngine(opts.observer) as KitObserver;
    }

    if (opts.locales) {

        locale = new LocaleManager(opts.locales);
    }

    if (opts.stateMachine) {

        stateMachine = new StateMachine(
            opts.stateMachine.initial,
            opts.stateMachine.options
        );

        stateMachine.addReducer(
            opts.stateMachine.reducer
        );
    }

    if (opts.storage) {

        storage = new StorageAdapter(opts.storage.implementation, opts.storage.prefix);
    }

    if (opts.fetch) {

        fetch = new FetchEngine(opts.fetch) as KitFetch;
    }

    if (opts.apis) {


        assert(isObject(opts.apis), 'apis must be an object');

        apis = {} as KitApis;

        let i = 0;

        for (const key in opts.apis) {

            assert(isObject(opts.apis[key]), `apis key ${key} must be an object`);

            apis[key] = new FetchEngine(opts.apis[key]) as never

            i++;
        }

        assert(i > 0, 'apis must contain at least one key');
    }

    return {
        observer,
        locale,
        stateMachine,
        storage,
        fetch,
        apis
    } as {
        observer: Kit['events'] extends undefined ? never : KitObserver,
        locale: Kit['locales'] extends undefined ? never : KitLocales,
        stateMachine: Kit['stateMachine'] extends undefined ? never : KitStateMachine,
        storage: Kit['storage'] extends undefined ? never : KitStorage,
        fetch: Kit['fetch'] extends undefined ? never : KitFetch,
        apis: {
            [key in keyof Kit['apis']]: FetchEngine<
                NotUndefined<Kit['apis']>[key]['headers'],
                NotUndefined<Kit['apis']>[key]['params'],
                NotUndefined<Kit['apis']>[key]['state']
            >
        }
    }
};
