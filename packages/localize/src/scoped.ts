import type { LocaleManager } from './manager.ts';

/**
 * Lightweight scoped translator that prepends a key prefix
 * and delegates to the parent LocaleManager.
 *
 * WHY: Large apps need feature-scoped translations to avoid key collisions
 * and to keep components focused on their own namespace.
 *
 * @example
 *
 *     const authT = i18n.ns('auth');
 *     authT.t('login.title')  // resolves to i18n.t('auth.login.title')
 *
 *     const loginT = authT.ns('login');
 *     loginT.t('title')       // resolves to i18n.t('auth.login.title')
 */
export class ScopedLocale<
    Locale extends LocaleManager.LocaleType,
    Code extends string = string
> {

    #manager: LocaleManager<Locale, Code>;
    #prefix: string;

    constructor(manager: LocaleManager<Locale, Code>, prefix: string) {

        this.#manager = manager;
        this.#prefix = prefix;
    }

    t(key: string, values?: LocaleManager.LocaleFormatArgs): string {

        return this.#manager.text(`${this.#prefix}.${key}` as any, values);
    }

    get intl(): LocaleManager.IntlFormatters {

        return this.#manager.intl;
    }

    ns(subPrefix: string): ScopedLocale<Locale, Code> {

        return new ScopedLocale(this.#manager, `${this.#prefix}.${subPrefix}`);
    }
}
