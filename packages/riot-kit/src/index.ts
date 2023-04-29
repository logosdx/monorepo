export * from '@logos-ui/kit';

import type { install, RiotComponent } from 'riot';
import { L10nFactory, L10nOpts, L10nLocale } from '@logos-ui/localize';
import { Observable, ObservableInstanceChild, ObservableOptions } from '@logos-ui/observer';
import { ReducerFunction, StateMachine, StateMachineOptions } from '@logos-ui/state-machine';
import { StorageFactory, StorageImplementation } from '@logos-ui/storage';
import { isFunction } from '@logos-ui/utils';
import { appKit, AppKitOpts } from '@logos-ui/kit';

import {
    makeQueryable,
    QueryableComponent,
    QueryableState
} from '@logos-ui/riot-utils';

import {
    makeComponentStateable,
    MapToComponentFunction,
    MapToStateFunction,
    StateMachineComponent
} from './state';

import {
    ObservableComponent,
    makeComponentObservable
} from './observer';

import {
    TranslatableComponent,
    makeComponentTranslatable
} from './l10n';

import {
    StoragableComponent,
    makeComponentStoragable
} from './storage';

type QueryableRC<P, S> = RiotComponent<P, QueryableState<S>>;

export type LogosRiotComponent<
    Events = any,
    AppState = any,
    AppStateReducerValue = any,
    Storage = any,
    Locales extends L10nLocale = any,
    LocaleCodes extends string = any,
    RiotCompProps = any,
    RiotCompState = any,
> = (

    QueryableRC<RiotCompProps, RiotCompState> &
    ObservableComponent<Events, QueryableRC<RiotCompProps, RiotCompState>> &
    TranslatableComponent<Locales, LocaleCodes> &
    StateMachineComponent<AppState, AppStateReducerValue, RiotCompProps, QueryableState<RiotCompState>> &
    StoragableComponent<Storage> &
    QueryableComponent<QueryableRC<RiotCompProps, RiotCompState>, RiotCompState>
);

/**
 * Automatically instantiates UI components when passed opts.
 * Sets components up for use with riot components.
 * Extends RiotJS components given their config.
 * @param opts configs for different logos-ui components
 * @returns
 */
export const riotKit = <
    Events = any,
    AppState = any,
    AppStateReducerValue = AppState,
    Storage = any,
    Locales extends L10nLocale = any,
    LocaleCodes extends string = any,
>(
    opts: AppKitOpts<Events, AppState, AppStateReducerValue, Locales, LocaleCodes> & {

        riotInstallFunction: typeof install;
    }
) => {

    const {
        l10n,
        observer,
        stateMachine,
        storage,
    } = appKit <Events, AppState, AppStateReducerValue, Storage, Locales, LocaleCodes> (opts);

    type RiotKitComponent<P, S> = LogosRiotComponent<
        Events,
        AppState,
        AppStateReducerValue,
        Storage,
        Locales,
        LocaleCodes,
        P, S
    >;

    opts.riotInstallFunction((component: RiotKitComponent<any, any>) => {

        if (!!stateMachine && isFunction(component.mapToState)) {
            makeComponentStateable({
                component,
                mapToState: component.mapToState,
                stateMachine,
                mapToComponent: component.mapToComponent
            });
        }

        if (!!observer && component.observable) {
            makeComponentObservable({ component, observer });
        }

        if (!!l10n && component.translatable) {
            makeComponentTranslatable({ component, l10n });
        }

        if (!!storage && (component.saveInKey || component.loadStorage)) {
            makeComponentStoragable({ component, storage });
        }

        if (component.makeFetching) {

            makeQueryable(component);
        }

        return component;
    });

    return {
        observer,
        l10n,
        stateMachine,
        storage
    }
};