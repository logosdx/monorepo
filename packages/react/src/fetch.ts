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
import type { ProviderProps, FetchContextQueryResult, FetchContextMutationResult, FetchFailure } from './types.ts';

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
 * Returns `{ data, loading, failure, refetch, cancel }`.
 * `data` is the unwrapped `T`. `failure` is one signal for "did it fail":
 * `kind: 'transport'` means no response exists (abort, timeout, connection
 * lost) — `failure.error` is a `FetchError` with `.isCancelled()`,
 * `.isTimeout()`, etc. `kind: 'http'` means the server answered outside 2xx
 * — `failure.response` is the resolved response (status, headers, data).
 *
 *     function UserList() {
 *
 *         const { get } = useApiFetch();
 *
 *         const { data, loading, failure, refetch } = get<User[]>('/users');
 *
 *         if (loading) return <Spinner />;
 *
 *         if (failure?.kind === 'transport') return <Error message={failure.error.message} />;
 *         if (failure?.kind === 'http') return <Error status={failure.response.status} />;
 *
 *         return <ul>{data?.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
 *     }
 *
 * **Mutations — fire on demand, track loading/result/failure:**
 *
 * Returns `{ data, loading, failure, mutate, reset, cancel, called }`.
 * Starts idle (`loading: false`, `called: false`) until `mutate()` is called.
 * `mutate()` never rejects — it resolves `Promise<T>` on success, or
 * `undefined` on any failure (transport or HTTP); read `failure` for why.
 *
 *     function CreateComment() {
 *
 *         const { post, del } = useApiFetch();
 *
 *         const { mutate: submit, loading: isSubmitting, data: result, failure: submitFailure } =
 *             post<Comment>('/comments');
 *         const { mutate: remove, loading: isRemoving, failure: removeFailure } =
 *             del<void>('/comments/123');
 *
 *         const onSubmit = async () => {
 *
 *             const comment = await submit({ text: 'Hello' });
 *
 *             if (!comment) {
 *                 if (submitFailure?.kind === 'http') console.error(submitFailure.response.status);
 *                 if (submitFailure?.kind === 'transport') console.error(submitFailure.error.message);
 *                 return;
 *             }
 *         };
 *
 *         return (
 *             <form onSubmit={onSubmit}>
 *                 <button disabled={isSubmitting}>
 *                     {isSubmitting ? 'Sending...' : 'Submit'}
 *                 </button>
 *                 {result && <p>Comment created: {result.id}</p>}
 *                 {submitFailure?.kind === 'http' &&
 *                     <p>Failed ({submitFailure.response.status})</p>}
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
            const [failure, setFailure] = useState<FetchFailure<Res, RH> | null>(null);
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
                        setFailure({ kind: 'transport', error: err as FetchError });
                        return;
                    }

                    // `RH` is a per-call override the caller declares (e.g.
                    // `get<Post, { 'x-total': string }>(...)`), independent of
                    // the engine's configured response-header type — runtime
                    // headers can't be checked against that override, so the
                    // caller's declared shape is trusted here.
                    const fetchRes = res as unknown as
                        FetchResponse<Res, unknown, unknown, RH>;

                    if (!fetchRes.ok) {

                        setLoading(false);
                        setData(null);
                        setFailure({ kind: 'http', response: fetchRes });
                        return;
                    }

                    setLoading(false);
                    setData(fetchRes.data);
                    setFailure(null);
                });

                return () => abortController.current?.abort();
            }, [key, refetchCount]);

            const cancel = useCallback(() => {
                abortController.current?.abort();
            }, []);

            const refetch = useCallback(() => {
                setRefetchCount(c => c + 1);
            }, []);

            return { data, loading, failure, refetch, cancel };
        }

        function makeMutation<Res = unknown, RH = FetchEngine.InstanceResponseHeaders>(
            method: 'post' | 'put' | 'delete' | 'patch',
            path: string,
            options?: CallConfig<H, P>
        ): FetchContextMutationResult<Res, RH> {

            const [loading, setLoading] = useState(false);
            const [data, setData] = useState<Res | null>(null);
            const [failure, setFailure] = useState<FetchFailure<Res, RH> | null>(null);
            const [called, setCalled] = useState(false);
            const abortController = useRef<AbortController | null>(null);
            const resolveRef = useRef<((value: Res | undefined) => void) | null>(null);

            const mutate = useCallback(<Payload>(payload?: Payload): Promise<Res | undefined> => {

                abortController.current = new AbortController();

                setCalled(true);
                setLoading(true);
                setData(null);
                setFailure(null);

                const engineMethod = engine[method].bind(engine);

                const resultPromise = new Promise<Res | undefined>((resolve) => {

                    resolveRef.current = resolve;
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
                        setFailure({ kind: 'transport', error: err as FetchError });
                        resolveRef.current?.(undefined);
                        return;
                    }

                    // See `get()` above: `RH` is a per-call override the
                    // caller declares, trusted since runtime headers can't
                    // be checked against it.
                    const fetchRes = res as unknown as
                        FetchResponse<Res, unknown, unknown, RH>;

                    if (!fetchRes.ok) {

                        setLoading(false);
                        setData(null);
                        setFailure({ kind: 'http', response: fetchRes });
                        resolveRef.current?.(undefined);
                        return;
                    }

                    setLoading(false);
                    setData(fetchRes.data);
                    setFailure(null);
                    resolveRef.current?.(fetchRes.data);
                });

                return resultPromise;
            }, [path]);

            const cancel = useCallback(() => {
                abortController.current?.abort();
            }, []);

            const reset = useCallback(() => {
                setData(null);
                setFailure(null);
                setLoading(false);
                setCalled(false);
            }, []);

            return { data, loading, failure, mutate, reset, cancel, called };
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
