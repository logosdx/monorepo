import {
    StrOrNum,
    PathsToValues
} from '@logos-ui/utils';

export type LocaleType = {
    [K in StrOrNum]: StrOrNum | LocaleType;
};

export const reachIn = <T = any>(obj: LocaleType, path: PathsToValues<LocaleType>, defValue: any): T | undefined => {

    // If path is not defined or it has false value
    if (!path) {
        return;
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


export type LocaleReacher<T> = PathsToValues<T>;
export type LocaleFormatArgs = Array<StrOrNum> | Record<StrOrNum, StrOrNum>;
export const format = (str: string, values: LocaleFormatArgs) => {

    const args = Object.entries(values);

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

    const str = reachIn(locale, reach, '?') as string;

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