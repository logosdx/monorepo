import { LocaleManager } from '@logosdx/localize';
import { ObserverEngine } from '@logosdx/observer';
import { type ReducerFunction, StateMachine, StateMachineOptions } from '@logosdx/state-machine';
import { type StorageImplementation } from '@logosdx/storage';
import { StorageAdapter } from '@logosdx/storage';
import { FetchEngine } from '@logosdx/fetch';
import { assert, isObject, type NotUndefined } from '@logosdx/utils';

export * from '@logosdx/fetch';
export * from '@logosdx/localize';
export * from '@logosdx/observer';
export * from '@logosdx/state-machine';
export * from '@logosdx/storage';
export * from '@logosdx/utils';

/**
 * Configuration for locale settings in the app kit.
 */
export type AppKitLocale = {
    /** The locale type for internationalization */
    locale: LocaleManager.LocaleType,
    /** The locale codes for language/region identification */
    codes: string
}

/**
 * Configuration for state machine settings in the app kit.
 */
export type AppKitStateMachine = {
    /** The state type for the state machine */
    state: unknown,
    /** The reducer value type for state transitions */
    reducerValue: unknown
}

/**
 * Configuration for fetch settings in the app kit.
 */
export type AppKitFetch = {
    /** Optional state for fetch operations */
    state?: unknown,
    /** Optional headers for HTTP requests */
    headers?: Record<string, string>,
    /** Optional parameters for API calls */
    params?: Record<string, string>
}

/**
 * Main configuration type for the app kit.
 * Defines the structure for events, storage, locales, state machine, fetch, and APIs.
 */
export type AppKitType = {
    /** Event definitions for the observer engine */
    events?: Record<string, any>,
    /** Storage configuration for data persistence */
    storage?: Record<string, unknown>,
    /** Locale configuration for internationalization */
    locales?: AppKitLocale,
    /** State machine configuration for state management */
    stateMachine?: AppKitStateMachine,
    /** Default fetch configuration for HTTP requests */
    fetch?: AppKitFetch,
    /** Named API configurations for different endpoints */
    apis?: {
        [key: string]: AppKitFetch
    }
}

/**
 * Utility type to create a kit type with proper typing.
 * @template KitType - The kit type to be created
 *
 * @example
 * ```typescript
 * type MyKit = MakeKitType<{
 *   events: {
 *     'my-event': {
 *       payload: {
 *         name: string;
 *         age: number;
 *       };
 *     };
 *   };
 * }>;
 *
 * const kit = appKit<MyKit>({
 *   observer: {}
 * });
 * ```
 */
export type MakeKitType<KitType extends AppKitType> = KitType

/**
 * Options configuration for the app kit.
 * Defines all possible configuration options for each component.
 * @template KitType - The kit type that defines the structure
 */
export type AppKitOpts<KitType extends AppKitType> = {
    /** Observer engine options for event handling */
    observer?: ObserverEngine.Options<NotUndefined<KitType['events']>>,
    /** State machine configuration with initial state, options, and reducer */
    stateMachine?: {
            /** Initial state for the state machine */
            initial: NotUndefined<KitType['stateMachine']>['state']
            /** Optional configuration for the state machine */
            options?: StateMachineOptions,
            /** Reducer function for state transitions */
            reducer: ReducerFunction<
                NotUndefined<KitType['stateMachine']>['state'],
                NotUndefined<KitType['stateMachine']>['reducerValue']
            >
        },
    /** Locale manager options for internationalization */
    locales?: LocaleManager.LocaleOpts<
        NotUndefined<KitType['locales']>['locale'],
        NotUndefined<KitType['locales']>['codes']
    >,
    /** Storage configuration with implementation and optional prefix */
    storage?: {
        /** Storage implementation to use */
        implementation: StorageImplementation,
        /** Optional prefix for storage keys */
        prefix?: string
    },
    /** Default fetch engine options */
    fetch?: FetchEngine.Options<
        NotUndefined<KitType['fetch']>['headers'],
        NotUndefined<KitType['fetch']>['state']
    >,
    /** Named API configurations for different endpoints */
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
 * Creates and configures observer, locale manager, state machine, storage, fetch engine, and APIs
 * based on the provided configuration options.
 *
 * @template Kit - The kit type that defines the structure and typing
 * @param opts - Configuration options for different logosdx components
 * @returns An object containing instantiated components based on the provided options
 *
 * @example
 * ```typescript
 * const kit = appKit({
 *   observer: { ... },
 *   locales: { ... },
 *   stateMachine: {
 *     initial: { count: 0 },
 *     reducer: (state, action) => { ... }
 *   },
 *   storage: {
 *     implementation: new LocalStorageAdapter(),
 *     prefix: 'myapp'
 *   },
 *   fetch: { ... },
 *   apis: {
 *     users: { ... },
 *     posts: { ... }
 *   }
 * });
 * ```
 */
export const appKit = <Kit extends AppKitType = any>(
    opts: AppKitOpts<Kit>
) => {

    // Type aliases for better readability
    type LocaleType = NotUndefined<Kit['locales']>['locale'];
    type LocaleCodes = NotUndefined<Kit['locales']>['codes'];
    type StateType = NotUndefined<Kit['stateMachine']>['state'];
    type ReducerValType = NotUndefined<Kit['stateMachine']>['reducerValue'];
    type FetchStateType = NotUndefined<Kit['fetch']>['state'];
    type FetchHeadersType = NotUndefined<Kit['fetch']>['headers'];

    // Component type aliases
    type KitObserver = ObserverEngine<NotUndefined<Kit['events']>>;
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

    // Initialize component instances
    let observer: null | KitObserver = null;
    let locale: null | KitLocales = null;
    let stateMachine: null | KitStateMachine = null;
    let storage: null | KitStorage = null;
    let fetch: null | KitFetch = null;
    let apis: null | KitApis = null;

    // Initialize observer if options provided
    if (opts.observer) {

        observer = new ObserverEngine(opts.observer) as KitObserver;
    }

    // Initialize locale manager if options provided
    if (opts.locales) {

        locale = new LocaleManager(opts.locales);
    }

    // Initialize state machine if options provided
    if (opts.stateMachine) {
        stateMachine = new StateMachine(
            opts.stateMachine.initial,
            opts.stateMachine.options
        );

        stateMachine.addReducer(
            opts.stateMachine.reducer
        );
    }

    // Initialize storage adapter if options provided
    if (opts.storage) {
        storage = new StorageAdapter(opts.storage.implementation, opts.storage.prefix);
    }

    // Initialize fetch engine if options provided
    if (opts.fetch) {

        fetch = new FetchEngine(opts.fetch) as KitFetch;
    }

    // Initialize named APIs if options provided
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

    // Return typed object with conditional properties based on provided options
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
