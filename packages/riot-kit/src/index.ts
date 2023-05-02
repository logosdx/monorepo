export * from '@logos-ui/kit';

import type { install, RiotComponent } from 'riot';
import { isFunction } from '@logos-ui/utils';
import {
    appKit,
    AppKitOpts,
    AppKitType,
} from '@logos-ui/kit';

import {
    makeQueryable,
    QueryableComponent,
    QueryableState
} from '@logos-ui/riot-utils';

import { makeComponentStateable, StateMachineComponent } from './state';
import { ObservableComponent, makeComponentObservable } from './observer';
import { TranslatableComponent, makeComponentTranslatable } from './locales';
import { StoragableComponent, makeComponentStoragable } from './storage';

type QueryableRC<P, S> = RiotComponent<P, QueryableState<S>>;

export type LogosUIRiotComponent<
    KitType extends AppKitType,
    RiotCompProps = any,
    RiotCompState = any,
> = (

    QueryableRC<
        RiotCompProps,
        RiotCompState
    > &
    ObservableComponent<
        KitType['eventsType'],
        QueryableRC<
            RiotCompProps,
            RiotCompState
        >
    > &
    TranslatableComponent<
        KitType['locales']['localeType'],
        KitType['locales']['codes']
    > &
    StateMachineComponent<
        KitType['stateMachine']['stateType'],
        KitType['stateMachine']['reducerValType'],
        RiotCompProps,
        QueryableState<RiotCompState>
    > &
    StoragableComponent<Storage> &
    QueryableComponent<
        QueryableRC<RiotCompProps, RiotCompState>,
        RiotCompState
    >
);

/**
 * Automatically instantiates UI components when passed opts.
 * Sets components up for use with riot components.
 * Extends RiotJS components given their config.
 * @param opts configs for different logos-ui components
 * @returns
 */
export const riotKit = <KitType extends AppKitType>(

    opts: AppKitOpts<KitType> & {

        riotInstallFunction: typeof install;
    }
) => {

    const {
        locale,
        observer,
        stateMachine,
        storage,
        fetch
    } = appKit <KitType> (opts);

    type RiotKitComponent<P, S> = LogosUIRiotComponent<KitType, P, S>;

    opts.riotInstallFunction((component: RiotKitComponent<any, any>) => {

        if (!!stateMachine && isFunction(component.mapToState)) {
            makeComponentStateable({
                component,
                stateMachine,
                mapToState: component.mapToState,
                mapToComponent: component.mapToComponent
            });
        }

        if (!!observer && component.observable) {
            makeComponentObservable({ component, observer });
        }

        if (!!locale && component.translatable) {
            makeComponentTranslatable({ component, locale });
        }

        if (!!storage && (component.saveInKey || component.loadStorage)) {
            makeComponentStoragable({ component, storage });
        }

        if (component.fetchable) {

            makeQueryable(component);
        }

        return component;
    });

    return {
        observer,
        locale,
        stateMachine,
        storage,
        fetch
    }
};