import {
    StrOrNum,
    PathsToValues
} from '@logos-ui/utils';

export type L10nLocale = {
    [K in StrOrNum]: StrOrNum | L10nLocale;
};

export const reachIn = <T = any>(obj: L10nLocale, path: PathsToValues<L10nLocale>, defValue: any): T => {

    // If path is not defined or it has false value
    if (!path) return undefined

    // Check if path is string or array. Regex : ensure that we do not have '.' and brackets.
    // Regex explained: https://regexr.com/58j0k
    const pathArray = Array.isArray(path) ? path : path.match(/([^[.\]])+/g)

    // Find value
    const result = pathArray.reduce(
        (prevObj, key) => prevObj && prevObj[key],
        obj as any
    );

    // If found value is undefined return default value; otherwise return the value
    return result === undefined ? defValue : result
}

export const deepMerge = <T extends L10nLocale>(target: T, ...sources: T[]) => {

    for (const source of sources) {

        for (const k in source) {

            if (typeof source[k] === 'object') {

                const _t = (target || {}) as L10nLocale;

                target[k] = deepMerge(
                    (_t)[k] || {},
                    source[k] as L10nLocale
                ) as any;
            }
            else {

                target[k] = source[k];
            }
        }
    }


    return target;
}


export type L10nReacher<T> = PathsToValues<T>;
export type L10nFormatArgs = Array<StrOrNum> | Record<StrOrNum, StrOrNum>;
export const format = (str: string, values: L10nFormatArgs) => {

    const args = Object.entries(values);

    for (const [key, value] of args) {
        str = str?.replace(new RegExp(`\\{${key}\\}`, 'gi'), value.toString());
    }

    return str;
};

export const getMessage = <L extends L10nLocale>(
    locale: L,
    reach: L10nReacher<L>,
    values?: L10nFormatArgs
) => {

    const str = reachIn(locale, reach, '?') as string;

    return format(str, values || []);
};


export const LOC_CHANGE = 'locale-change';

export class L10nEvent<Code extends string = string, C = any> extends Event {
    component?: C;
    code: Code;
}

export type L10nEventName = (
    'locale-change'
);

export type L10nListener<Code extends string = string> = (e: L10nEvent<Code, any>) => void;