import type { ReactNode } from 'react';
import type { ObserverEngine } from '@logosdx/observer';
import type { StorageAdapter } from '@logosdx/storage';
import type { LocaleManager } from '@logosdx/localize';
import type { StateMachine } from '@logosdx/state-machine';
import type { PathLeaves } from '@logosdx/utils';

export type ProviderProps = {
    children?: ReactNode;
};

export type UseObserverReturn<Shape extends Record<string, any>> = {
    on: <E extends keyof Shape>(
        event: E,
        callback: (data: Shape[E]) => void
    ) => void;
    once: <E extends keyof Shape>(
        event: E,
        callback: (data: Shape[E]) => void
    ) => void;
    oncePromise: <E extends keyof Shape>(
        event: E
    ) => readonly [waiting: boolean, data: Shape[E] | null, cancel: () => void];
    emitFactory: <E extends keyof Shape>(
        event: E
    ) => (data?: Shape[E]) => void;
    emit: <E extends keyof Shape>(
        event: E,
        data?: Shape[E]
    ) => void;
    instance: ObserverEngine<Shape>;
};

export type UseStorageReturn<Values> = {
    get: StorageAdapter<Values>['get'];
    set: StorageAdapter<Values>['set'];
    remove: StorageAdapter<Values>['rm'];
    assign: StorageAdapter<Values>['assign'];
    has: StorageAdapter<Values>['has'];
    clear: StorageAdapter<Values>['clear'];
    keys: StorageAdapter<Values>['keys'];
    scope: StorageAdapter<Values>['scope'];
    instance: StorageAdapter<Values>;
};

export type UseLocalizeReturn<
    Locale extends LocaleManager.LocaleType,
    Code extends string
> = {
    t: <K extends PathLeaves<Locale>>(
        key: K,
        values?: LocaleManager.LocaleFormatArgs
    ) => string;
    locale: Code;
    changeTo: (code: Code) => void;
    locales: { code: Code; text: string }[];
    instance: LocaleManager<Locale, Code>;
};

export type UseStateMachineReturn<
    Context,
    Events extends Record<string, any>,
    States extends string,
    Selected = Context
> = {
    state: States;
    context: Selected;
    send: StateMachine<Context, Events, States>['send'];
    instance: StateMachine<Context, Events, States>;
};
