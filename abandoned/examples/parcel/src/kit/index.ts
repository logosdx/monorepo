import { install } from 'riot';

import {
    riotKit,
    LogosUIRiotComponent
} from '@logos-ui/riot-kit';

import { AppState, ReducerValue, stateReducer } from './state';
import { AppStorageType } from './storage';
import { AppEvents } from './events';
import { LocCodes, LocType, locales } from './lang';

export type WebAppKit = {
    eventsType: AppEvents,
    storageType: AppStorageType,
    locales: {
        localeType: LocType,
        codes: LocCodes
    },
    stateMachine: {
        stateType: AppState,
        reducerValType: ReducerValue
    },
    fetch: {
        headersType: {
            //
        },
        stateType: {
            //
        }
    }
};

export type WebAppComponent<C extends object, P = any, S = any> = C & Partial<LogosUIRiotComponent<WebAppKit, { /**/ }, P, S>>


const kit = riotKit <WebAppKit>({
    riotInstallFunction: install,
    locales: {
        current: 'en',
        fallback: 'en',
        locales
    },
    observer: {},
    stateMachine: {
        initial: {},
        reducer: stateReducer,
        options: {
            statesToKeep: 1000,
        }
    },
    storage: {
        implementation: window.localStorage,
        prefix: 'hoseki-ui'
    },
    fetch: {
        baseUrl: window.location.origin,
        type: 'json',
    }
});

(window as any).riotKit = kit;


window.addEventListener('scroll', (e) => {

    kit.observer?.emit('scroll', e);
});

window.addEventListener('resize', (e) => {

    kit.observer?.emit('resize', e);
});

window.addEventListener('keydown', (e) => {

    kit.observer?.emit('keyboard', e);
});

window.addEventListener('keyup', (e) => {

    kit.observer?.emit(e.key as keyof AppEvents, e);
});

window.addEventListener('click', (e) => {

    kit.observer?.emit('click', e);
});

export const observer = kit.observer!;
export const storage = kit.storage!;
export const locale = kit.locale!;
export const stateMachine = kit.stateMachine!;
export const api = kit.fetch!;

