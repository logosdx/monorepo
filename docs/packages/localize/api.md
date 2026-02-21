---
title: API Reference
description: Complete interface and class signatures for @logosdx/localize
---

# API Reference


Complete type and class signatures for `@logosdx/localize`.

[[toc]]

## LocaleManager


```ts
class LocaleManager<
    Locale extends LocaleManager.LocaleType,
    Code extends string = string
> {

    current: Code;
    fallback: Code;

    constructor(opts: LocaleManager.LocaleOpts<Locale, Code>);

    /** Resolve a translation key with optional variable substitution */
    text<K extends PathLeaves<Locale>>(
        key: K,
        values?: LocaleManager.LocaleFormatArgs
    ): string;

    /** Alias for text() */
    t: LocaleManager<Locale, Code>['text'];

    /** Switch to a different locale (triggers loader if registered) */
    changeTo(code: Code): Promise<void>;

    /** Deep-merge new labels into an existing locale */
    updateLang<C extends Code>(
        code: C,
        locale: DeepOptional<Locale>
    ): void;

    /** Register a lazy-loaded locale */
    register<C extends Code>(
        code: C,
        opts: LocaleManager.LazyLocale<Locale>
    ): void;

    /** Check if a locale's labels are in memory */
    isLoaded(code: Code): boolean;

    /** All known locales (loaded + registered) */
    get locales(): { code: Code; text: string }[];

    /** Cached Intl formatters for the current locale */
    get intl(): LocaleManager.IntlFormatters;

    /** Create a namespace-scoped translator */
    ns(prefix: string): ScopedLocale<Locale, Code>;

    /** Clone the manager with the same config and labels */
    clone(): LocaleManager<Locale, Code>;

    /** Subscribe to an event, returns unsubscribe function */
    on(
        ev: LocaleManager.LocaleEventName,
        listener: LocaleManager.LocaleListener<Code>
    ): () => void;

    /** Subscribe to an event once, returns unsubscribe function */
    once(
        ev: LocaleManager.LocaleEventName,
        listener: LocaleManager.LocaleListener<Code>
    ): () => void;

    /** Remove a listener (or all listeners for an event if no listener given) */
    off(
        ev: LocaleManager.LocaleEventName,
        listener?: LocaleManager.LocaleListener<Code>
    ): void;
}
```

## LocaleManager Namespace Types


```ts
namespace LocaleManager {

    type LocaleType = {
        [K in StrOrNum]: StrOrNum | LocaleType;
    };

    type ManyLocales<
        Locale extends LocaleType,
        Code extends string
    > = {
        [P in Code]: {
            code: Code;
            text: string;
            labels: Locale | DeepOptional<Locale>;
        };
    };

    type LocaleOpts<
        Locale extends LocaleType,
        Code extends string = string
    > = {
        current: Code;
        fallback: Code;
        locales: ManyLocales<Locale, Code>;
    };

    interface LazyLocale<Locale extends LocaleType> {
        text: string;
        loader: () => Promise<Locale>;
    }

    interface LocaleEventShape<Code extends string = string> {
        change: { code: Code };
        loading: { code: Code };
        error: { code: Code };
    }

    type LocaleEventName = keyof LocaleEventShape;

    type LocaleListener<Code extends string = string> = (
        data: { code: Code }
    ) => void;

    type LocaleReacher<T> = PathLeaves<T>;

    type LocaleFormatArgs =
        | Array<StrOrNum>
        | Record<StrOrNum, StrOrNum>;

    interface IntlFormatters {
        number(value: number, opts?: Intl.NumberFormatOptions): string;
        date(value: Date | number, opts?: Intl.DateTimeFormatOptions): string;
        relative(
            value: number,
            unit: Intl.RelativeTimeFormatUnit,
            opts?: Intl.RelativeTimeFormatOptions
        ): string;
    }
}
```

## ScopedLocale


```ts
class ScopedLocale<
    Locale extends LocaleManager.LocaleType,
    Code extends string = string
> {

    constructor(manager: LocaleManager<Locale, Code>, prefix: string);

    /** Resolve a key relative to this scope's prefix */
    t(key: string, values?: LocaleManager.LocaleFormatArgs): string;

    /** Delegates to parent manager's intl formatters */
    get intl(): LocaleManager.IntlFormatters;

    /** Create a deeper nested scope */
    ns(subPrefix: string): ScopedLocale<Locale, Code>;
}
```

## Helper Functions


```ts
/**
 * Substitute {name} and {0} placeholders in a string.
 */
function format(
    str: string,
    values: LocaleManager.LocaleFormatArgs
): string;

/**
 * Resolve a dot-notated key, substitute variables, and process plurals.
 * Returns [key] if the key is missing.
 */
function getMessage<L extends LocaleManager.LocaleType>(
    locale: L,
    reach: LocaleManager.LocaleReacher<L>,
    values?: LocaleManager.LocaleFormatArgs,
    localeCode?: string
): string;

/**
 * Traverse a nested object by dot-notated path.
 * Returns defValue if the path is not found.
 */
function reachIn<
    O extends LocaleManager.LocaleType,
    P extends PathLeaves<O>,
    D extends PathValue<O, P>
>(obj: O, path: P, defValue: D): PathValue<O, P> | undefined;

/**
 * Parse ICU-lite plural syntax using Intl.PluralRules.
 */
function parsePlural(
    str: string,
    values: LocaleManager.LocaleFormatArgs,
    locale: string
): string;

/**
 * Create cached Intl formatters for a locale code
 * without needing a LocaleManager instance.
 */
function createIntlFormatters(
    locale: string
): LocaleManager.IntlFormatters;
```
