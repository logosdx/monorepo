import {
    createContext,
    createElement,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import type { ObserverEngine } from '@logosdx/observer';
import type { ProviderProps } from './types.ts';
import { noop } from '@logosdx/utils';

/**
 * Creates a React context + hook pair bound to a specific ObserverEngine instance.
 * Returns a `[Provider, useHook]` tuple — rename to whatever fits your domain.
 *
 * **Setup (run once, e.g. in a `setup.ts` file):**
 *
 *     import { ObserverEngine } from '@logosdx/observer';
 *     import { createObserverContext } from '@logosdx/react';
 *
 *     interface ApiEvents {
 *         'user.login': { userId: string };
 *         'user.logout': { userId: string };
 *         'notification': { message: string };
 *     }
 *
 *     const apiEngine = new ObserverEngine<ApiEvents>();
 *
 *     // Multiple contexts from different engines — rename freely
 *     export const [ApiObserver, useApiObserver] = createObserverContext(apiEngine);
 *     export const [ChatObserver, useChatEvents] = createObserverContext(chatEngine);
 *
 * **Wrap your app (providers need no props — instance is captured):**
 *
 *     <ApiObserver>
 *         <ChatObserver>
 *             <App />
 *         </ChatObserver>
 *     </ApiObserver>
 *
 * **Use in components:**
 *
 *     function UserStatus() {
 *
 *         const { on, once, oncePromise, emit, emitFactory } = useApiObserver();
 *
 *         // Subscribe — re-subscribes if callback identity changes,
 *         // so wrap handlers with useCallback to keep them stable
 *         const handler = useCallback((data) => {
 *             console.log('logged in:', data.userId);
 *         }, []);
 *
 *         on('user.login', handler);
 *
 *         // One-shot listener with a callback
 *         const initHandler = useCallback((data) => {
 *             console.log('init:', data);
 *         }, []);
 *
 *         once('app.init', initHandler);
 *
 *         // One-shot listener as a reactive tuple (no callback needed)
 *         const [waiting, data, cancel] = oncePromise('notification');
 *         // waiting: true until the event fires, then false
 *         // data: null until resolved, then the event payload
 *         // cancel: call to stop listening early
 *
 *         // Fire events — emit is already stable (bound to engine)
 *         emit('user.logout', { userId: '123' });
 *
 *         // Or get a memoized emitter for a specific event
 *         const logout = emitFactory('user.logout');
 *         // <button onClick={() => logout({ userId: '123' })} />
 *
 *         return <div>{waiting ? 'Waiting...' : data?.message}</div>;
 *     }
 *
 * **Rules:** `on`, `once`, `oncePromise`, and `emitFactory` call React hooks
 * internally, so they follow the same rules as hooks — call them at the
 * top level of your component, never conditionally or in loops.
 *
 * @param instance - The ObserverEngine to bind to
 * @returns `[Provider, useHook]` tuple
 */
export function createObserverContext<
    Shape extends Record<string, any>
>(instance: ObserverEngine<Shape>): [
    (props: ProviderProps) => ReturnType<typeof createElement>,
    () => UseObserverReturn<Shape>
] {

    const Context = createContext<ObserverEngine<Shape>>(instance);

    function Provider(props: ProviderProps) {

        return createElement(Context.Provider, { value: instance }, props.children);
    }

    function useHook(): UseObserverReturn<Shape> {

        const engine = useContext(Context);

        function on<E extends keyof Shape>(
            event: E,
            callback: (data: Shape[E]) => void
        ) {

            useEffect(() => engine.on(event, callback), [event, callback]);
        }

        function once<E extends keyof Shape>(
            event: E,
            callback: (data: Shape[E]) => void
        ) {

            useEffect(() => engine.once(event, callback), [event, callback]);
        }

        function oncePromise<E extends keyof Shape>(event: E) {

            const [waiting, setWaiting] = useState(true);
            const [data, setData] = useState<Shape[E] | null>(null);
            const cancel = useRef<() => void>(noop);

            useEffect(() => {

                const promise = engine.once(event);

                promise.then((result) => {
                    setData(result);
                    setWaiting(false);
                });

                cancel.current = () => promise.cleanup?.();

                return () => promise.cleanup?.();

            }, [event]);

            return [waiting, data, cancel.current] as const;
        }

        function emitFactory<E extends keyof Shape>(event: E) {

            return useCallback(
                (data?: Shape[E]) => engine.emit(event, data),
                [engine, event]
            );
        }

        return {
            on,
            once,
            oncePromise,
            emitFactory,
            emit: engine.emit.bind(engine),
            instance: engine,
        };
    }

    return [Provider, useHook];
}

type UseObserverReturn<Shape extends Record<string, any>> = {
    on: <E extends keyof Shape>(
        event: E,
        callback: (data: Shape[E]) => void
    ) => void;
    once: <E extends keyof Shape>(
        event: E,
        callback: (data: Shape[E]) => void
    ) => void;
    oncePromise: <E extends keyof Shape>(
        event: E
    ) => readonly [waiting: boolean, data: Shape[E] | null, cancel: () => void];
    emitFactory: <E extends keyof Shape>(
        event: E
    ) => (data?: Shape[E]) => void;
    emit: <E extends keyof Shape>(
        event: E,
        data?: Shape[E]
    ) => void;
    instance: ObserverEngine<Shape>;
};
