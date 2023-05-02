import { LocaleFactory, LocaleOpts, LocaleType } from '@logos-ui/localize';
import { Observable, ObservableOptions } from '@logos-ui/observer';
import { ReducerFunction, StateMachine, StateMachineOptions } from '@logos-ui/state-machine';
import { StorageImplementation } from '@logos-ui/storage';
import { StorageFactory } from '@logos-ui/storage';
import { FetchFactory, FetchFactoryOptions, TypeOfFactory } from '@logos-ui/fetch';

export * from '@logos-ui/dom';
export * from '@logos-ui/fetch';
export * from '@logos-ui/localize';
export * from '@logos-ui/observer';
export * from '@logos-ui/state-machine';
export * from '@logos-ui/storage';
export * from '@logos-ui/utils';

export type AppKitLocale = {
    localeType: LocaleType,
    codes: string
}

export type AppKitStateMachine = {
    stateType: unknown,
    reducerValType: unknown
}

export type AppKitFetch = {
    stateType: unknown,
    headersType: Record<string, string>
}

export type AppKitType = {
    eventsType?: Record<string, any>,
    storageType?: Record<string, any>,
    locales?: AppKitLocale,
    stateMachine?: AppKitStateMachine,
    fetch?: AppKitFetch,
}


export type AppKitOpts<KitType extends AppKitType> = {
    observer?: ObservableOptions<{}, KitType['eventsType']>,
    stateMachine?: {
        initial: KitType['stateMachine']['stateType'],
        options?: StateMachineOptions,
        reducer: ReducerFunction<
            KitType['stateMachine']['stateType'],
            KitType['stateMachine']['reducerValType']
        >
    },
    locales?: LocaleOpts<
        KitType['locales']['localeType'],
        KitType['locales']['codes']
    >,
    storage?: {
        implementation: StorageImplementation,
        prefix?: string
    },
    fetch?: FetchFactoryOptions<
        KitType['fetch']['stateType'],
        KitType['fetch']['headersType']
    >,
}

/**
 * Automatically instantiates UI components when passed opts.
 *
 * @param opts configs for different logos-ui components
 * @returns
 */
export const appKit = <KitType extends AppKitType = any>(
    opts: AppKitOpts<KitType>
) => {

    type KitObserver = Observable<{}, KitType['eventsType']>;
    type KitLocales = LocaleFactory<KitType['locales']['localeType'], KitType['locales']['codes']>;
    type KitStateMachine = StateMachine<KitType['stateMachine']['stateType'], KitType['stateMachine']['reducerValType']>;
    type KitStorage = StorageFactory<KitType['storageType']>;
    type KitFetch = FetchFactory<KitType['fetch']['stateType'], KitType['fetch']['headersType']>

    let observer: null | KitObserver = null;
    let locale: null | KitLocales = null;
    let stateMachine: null | KitStateMachine = null;
    let storage: null | KitStorage = null;
    let fetch: null | KitFetch = null;

    if (opts.observer) {

        observer = new Observable({}, opts.observer) as KitObserver;
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

    if(opts.fetch) {

        fetch = new FetchFactory(opts.fetch);
    }

    return {
        observer,
        locale,
        stateMachine,
        storage,
        fetch
    }
};