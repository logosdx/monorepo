import {
    createContext,
    createElement,
    useContext,
    useEffect,
    useState,
} from 'react';

import type { LocaleManager } from '@logosdx/localize';
import type { ProviderProps, UseLocalizeReturn } from './types.ts';

/**
 * Creates a React context + hook pair bound to a specific LocaleManager instance.
 * Returns a `[Provider, useHook]` tuple — rename to whatever fits your domain.
 *
 * **Setup:**
 *
 *     import { LocaleManager } from '@logosdx/localize';
 *     import { createLocalizeContext } from '@logosdx/react';
 *
 *     const locales = new LocaleManager({
 *         current: 'en',
 *         fallback: 'en',
 *         locales: {
 *             en: { code: 'en', text: 'English', labels: {
 *                 home: { greeting: 'Hello, {name}!' },
 *                 nav: { logout: 'Log out' },
 *             }},
 *             es: { code: 'es', text: 'Español', labels: {
 *                 home: { greeting: '¡Hola, {name}!' },
 *                 nav: { logout: 'Cerrar sesión' },
 *             }},
 *         },
 *     });
 *
 *     export const [AppLocale, useAppLocale] = createLocalizeContext(locales);
 *
 * **Wrap your app:**
 *
 *     <AppLocale>
 *         <App />
 *     </AppLocale>
 *
 * **Use in components — switching locale triggers a re-render automatically:**
 *
 *     function Greeting() {
 *
 *         const { t, locale, changeTo, locales } = useAppLocale();
 *
 *         return (
 *             <div>
 *                 <h1>{t('home.greeting', { name: 'World' })}</h1>
 *                 <p>Current: {locale}</p>
 *
 *                 {locales.map(({ code, text }) => (
 *                     <button key={code} onClick={() => changeTo(code)}>
 *                         {text}
 *                     </button>
 *                 ))}
 *             </div>
 *         );
 *     }
 *
 * @param instance - The LocaleManager to bind to
 * @returns `[Provider, useHook]` tuple
 */
export function createLocalizeContext<
    Locale extends LocaleManager.LocaleType,
    Code extends string = string
>(instance: LocaleManager<Locale, Code>): [
    (props: ProviderProps) => ReturnType<typeof createElement>,
    () => UseLocalizeReturn<Locale, Code>
] {

    const Context = createContext<LocaleManager<Locale, Code>>(instance);

    function Provider(props: ProviderProps) {

        return createElement(Context.Provider, { value: instance }, props.children);
    }

    function useHook(): UseLocalizeReturn<Locale, Code> {

        const manager = useContext(Context);
        const [language, setLanguage] = useState(manager.current); // trigger re-render on language change

        useEffect(() => {

            return manager.on('change', ({ code }) => setLanguage(code));
        }, [manager]);

        return {
            t: manager.t.bind(manager) as UseLocalizeReturn<Locale, Code>['t'],
            locale: language,
            changeTo: manager.changeTo.bind(manager),
            locales: manager.locales,
            instance: manager,
        };
    }

    return [Provider, useHook];
}
