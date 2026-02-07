import {
    createContext,
    createElement,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import { attempt } from '@logosdx/utils';
import type { FetchEngine, CallConfig, FetchResponse, FetchError } from '@logosdx/fetch';
import type { ProviderProps } from './types.ts';

/**
 * Creates a React context + hook pair bound to a specific FetchEngine instance.
 * Returns a `[Provider, useHook]` tuple — rename to whatever fits your domain.
 *
 * **Setup:**
 *
 *     import { FetchEngine } from '@logosdx/fetch';
 *     import { createFetchContext } from '@logosdx/react';
 *
 *     const api = new FetchEngine({ baseUrl: 'https://api.example.com' });
 *
 *     export const [ApiFetch, useApiFetch] = createFetchContext(api);
 *
 * **Wrap your app:**
 *
 *     <ApiFetch>
 *         <App />
 *     </ApiFetch>
 *
 * **Queries — auto-fetch on mount, re-fetch when path/options change:**
 *
 * Returns `[cancel, isLoading, response, error]`. The response is the
 * full `FetchResponse` (access `.data`, `.status`, `.headers`). The
 * error is a `FetchError` with `.status`, `.isCancelled()`, `.isTimeout()`, etc.
 *
 *     function UserList() {
 *
 *         const { get } = useApiFetch();
 *
 *         // Fetches immediately, returns reactive state
 *         const [cancel, isLoading, res, error] = get<User[]>('/users');
 *
 *         // With typed response headers
 *         const [, , res2] = get<Post, { 'x-total': string }>(`/posts`);
 *         // res2?.headers['x-total'] is typed
 *
 *         if (isLoading) return <Spinner />;
 *         if (error) return <Error message={error.message} status={error.status} />;
 *
 *         return <ul>{res?.data.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
 *     }
 *
 * **Mutations — fire on demand, track loading/result/error:**
 *
 * Returns `[trigger, cancel, isLoading, response, error]`. Starts idle
 * (`isLoading: false`) until `trigger()` is called.
 *
 *     function CreateComment() {
 *
 *         const { post, del } = useApiFetch();
 *
 *         const [submit, cancelSubmit, isSubmitting, result, submitErr] = post<Comment>('/comments');
 *         const [remove, cancelRemove, isRemoving, _, removeErr] = del<void>('/comments/123');
 *
 *         return (
 *             <form onSubmit={() => submit({ text: 'Hello' })}>
 *                 <button disabled={isSubmitting}>
 *                     {isSubmitting ? 'Sending...' : 'Submit'}
 *                 </button>
 *                 {result && <p>Comment created: {result.data.id}</p>}
 *                 {submitErr && <p>Failed ({submitErr.status}): {submitErr.message}</p>}
 *             </form>
 *         );
 *     }
 *
 * **Escape hatch — `instance` gives raw access to the FetchEngine:**
 *
 *     const { instance } = useApiFetch();
 *     // For imperative one-off requests in event handlers
 *     const handleExport = async () => {
 *         const [res, err] = await attempt(() => instance.get('/export'));
 *     };
 *
 * **Rules:** `get`, `post`, `put`, `del`, and `patch` call React hooks
 * internally, so they follow the same rules — call them at the top level
 * of your component, never conditionally or in loops.
 *
 * @param instance - The FetchEngine to bind to
 * @returns `[Provider, useHook]` tuple
 */
export function createFetchContext<
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    S = FetchEngine.InstanceState,
    RH = FetchEngine.InstanceResponseHeaders,
    F extends FetchEngine<H, P, S, RH> = FetchEngine<H, P, S, RH>
>(instance: F) {

    const Context = createContext(instance);

    function Provider(props: ProviderProps) {

        return createElement(Context.Provider, { value: instance }, props.children);
    }

    function useHook() {

        const engine = useContext(Context);

        function get<Res = unknown, RH = FetchEngine.InstanceResponseHeaders>(
            path: string,
            options?: CallConfig<H, P>
        ) {

            const key = path + (options ? JSON.stringify(options) : '');

            const [isLoading, setIsLoading] = useState(true);
            const [data, setData] = useState<FetchResponse<Res, any, any, RH> | null>(null);
            const [error, setError] = useState<FetchError | null>(null);
            const abortController = useRef<AbortController | null>(null);

            useEffect(() => {

                abortController.current = new AbortController();

                setIsLoading(true);

                const promise = attempt(
                    () => engine.get<Res>(path, {
                        ...options,
                        abortController: abortController.current!,
                    })
                )

                promise.then(([res, err]) => {

                    if (abortController.current!.signal.aborted) return;

                    if (err) {

                        setIsLoading(false);
                        setData(null);
                        setError(err as FetchError);
                        return;
                    }

                    setIsLoading(false);
                    setData(res! as never);
                    setError(null);
                });

                return () => abortController.current?.abort();
            }, [key]);

            const cancel = useCallback(() => {
                abortController.current?.abort();
            }, []);

            return [cancel, isLoading, data, error] as const;
        }

        function makeMutation<Res = unknown, RH = FetchEngine.InstanceResponseHeaders>(
            method: 'post' | 'put' | 'delete' | 'patch',
            path: string,
            options?: CallConfig<H, P>
        ) {

            const [isLoading, setIsLoading] = useState(false);
            const [data, setData] = useState<FetchResponse<Res, any, any, RH> | null>(null);
            const [error, setError] = useState<FetchError | null>(null);
            const abortController = useRef<AbortController | null>(null);

            const trigger = useCallback(<Payload>(payload?: Payload) => {

                abortController.current = new AbortController();

                setIsLoading(true);
                setData(null);
                setError(null);

                const engineMethod = engine[method].bind(engine);

                const promise = attempt(
                    () => engineMethod<Res>(path, payload, {
                        ...options,
                        abortController: abortController.current!,
                    })
                );

                promise.then(([res, err]) => {

                    if (err) {

                        setIsLoading(false);
                        setData(null);
                        setError(err as FetchError);
                        return;
                    }

                    setIsLoading(false);
                    setData(res! as never);
                    setError(null);
                });

            }, [path]);

            const cancel = useCallback(() => {
                abortController.current?.abort();
            }, []);

            return [trigger, cancel, isLoading, data, error] as const;
        }

        function post<Res = unknown, RH = FetchEngine.InstanceResponseHeaders>(
            path: string, options?: CallConfig<H, P>
        ) {

            return makeMutation<Res, RH>('post', path, options);
        }

        function put<Res = unknown, RH = FetchEngine.InstanceResponseHeaders>(
            path: string, options?: CallConfig<H, P>
        ) {

            return makeMutation<Res, RH>('put', path, options);
        }

        function del<Res = unknown, RH = FetchEngine.InstanceResponseHeaders>(
            path: string, options?: CallConfig<H, P>
        ) {

            return makeMutation<Res, RH>('delete', path, options);
        }

        function patch<Res = unknown, RH = FetchEngine.InstanceResponseHeaders>(
            path: string, options?: CallConfig<H, P>
        ) {

            return makeMutation<Res, RH>('patch', path, options);
        }

        return {
            get,
            post,
            put,
            del,
            patch,
            instance: engine
        };
    }

    return [Provider, useHook] as const;
}
