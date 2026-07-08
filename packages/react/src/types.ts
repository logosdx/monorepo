import type { ReactNode } from 'react';
import type { ObserverEngine } from '@logosdx/observer';
import type { StorageAdapter } from '@logosdx/storage';
import type { LocaleManager } from '@logosdx/localize';
import type { StateMachine } from '@logosdx/state-machine';
import type { PathLeaves } from '@logosdx/utils';
import type { FetchError, FetchResponse } from '@logosdx/fetch';

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

/**
 * One `failure` signal for a request outcome, replacing a bare `error` +
 * `response` pair. `kind: 'transport'` means no response exists at all
 * (abort, timeout, connection lost) — `error` is the `FetchError`, with its
 * `.isCancelled()` / `.isTimeout()` / `.isConnectionLost()` helpers.
 * `kind: 'http'` means the server answered with a non-2xx status — the
 * `response` is the resolved, ok-false `FetchResponse`. Callers check one
 * field to know "did it fail", then narrow `kind` to see which channel.
 */
export type FetchFailure<T, RH = Record<string, string>> =
    | { kind: 'transport'; error: FetchError }
    | {
        kind: 'http';
        // `H`/`P` are left `unknown`: the engine's internal request-header/
        // param types don't line up 1:1 with the caller-facing generics
        // here, and nothing about a failure needs `response.config` typed
        // precisely — `data`, `status`, and `headers` are what matters.
        response: Extract<FetchResponse<T, unknown, unknown, RH>, { ok: false }>;
    };

export type FetchContextQueryResult<T, RH = Record<string, string>> = {
    data: T | null;
    loading: boolean;
    failure: FetchFailure<T, RH> | null;
    refetch: () => void;
    cancel: () => void;
};

export type FetchContextMutationResult<T, RH = Record<string, string>> = {
    data: T | null;
    loading: boolean;
    failure: FetchFailure<T, RH> | null;
    // Never rejects — a non-2xx or transport failure resolves `undefined`;
    // callers read `failure` for why, or just check the returned value.
    mutate: <Payload = unknown>(payload?: Payload) => Promise<T | undefined>;
    reset: () => void;
    cancel: () => void;
    called: boolean;
};
