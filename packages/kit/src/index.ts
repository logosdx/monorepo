import { L10nFactory, L10nOpts, L10nLocale } from '@logos-ui/localize';
import { Observable, ObservableOptions } from '@logos-ui/observer';
import { ReducerFunction, StateMachine, StateMachineOptions } from '@logos-ui/state-machine';
import { StorageImplementation } from '@logos-ui/storage';
import { StorageFactory } from '@logos-ui/storage';

export * from '@logos-ui/dom';
export * from '@logos-ui/fetch';
export * from '@logos-ui/localize';
export * from '@logos-ui/observer';
export * from '@logos-ui/state-machine';
export * from '@logos-ui/storage';
export * from '@logos-ui/utils';

export type AppKitOpts<
    Events,
    State,
    AppStateReducerValue,
    Locales extends L10nLocale,
    LocaleCodes extends string,
> = {
    observer?: ObservableOptions<{}, Events>,
    stateMachine?: {
        initial: State,
        options?: StateMachineOptions,
        reducer: ReducerFunction<State, AppStateReducerValue>
    },
    locales?: L10nOpts<Locales, LocaleCodes>,
    storage?: {
        implementation: StorageImplementation,
        prefix?: string
    }
}

/**
 * Automatically instantiates UI components when passed opts.
 *
 * @param opts configs for different logos-ui components
 * @returns
 */
export const appKit = <
    Events = any,
    AppState = any,
    AppStateReducerValue = AppState,
    Storage = any,
    Locales extends L10nLocale = any,
    LocaleCodes extends string = any,
>(
    opts: AppKitOpts<
        Events,
        AppState,
        AppStateReducerValue,
        Locales,
        LocaleCodes
    >
) => {

    let observer: null | Observable<{}, Events> = null;
    let l10n: null | L10nFactory<Locales, LocaleCodes> = null;
    let stateMachine: null | StateMachine<AppState, AppStateReducerValue> = null;
    let storage: null | StorageFactory<Storage>;

    if (opts.observer) {

        observer = new Observable<{}, Events>({}, opts.observer);
    }

    if (opts.locales) {

        l10n = new L10nFactory<Locales, LocaleCodes>(opts.locales);
    }

    if (opts.stateMachine) {

        stateMachine = new StateMachine<AppState>(
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

    return {
        observer,
        l10n,
        stateMachine,
        storage
    }
};