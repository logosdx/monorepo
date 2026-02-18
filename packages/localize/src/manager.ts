import {
    merge,
    DeepOptional,
    PathLeaves,
    assert,
    clone
} from '@logosdx/utils';

import {
    getMessage,
    LocaleEvent
} from './helpers.ts';

import { createIntlFormatters } from './intl.ts';

/**
 * Module for handling text and labels throughout your app and within components.
 *
 * @example
 *
 * const english = {
 *      my: { nested: {
 *          key: '{0}, I like bacon. {1}, I like eggs.'
 *          key2: '{first}, I like steak. {second}, I like rice.'
 *      }}
 * }
 *
 * const spanish = {
 *      my: { nested: {
 *          key: '{0}, me gusta el bacon. {1}, me gustan los huevos.'
 *          key2: '{first}, me gusta la carne de res. {second}, me gusta el arroz.'
 *      }}
 * }
 *
 * const langMngr = new L10n({
 *      current: 'en',
 *      fallback: 'en'
 *      langs: {
 *          en: english,
 *          es: spanish
 *      }
 * });
 *
 * langMngr.t('my.nested.key', ['Yes', 'No']);
 * // > 'Yes, I like bacon. No, I like eggs.'
 *
 * langMngr.t('my.nested.key2', { first: 'Ofcourse', second: 'Obviously' });
 * // > 'Ofcourse, I like steak. Obviously, I like rice.'
 *
 * const onChange = (e) => sendToAnalytics(e.code);
 *
 * langMng.on('language-change', onChange);
 *
 * langMngr.changeTo('es');
 *
 * langMngr.t('my.nested.key2', { first: 'Claro', second: 'Obviamente' });
 * // > 'Claro, me gusta la carne de res. Obviamente, me gusta el arroz.'
 *
 * langMng.off('language-change', onChange);
 */
export class LocaleManager<
    Locale extends LocaleManager.LocaleType,
    Code extends string = string
> extends EventTarget {

    #_locales: LocaleManager.ManyLocales<Locale, Code>;
    #_loaders = new Map<Code, LocaleManager.LazyLocale<Locale>>();
    fallback: Code;
    current: Code;

    /**
     * Returns a label with replaced variables
     *
     * @example
     *
     * const theLang = {
     *      my: { nested: {
     *          key: '{0}, I like bacon. {1}, I like eggs.'
     *          key2: '{first}, I like steak. {second}, I like rice.'
     *      }}
     * }
     *
     * t('my.nested.key', ['Yes', 'No']);
     * // > 'Yes, I like bacon. No, I like eggs.'
     *
     * t('my.nested.key2', { first: 'Ofcourse', second: 'Obviously' });
     * // > 'Ofcourse, I like steak. Obviously, I like rice.'
     */
    t: LocaleManager<Locale, Code>['text'];

    #_loc!: Locale;

    constructor(opts: LocaleManager.LocaleOpts<Locale, Code>) {

        super();

        assert(!!opts.current, 'Current language not set', TypeError);
        assert(!!opts.fallback, 'Fallback language not set', TypeError);
        assert(!!opts.locales, 'Languages config is not set', TypeError);
        assert(typeof opts.locales === 'object', 'Languages config is not an object', TypeError);
        assert(!Array.isArray(opts.locales), 'Languages config can not be an array', TypeError);

        this.#_locales = opts.locales;
        this.current = opts.current;
        this.fallback = opts.fallback;

        this.t = this.text.bind(this);

        this.#merge();
    }

    on(
        ev: LocaleManager.LocaleEventName,
        listener: LocaleManager.LocaleListener<Code>,
        once = false
    ) {

        this.addEventListener(ev, listener as any, { once });

        return () => this.removeEventListener(ev, listener as any);
    }

    off(ev: LocaleManager.LocaleEventName, listener: LocaleManager.LocaleListener<Code>) {

        this.removeEventListener(ev, listener as any);
    }

    #merge() {

        const fallbackLabels = clone(this.#_locales[this.fallback].labels);
        this.#_loc = (this.current === this.fallback)
            ? fallbackLabels as Locale
            : merge(fallbackLabels, this.#_locales[this.current].labels) as Locale;
    }

    updateLang <C extends Code>(
        code: C,
        locale: DeepOptional<Locale>
    ) {

        let labels = merge({} as Locale, this.#_locales[code].labels) as Locale;
        labels = merge(labels, locale) as Locale;

        this.#_locales[code] = {
            ...this.#_locales[code],
            labels,
        };

        if (this.current === code) {

            this.#merge();

            const event = new LocaleEvent<Code>('change');
            event.code = code;

            this.dispatchEvent(event);
        }

    }


    get intl(): LocaleManager.IntlFormatters {

        return createIntlFormatters(this.current);
    }

    register<C extends Code>(
        code: C,
        opts: LocaleManager.LazyLocale<Locale>
    ) {

        this.#_loaders.set(code, opts);
    }

    isLoaded(code: Code): boolean {

        return !!this.#_locales[code];
    }

    get locales() {

        type LangConf = LocaleManager.ManyLocales<Locale, Code>;

        const loaded = Object.values(this.#_locales) as LangConf[Code][];

        const result = loaded.map(
            ({ code, text }) => ({ code, text })
        );

        for (const [code, opts] of this.#_loaders) {

            if (!this.#_locales[code]) {

                result.push({ code, text: opts.text });
            }
        }

        return result;
    }

    text <K extends PathLeaves<Locale>>(key: K, values?: LocaleManager.LocaleFormatArgs) {

        return getMessage(this.#_loc, key, values, this.current);
    }

    async changeTo(code: Code) {

        if (code === this.current) {

            return;
        }

        if (this.#_locales[code]) {

            this.current = code;
            this.#merge();

            const event = new LocaleEvent<Code>('change');
            event.code = code;
            this.dispatchEvent(event);

            return;
        }

        const lazyLocale = this.#_loaders.get(code);

        if (lazyLocale) {

            const loadingEvent = new LocaleEvent<Code>('loading');
            loadingEvent.code = code;
            this.dispatchEvent(loadingEvent);

            try {

                const labels = await lazyLocale.loader();

                this.#_locales[code] = {
                    code,
                    text: lazyLocale.text,
                    labels,
                } as LocaleManager.ManyLocales<Locale, Code>[Code];

                this.current = code;
                this.#merge();

                const changeEvent = new LocaleEvent<Code>('change');
                changeEvent.code = code;
                this.dispatchEvent(changeEvent);
            }
            catch (err) {

                const errorEvent = new LocaleEvent<Code>('error');
                errorEvent.code = code;
                this.dispatchEvent(errorEvent);

                throw err;
            }

            return;
        }

        console.warn(`WARNING: Locale '${code}' not found. Using fallback '${this.fallback}' instead.`);
        code = this.fallback;

        this.current = code;
        this.#merge();

        const event = new LocaleEvent<Code>('change');
        event.code = code;
        this.dispatchEvent(event);
    }

    clone() {

        return new LocaleManager<Locale, Code>({
            current: this.current,
            fallback: this.fallback,
            locales: this.#_locales
        });
    }
}
