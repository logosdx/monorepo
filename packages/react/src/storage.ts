import {
    createContext,
    createElement,
    useContext,
    useEffect,
    useState,
} from 'react';

import type { StorageAdapter } from '@logosdx/storage';
import type { ProviderProps } from './types.ts';
import { NullableObject } from '../../utils/dist/types/types';

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
 *     const storage = new StorageAdapter<AppStore>(localStorage, 'myapp');
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
 *     const { get, set, remove, assign, has, clear, wrap, keys, instance } = useAppStorage();
 *
 *     get('theme');                          // 'dark'
 *     get();                                 // { theme: 'dark', userId: '...' ... }
 *     set('theme', 'light');                 // triggers re-render
 *     set({ theme: 'dark', userId: '42' }); // bulk set, triggers re-render
 *     remove('userId');                      // triggers re-render
 *     assign('preferences', { lang: 'es' });// Object.assign on the value
 *     has('theme');                          // true
 *     clear();                               // removes all prefixed keys
 *     wrap('theme');                         // { get, set, remove, assign }
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

            storage.on('storage-after-set', listener);
            storage.on('storage-after-unset', listener);
            storage.on('storage-reset', listener);

            return () => {

                storage.off('storage-after-set', listener);
                storage.off('storage-after-unset', listener);
                storage.off('storage-reset', listener);
            };
        }, [storage]);

        return {
            get: storage.get.bind(storage),
            getMany: storage.get.bind(storage),
            set: storage.set.bind(storage),
            setMany: storage.set.bind(storage),
            remove: storage.rm.bind(storage),
            assign: storage.assign.bind(storage),
            has: storage.has.bind(storage) as UseStorageReturn<Values>['has'],
            clear: storage.clear.bind(storage),
            wrap: storage.wrap.bind(storage),
            keys: storage.keys.bind(storage),
            instance: storage,
        };
    }

    return [Provider, useHook];
}


type UseStorageReturn<Values> = {
    get: {
        (): Values;
        <K extends keyof Values>(key: K): Values[K];
    };
    getMany: {
        <K extends keyof Values>(keys: K[]): Partial<NullableObject<Values>>;
    }
    set: {
        <K extends keyof Values>(key: K, value: Values[K]): void;
        (values: Partial<Values>): void;
    };
    setMany: (values: Partial<Values>) => void;
    remove: <K extends keyof Values>(keyOrKeys: K | K[]) => void;
    assign: <K extends keyof Values>(key: K, val: Partial<Values[K]>) => void;
    has: {
        (key: keyof Values): boolean;
        (keys: (keyof Values)[]): boolean[];
    };
    clear: () => void;
    wrap: StorageAdapter<Values>['wrap'];
    keys: () => (keyof Values)[];
    instance: StorageAdapter<Values>;
};
