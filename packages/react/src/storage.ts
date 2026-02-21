import {
    createContext,
    createElement,
    useContext,
    useEffect,
    useState,
} from 'react';

import type { StorageAdapter } from '@logosdx/storage';
import type { ProviderProps, UseStorageReturn } from './types.ts';

/**
 * Creates a React context + hook pair bound to a specific StorageAdapter instance.
 * Returns a `[Provider, useHook]` tuple — rename to whatever fits your domain.
 *
 * **Setup:**
 *
 *     import { StorageAdapter } from '@logosdx/storage';
 *     import { createStorageContext } from '@logosdx/react';
 *
 *     interface AppStore {
 *         theme: 'light' | 'dark';
 *         userId: string;
 *         preferences: { lang: string; notifications: boolean };
 *     }
 *
 *     const storage = new StorageAdapter<AppStore>({
 *         driver: new WebStorageDriver(localStorage),
 *         prefix: 'myapp',
 *     });
 *
 *     export const [AppStorage, useAppStorage] = createStorageContext(storage);
 *
 * **Wrap your app:**
 *
 *     <AppStorage>
 *         <App />
 *     </AppStorage>
 *
 * **Use in components — any mutation triggers a re-render automatically:**
 *
 *     function ThemeSwitcher() {
 *
 *         const { get, set } = useAppStorage();
 *
 *         // Reads current value — re-renders when any storage key changes
 *         const theme = get('theme');
 *
 *         return (
 *             <button onClick={() => set('theme', theme === 'dark' ? 'light' : 'dark')}>
 *                 Current: {theme}
 *             </button>
 *         );
 *     }
 *
 * **Full API — typed pass-throughs to StorageAdapter:**
 *
 *     const { get, set, remove, assign, has, clear, scope, keys, instance } = useAppStorage();
 *
 *     get('theme');                          // 'dark'
 *     get();                                 // { theme: 'dark', userId: '...' ... }
 *     set('theme', 'light');                 // triggers re-render
 *     set({ theme: 'dark', userId: '42' }); // bulk set, triggers re-render
 *     remove('userId');                      // triggers re-render
 *     assign('preferences', { lang: 'es' });// Object.assign on the value
 *     has('theme');                          // true
 *     clear();                               // removes all prefixed keys
 *     scope('theme');                         // scoped adapter for a single key
 *     keys();                                // ['theme', 'userId', ...]
 *
 * @param instance - The StorageAdapter to bind to
 * @returns `[Provider, useHook]` tuple
 */
export function createStorageContext<Values>(
    instance: StorageAdapter<Values>
): [
    (props: ProviderProps) => ReturnType<typeof createElement>,
    () => UseStorageReturn<Values>
] {

    const Context = createContext<StorageAdapter<Values>>(instance);

    function Provider(props: ProviderProps) {

        return createElement(Context.Provider, { value: instance }, props.children);
    }

    function useHook(): UseStorageReturn<Values> {

        const storage = useContext(Context);
        const [, setTick] = useState(0);

        useEffect(() => {

            const listener = () => setTick(n => n + 1);

            storage.on('after-set', listener);
            storage.on('after-remove', listener);
            storage.on('clear', listener);

            return () => {

                storage.off('after-set', listener);
                storage.off('after-remove', listener);
                storage.off('clear', listener);
            };
        }, [storage]);

        return {
            get: storage.get.bind(storage),
            set: storage.set.bind(storage),
            remove: storage.rm.bind(storage),
            assign: storage.assign.bind(storage),
            has: storage.has.bind(storage) as UseStorageReturn<Values>['has'],
            clear: storage.clear.bind(storage),
            keys: storage.keys.bind(storage),
            scope: storage.scope.bind(storage),
            instance: storage,
        };
    }

    return [Provider, useHook];
}
