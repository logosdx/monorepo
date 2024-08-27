import {
    StrOrNum,
    PathLeaves,
    GetFieldType
} from '@logos-ui/utils';

export type LocaleType = {
    [K in StrOrNum]: StrOrNum | LocaleType;
};

export const reachIn = <
    O extends LocaleType = LocaleType,
    P extends PathLeaves<O> = PathLeaves<O>,
    D extends GetFieldType<O, P> = GetFieldType<O, P>
>(obj: O, path: P, defValue: D): GetFieldType<O, P> | undefined => {

    // If path is not defined or it has false value
    if (!path) {
        return;
    }

    // Allow for passing a flat object
    if (obj[path] !== undefined) {
        return obj[path] as GetFieldType<O, P>;
    }

    // Check if path is string or array. Regex : ensure that we do not have '.' and brackets.
    // Regex explained: https://regexr.com/58j0k
    const pathArray = Array.isArray(path) ? path as string[] : path.match(/([^[.\]])+/g)!

    // Find value
    const result = pathArray.reduce(
        (prevObj, key) => prevObj && prevObj[key],
        obj as any
    );

    // If found value is undefined return default value; otherwise return the value
    return result === undefined ? defValue : result
}

export type LocaleReacher<T> = PathLeaves<T>;
export type LocaleFormatArgs = Array<StrOrNum> | Record<StrOrNum, StrOrNum>;

/**
 * converts a nested object to a flat object
 * where the keys are the paths to the values
 * in 'key.key.key' format
 */
const objToFlatEntries = <T extends object>(obj: T) => {

    const flattened: [string, any][] = [];

    if (typeof obj !== 'object') {
        return flattened;
    }

    const flatten = (o: any, prefix: string) => {

        if (!o) {
            return;
        }

        for (const [key, value] of Object.entries(o)) {

            const path = prefix ? `${prefix}.${key}` : key;

            if (typeof value === 'object') {
                flatten(value, path);
            } else {
                flattened.push([path, value]);
            }
        }
    };

    flatten(obj, '');

    return flattened;
}

export const format = (str: string, values: LocaleFormatArgs) => {

    if (values.length === 0) {
        return str;
    }

    if (Array.isArray(values)) {

        values = values.filter(v => v !== undefined || v !== null);
    }

    const flatVals = objToFlatEntries(values);

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

export const getMessage = <L extends LocaleType>(
    locale: L,
    reach: LocaleReacher<L>,
    values?: LocaleFormatArgs
) => {

    const str = reachIn(locale, reach, '?' as never) as string;

    return format(str, values || []);
};


export const LOC_CHANGE = 'locale-change';

export class LocaleEvent<Code extends string = string> extends Event {
    code!: Code;
}

export type LocaleEventName = (
    'locale-change'
);

export type LocaleListener<Code extends string = string> = (e: LocaleEvent<Code>) => void;