import { LocaleFactory, LocaleOpts, LocaleType } from '@logos-ui/localize';
import { ObserverFactory } from '@logos-ui/observer';
import { ReducerFunction, StateMachine, StateMachineOptions } from '@logos-ui/state-machine';
import { StorageImplementation } from '@logos-ui/storage';
import { StorageFactory } from '@logos-ui/storage';
import { FetchFactory } from '@logos-ui/fetch';
import { assert, isObject, NotUndefined } from '@logos-ui/utils';

export * from '@logos-ui/dom';
export * from '@logos-ui/fetch';
export * from '@logos-ui/localize';
export * from '@logos-ui/observer';
export * from '@logos-ui/state-machine';
export * from '@logos-ui/storage';
export * from '@logos-ui/utils';

export type AppKitLocale = {
    locale: LocaleType,
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
    observer?: ObserverFactory.Options<KitType['events']>,
    stateMachine?: {
            initial: NotUndefined<KitType['stateMachine']>['state']
            options?: StateMachineOptions,
            reducer: ReducerFunction<
                NotUndefined<KitType['stateMachine']>['state'],
                NotUndefined<KitType['stateMachine']>['reducerValue']
            >
        },
    locales?: LocaleOpts<
        NotUndefined<KitType['locales']>['locale'],
        NotUndefined<KitType['locales']>['codes']
    >,
    storage?: {
        implementation: StorageImplementation,
        prefix?: string
    },
    fetch?: FetchFactory.Options<
        NotUndefined<KitType['fetch']>['headers'],
        NotUndefined<KitType['fetch']>['state']
    >,
    apis?: {
        [key in keyof KitType['apis']]: FetchFactory.Options<
            NotUndefined<KitType['apis']>[key]['headers'],
            NotUndefined<KitType['apis']>[key]['params'],
            NotUndefined<KitType['apis']>[key]['state']
        >
    }
}

type UndefinedOrEmpty<T, U> = T extends undefined ? {} : U

/**
 * Automatically instantiates UI components when passed opts.
 *
 * @param opts configs for different logos-ui components
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

    type KitObserver = ObserverFactory<Kit['events']>;
    type KitLocales = LocaleFactory<LocaleType, LocaleCodes>;
    type KitStateMachine = StateMachine<StateType, ReducerValType>;
    type KitStorage = StorageFactory<Kit['storage']>;
    type KitFetch = FetchFactory<FetchStateType, FetchHeadersType>;
    type KitApis = {
        [key in keyof Kit['apis']]: FetchFactory<
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

        observer = new ObserverFactory(opts.observer) as KitObserver;
    }

    if (opts.locales) {

        locale = new LocaleFactory(opts.locales);
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

        storage = new StorageFactory(opts.storage.implementation, opts.storage.prefix);
    }

    if (opts.fetch) {

        fetch = new FetchFactory(opts.fetch) as KitFetch;
    }

    if (opts.apis) {


        assert(isObject(opts.apis), 'apis must be an object');

        apis = {} as KitApis;

        let i = 0;

        for (const key in opts.apis) {

            assert(isObject(opts.apis[key]), `apis key ${key} must be an object`);

            apis[key] = new FetchFactory(opts.apis[key]) as never

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
            [key in keyof Kit['apis']]: FetchFactory<
                NotUndefined<Kit['apis']>[key]['headers'],
                NotUndefined<Kit['apis']>[key]['params'],
                NotUndefined<Kit['apis']>[key]['state']
            >
        }
    }
};
