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
import type { ProviderProps, FetchContextQueryResult, FetchContextMutationResult } from './types.ts';

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
 * Returns `{ data, loading, error, response, refetch, cancel }`.
 * `data` is the unwrapped `T`. `response` provides full `FetchResponse`
 * access (status, headers). `error` is a `FetchError` with `.status`,
 * `.isCancelled()`, `.isTimeout()`, etc.
 *
 *     function UserList() {
 *
 *         const { get } = useApiFetch();
 *
 *         const { data, loading, error, refetch } = get<User[]>('/users');
 *
 *         // Full response access for headers/status
 *         const { response } = get<Post, { 'x-total': string }>('/posts');
 *         // response?.headers['x-total'] is typed
 *
 *         if (loading) return <Spinner />;
 *         if (error) return <Error message={error.message} status={error.status} />;
 *
 *         return <ul>{data?.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
 *     }
 *
 * **Mutations — fire on demand, track loading/result/error:**
 *
 * Returns `{ data, loading, error, response, mutate, reset, cancel, called }`.
 * Starts idle (`loading: false`, `called: false`) until `mutate()` is called.
 * `mutate()` returns `Promise<T>` so you can await the result.
 *
 *     function CreateComment() {
 *
 *         const { post, del } = useApiFetch();
 *
 *         const { mutate: submit, loading: isSubmitting, data: result, error: submitErr } =
 *             post<Comment>('/comments');
 *         const { mutate: remove, loading: isRemoving, error: removeErr } =
 *             del<void>('/comments/123');
 *
 *         return (
 *             <form onSubmit={() => submit({ text: 'Hello' })}>
 *                 <button disabled={isSubmitting}>
 *                     {isSubmitting ? 'Sending...' : 'Submit'}
 *                 </button>
 *                 {result && <p>Comment created: {result.id}</p>}
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
        ): FetchContextQueryResult<Res, RH> {

            const key = path + (options ? JSON.stringify(options) : '');

            const [loading, setLoading] = useState(true);
            const [data, setData] = useState<Res | null>(null);
            const [response, setResponse] = useState<FetchResponse<Res, any, any, RH> | null>(null);
            const [error, setError] = useState<FetchError | null>(null);
            const [refetchCount, setRefetchCount] = useState(0);
            const abortController = useRef<AbortController | null>(null);

            useEffect(() => {

                abortController.current = new AbortController();

                setLoading(true);

                const promise = attempt(
                    () => engine.get<Res>(path, {
                        ...options,
                        abortController: abortController.current!,
                    })
                );

                promise.then(([res, err]) => {

                    if (abortController.current!.signal.aborted) return;

                    if (err) {

                        setLoading(false);
                        setData(null);
                        setResponse(null);
                        setError(err as FetchError);
                        return;
                    }

                    const fetchRes = res as unknown as FetchResponse<Res, any, any, RH>;

                    setLoading(false);
                    setData(fetchRes.data);
                    setResponse(fetchRes);
                    setError(null);
                });

                return () => abortController.current?.abort();
            }, [key, refetchCount]);

            const cancel = useCallback(() => {
                abortController.current?.abort();
            }, []);

            const refetch = useCallback(() => {
                setRefetchCount(c => c + 1);
            }, []);

            return { data, loading, error, response, refetch, cancel };
        }

        function makeMutation<Res = unknown, RH = FetchEngine.InstanceResponseHeaders>(
            method: 'post' | 'put' | 'delete' | 'patch',
            path: string,
            options?: CallConfig<H, P>
        ): FetchContextMutationResult<Res, RH> {

            const [loading, setLoading] = useState(false);
            const [data, setData] = useState<Res | null>(null);
            const [response, setResponse] = useState<FetchResponse<Res, any, any, RH> | null>(null);
            const [error, setError] = useState<FetchError | null>(null);
            const [called, setCalled] = useState(false);
            const abortController = useRef<AbortController | null>(null);
            const resolveRef = useRef<((value: Res) => void) | null>(null);
            const rejectRef = useRef<((reason: FetchError) => void) | null>(null);

            const mutate = useCallback(<Payload>(payload?: Payload): Promise<Res> => {

                abortController.current = new AbortController();

                setCalled(true);
                setLoading(true);
                setData(null);
                setResponse(null);
                setError(null);

                const engineMethod = engine[method].bind(engine);

                const resultPromise = new Promise<Res>((resolve, reject) => {

                    resolveRef.current = resolve;
                    rejectRef.current = reject;
                });

                const promise = attempt(
                    () => engineMethod<Res>(path, payload, {
                        ...options,
                        abortController: abortController.current!,
                    })
                );

                promise.then(([res, err]) => {

                    if (err) {

                        setLoading(false);
                        setData(null);
                        setResponse(null);
                        setError(err as FetchError);
                        rejectRef.current?.(err as FetchError);
                        return;
                    }

                    const fetchRes = res as unknown as FetchResponse<Res, any, any, RH>;

                    setLoading(false);
                    setData(fetchRes.data);
                    setResponse(fetchRes);
                    setError(null);
                    resolveRef.current?.(fetchRes.data);
                });

                return resultPromise;
            }, [path]);

            const cancel = useCallback(() => {
                abortController.current?.abort();
            }, []);

            const reset = useCallback(() => {
                setData(null);
                setResponse(null);
                setError(null);
                setLoading(false);
                setCalled(false);
            }, []);

            return { data, loading, error, response, mutate, reset, cancel, called };
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
