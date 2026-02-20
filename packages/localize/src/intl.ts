/**
 * Cached Intl formatter factory.
 *
 * Creates and caches `Intl.NumberFormat`, `Intl.DateTimeFormat`, and
 * `Intl.RelativeTimeFormat` instances keyed by locale + serialized options.
 *
 * @example
 *
 *     const fmt = createIntlFormatters('en');
 *     fmt.number(1499.99)                                      // "1,499.99"
 *     fmt.number(9.99, { style: 'currency', currency: 'USD' }) // "$9.99"
 *     fmt.date(new Date())                                     // "2/18/2026"
 *     fmt.relative(-3, 'day')                                  // "3 days ago"
 */

import type { LocaleManager } from './manager.ts';

// Intentionally retained across locale changes — formatters for previous locales
// remain cached so switching back is instant. Typical apps use few locales.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();

const cacheKey = (locale: string, type: string, opts?: object) => {

    return `${locale}:${type}:${opts ? JSON.stringify(opts) : ''}`;
};

const getNumberFormat = (locale: string, opts?: Intl.NumberFormatOptions): Intl.NumberFormat => {

    const key = cacheKey(locale, 'number', opts);
    let fmt = cache.get(key) as Intl.NumberFormat | undefined;

    if (!fmt) {

        fmt = new Intl.NumberFormat(locale, opts);
        cache.set(key, fmt);
    }

    return fmt;
};

const getDateFormat = (locale: string, opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {

    const key = cacheKey(locale, 'date', opts);
    let fmt = cache.get(key) as Intl.DateTimeFormat | undefined;

    if (!fmt) {

        fmt = new Intl.DateTimeFormat(locale, opts);
        cache.set(key, fmt);
    }

    return fmt;
};

const getRelativeFormat = (locale: string, opts?: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat => {

    const key = cacheKey(locale, 'relative', opts);
    let fmt = cache.get(key) as Intl.RelativeTimeFormat | undefined;

    if (!fmt) {

        fmt = new Intl.RelativeTimeFormat(locale, opts);
        cache.set(key, fmt);
    }

    return fmt;
};

export const createIntlFormatters = (locale: string): LocaleManager.IntlFormatters => ({

    number: (value: number, opts?: Intl.NumberFormatOptions) =>
        getNumberFormat(locale, opts).format(value),

    date: (value: Date | number, opts?: Intl.DateTimeFormatOptions) =>
        getDateFormat(locale, opts).format(value),

    relative: (value: number, unit: Intl.RelativeTimeFormatUnit, opts?: Intl.RelativeTimeFormatOptions) =>
        getRelativeFormat(locale, opts).format(value, unit),
});
