export type { LocType } from './english';
import { english, LocType } from './english';
import { spanish } from './spanish';

export const languages = {
    en: {
        text: 'English',
        labels: english
    },
    es: {
        text: 'Spanish',
        labels: spanish
    }
};

export type LocCodes = keyof typeof languages;

const langEntries = Object.entries(languages) as [
    LocCodes,
    { text: string, labels: LocType }
][];

export const locales = Object.fromEntries(
    langEntries.map(
        ([code, lang]) => [code as LocCodes, {
            ...lang,
            code
        }]
    )
) as Record<LocCodes, { code: LocCodes, text: string, labels: LocType }>;
