import {
    StrOrNum,
    PathLeaves,
    GetFieldType,
    DeepOptional
} from '@logos-ui/utils';

import type { LocaleEvent } from './helpers.ts';

declare module './factory.ts' {

    export namespace LocaleFactory {

        export type LocaleReacher<T> = PathLeaves<T>;
        export type LocaleFormatArgs = Array<StrOrNum> | Record<StrOrNum, StrOrNum>;

        export type LocaleType = {
            [K in StrOrNum]: StrOrNum | LocaleType;
        };


        export type ManyLocales<Locale extends LocaleType, Code extends string> = {
            [P in Code]: {
                code: Code,
                text: string,
                labels: Locale | DeepOptional<Locale>
            }
        }

        export type LocaleOpts<
            Locale extends LocaleType,
            Code extends string = string
        > = {

            current: Code,
            fallback: Code
            locales: ManyLocales<Locale, Code>
        }


        export type LocaleEventName = (
            'locale-change'
        );

        export type LocaleListener<Code extends string = string> = (e: LocaleEvent<Code>) => void;
    }
}
