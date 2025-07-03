import {
    StrOrNum,
    PathLeaves,
    PathValue
} from '@logosdx/utils';

import type { LocaleManager } from './manager.ts';

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

    // Find value
    const result = pathArray.reduce(
        (prevObj, key) => {

            if (
                prevObj &&
                prevObj[key] !== undefined
            ) {
                return prevObj[key] as O;
            }

            return prevObj;
        },
        obj
    );

    // If found value is undefined return default value; otherwise return the value
    return (
        result === undefined ? defValue : result
    ) as PathValue<O, P>;
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

        values = values.filter(v => v !== undefined || v !== null);
    }

    if (values.length === 0) {
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

        str = str?.replace(new RegExp(`\\{${key}\\}`, 'gi'), value.toString());
    }

    return str;
};

export const getMessage = <L extends LocaleManager.LocaleType>(
    locale: L,
    reach: LocaleManager.LocaleReacher<L>,
    values?: LocaleManager.LocaleFormatArgs
) => {

    const str = reachIn(locale, reach, '?' as never) as string;

    return format(str, values || []);
};


export const LOC_CHANGE = 'locale-change';

export class LocaleEvent<Code extends string = string> extends Event {
    code!: Code;
}
