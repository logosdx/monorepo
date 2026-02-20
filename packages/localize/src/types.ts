import {
    StrOrNum,
    PathLeaves,
    DeepOptional
} from '@logosdx/utils';

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

        export interface LocaleEventShape<Code extends string = string> {
            change: { code: Code };
            loading: { code: Code };
            error: { code: Code };
        }

        export type LocaleEventName = keyof LocaleEventShape;

        export type LocaleListener<Code extends string = string> = (data: { code: Code }) => void;

        export interface IntlFormatters {
            number(value: number, opts?: Intl.NumberFormatOptions): string;
            date(value: Date | number, opts?: Intl.DateTimeFormatOptions): string;
            relative(value: number, unit: Intl.RelativeTimeFormatUnit, opts?: Intl.RelativeTimeFormatOptions): string;
        }
    }
}
