/**
 * ICU-lite plural parser.
 *
 * Parses `{varName, plural, one {# item} other {# items}}` syntax
 * and resolves using `Intl.PluralRules` for locale-aware category selection.
 *
 * @example
 *
 *     parsePlural('{count, plural, one {# thing} other {# things}}', { count: 5 }, 'en')
 *     // > '5 things'
 */

import type { StrOrNum } from '@logosdx/utils';
import type { LocaleManager } from './manager.ts';

const PLURAL_PATTERN = /\{(\w+),\s*plural,\s*((?:[^{}]|\{[^{}]*\})+)\}/g;
const CATEGORY_PATTERN = /(\w+)\s*\{([^}]*)\}/g;

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

const rulesCache = new Map<string, Intl.PluralRules>();

const getRules = (locale: string): Intl.PluralRules => {

    let rules = rulesCache.get(locale);

    if (!rules) {

        rules = new Intl.PluralRules(locale);
        rulesCache.set(locale, rules);
    }

    return rules;
};

const parseCategories = (body: string): Map<PluralCategory, string> => {

    const categories = new Map<PluralCategory, string>();

    let match: RegExpExecArray | null;
    CATEGORY_PATTERN.lastIndex = 0;

    while ((match = CATEGORY_PATTERN.exec(body)) !== null) {

        categories.set(match[1] as PluralCategory, match[2]!);
    }

    return categories;
};

export const parsePlural = (
    str: string,
    values: LocaleManager.LocaleFormatArgs,
    locale: string
): string => {

    if (!str || typeof str !== 'string' || !str.includes('plural')) {
        return str;
    }

    const valuesRecord = (
        Array.isArray(values) ? {} : values
    ) as Record<StrOrNum, StrOrNum>;

    PLURAL_PATTERN.lastIndex = 0;

    return str.replace(PLURAL_PATTERN, (_match, varName: string, body: string) => {

        const count = Number(valuesRecord[varName]);

        if (isNaN(count)) {
            return _match;
        }

        const categories = parseCategories(body);
        const rules = getRules(locale);
        const category = rules.select(count) as PluralCategory;

        // Try exact category first, then 'other' as fallback
        const template = (
            (count === 0 && categories.has('zero'))
                ? categories.get('zero')!
                : categories.get(category) ?? categories.get('other') ?? _match
        );

        return template.replace(/#/g, count.toString());
    });
};
