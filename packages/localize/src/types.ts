import {
    StrOrNum,
    PathLeaves,
    DeepOptional
} from '@logosdx/utils';

import type { LocaleEvent } from './helpers.ts';

declare module './manager.ts' {

    export namespace LocaleManager {

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


        export interface LazyLocale<Locale extends LocaleType> {
            text: string;
            loader: () => Promise<Locale>;
        }

        export type LocaleEventName = (
            'change' | 'loading' | 'error'
        );

        export type LocaleListener<Code extends string = string> = (e: LocaleEvent<Code>) => void;

        export interface IntlFormatters {
            number(value: number, opts?: Intl.NumberFormatOptions): string;
            date(value: Date | number, opts?: Intl.DateTimeFormatOptions): string;
            relative(value: number, unit: Intl.RelativeTimeFormatUnit, opts?: Intl.RelativeTimeFormatOptions): string;
        }
    }
}
