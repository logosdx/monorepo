import { LocaleManager } from '@logosdx/localize';
import en from '../locales/en.json';
import type { Locale, LocaleCodes } from './locale-types.ts';

export const i18n = new LocaleManager<Locale, LocaleCodes>({
    current: 'en',
    fallback: 'en',
    locales: {
        en: { code: 'en', text: 'English', labels: en },
        es: { code: 'es', text: 'Español', labels: en },
        fr: { code: 'fr', text: 'Français', labels: en },
    },
});

i18n.register('es', {
    text: 'Español',
    loader: () => import('../locales/es.json').then(m => m.default),
});

i18n.register('fr', {
    text: 'Français',
    loader: () => import('../locales/fr.json').then(m => m.default),
});

export type { Locale, LocaleCodes };
