import type { ReactNode } from 'react';
import type { ObserverEngine } from '@logosdx/observer';
import type { StorageAdapter } from '@logosdx/storage';
import type { LocaleManager } from '@logosdx/localize';
import type { NullableObject, PathLeaves } from '@logosdx/utils';

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
    get: {
        (): Values;
        <K extends keyof Values>(key: K): Values[K];
    };
    getMany: {
        <K extends keyof Values>(keys: K[]): Partial<NullableObject<Values>>;
    }
    set: {
        <K extends keyof Values>(key: K, value: Values[K]): void;
        (values: Partial<Values>): void;
    };
    setMany: (values: Partial<Values>) => void;
    remove: <K extends keyof Values>(keyOrKeys: K | K[]) => void;
    assign: <K extends keyof Values>(key: K, val: Partial<Values[K]>) => void;
    has: {
        (key: keyof Values): boolean;
        (keys: (keyof Values)[]): boolean[];
    };
    clear: () => void;
    wrap: StorageAdapter<Values>['wrap'];
    keys: () => (keyof Values)[];
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
