import {
    StrOrNum,
    PathLeaves,
    PathValue
} from '@logosdx/utils';

import type { LocaleManager } from './manager.ts';

const regexCache = new Map<string, RegExp>();

const getPlaceholderRegex = (key: string) => {

    let regex = regexCache.get(key);

    if (!regex) {

        regex = new RegExp(`\\{${key}\\}`, 'gi');
        regexCache.set(key, regex);
    }

    return regex;
};

export const reachIn = <
    O extends LocaleManager.LocaleType = LocaleManager.LocaleType,
    P extends PathLeaves<O> = PathLeaves<O>,
    D extends PathValue<O, P> = PathValue<O, P>
>(obj: O, path: P, defValue: D): PathValue<O, P> | undefined => {

    // If path is not defined or it has false value
    if (!path) {
        return;
    }

    // Allow for passing a flat object
    if (obj[path] !== undefined) {
        return obj[path] as PathValue<O, P>;
    }

    // Check if path is string or array. Regex : ensure that we do not have '.' and brackets.
    // Regex explained: https://regexr.com/58j0k
    const pathArray = Array.isArray(path) ? path as string[] : path.match(/([^[.\]])+/g)!

    let found = true;

    const result = pathArray.reduce(
        (prevObj, key) => {

            if (
                prevObj &&
                prevObj[key] !== undefined
            ) {
                return prevObj[key] as O;
            }

            found = false;
            return undefined as unknown as O;
        },
        obj
    );

    if (!found || result === undefined) {
        return defValue as PathValue<O, P>;
    }

    return result as PathValue<O, P>;
}

/**
 * converts a nested object to a flat object
 * where the keys are the paths to the values
 * in 'key.key.key' format
 */
const objToFlatEntries = <T extends object>(obj: T) => {

    const flattened: [string, string][] = [];

    if (typeof obj !== 'object') {
        return flattened;
    }

    const flatten = (o: unknown, prefix: string) => {

        if (!o) {
            return;
        }

        for (
            const [key, value] of
            Object.entries(o) as [string, unknown][]
        ) {

            const path = prefix ? `${prefix}.${key}` : key;

            if (typeof value === 'object') {
                flatten(value, path);
            }
            else {
                flattened.push([path, value as string]);
            }
        }
    };

    flatten(obj, '');

    return flattened;
}

export const format = (str: string, values: LocaleManager.LocaleFormatArgs) => {

    if (Array.isArray(values)) {

        values = values.filter(v => v !== undefined && v !== null);
    }

    const isEmpty = Array.isArray(values)
        ? values.length === 0
        : Object.keys(values).length === 0;

    if (isEmpty) {
        return str;
    }

    const flatVals = objToFlatEntries(values) as [string, StrOrNum][];

    const args = flatVals.filter(

        ([,v]) => (
            typeof v === 'number' ||
            typeof v === 'string' ||
            typeof v === 'boolean' ||
            typeof v === 'bigint'
        )
    );

    for (const [key, value] of args) {

        const regex = getPlaceholderRegex(key);
        regex.lastIndex = 0;
        str = str?.replace(regex, value.toString());
    }

    return str;
};

export const getMessage = <L extends LocaleManager.LocaleType>(
    locale: L,
    reach: LocaleManager.LocaleReacher<L>,
    values?: LocaleManager.LocaleFormatArgs
) => {

    const missingKey = `[${reach as string}]`;
    const str = reachIn(locale, reach, missingKey as never) as string;

    if (str === missingKey && process.env.NODE_ENV !== 'production') {

        console.warn(`Missing translation key: "${reach as string}"`);
    }

    return format(str, values || []);
};


export class LocaleEvent<Code extends string = string> extends Event {
    code!: Code;
}
