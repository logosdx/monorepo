import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { attempt } from '@logosdx/utils';
import type { FetchEngine, FetchError } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type { MutationResult, MutationOptions, EmitConfig, EmitEntry, FetchFailure } from './types.ts';

function emitEvents<E extends Record<string, any>>(
    observer: ObserverEngine<E>,
    config: EmitConfig<E>,
    data: unknown,
): void {

    const entries = Array.isArray(config) ? config : [config];

    for (const entry of entries) {

        if (typeof entry === 'string' || typeof entry === 'symbol') {

            observer.emit(entry as any, data as any);
        }
        else {

            const typed = entry as EmitEntry<E>;
            const payload = typed.payload ? typed.payload(data) : data;
            observer.emit(typed.event as any, payload as any);
        }
    }
}

/**
 * Apollo-style mutation hook — idle until `mutate()` is called.
 * Returns `{ data, loading, failure, mutate, reset, cancel, called }`.
 *
 * `mutate()` never rejects — it resolves with the parsed response body on
 * success, or `undefined` on any failure. `failure` narrows on `kind`:
 * `'transport'` (no response exists — abort, timeout, connection lost)
 * carries `error: FetchError`; `'http'` (server answered outside 2xx)
 * carries `response`, the resolved ok-false `FetchResponse`.
 *
 *     const { mutate, loading, failure } = useMutation<User>(api, 'post', '/users', {
 *         emitOnSuccess: 'users.created',
 *     }, observer);
 *
 *     const user = await mutate({ name: 'Alice' });
 *
 *     if (!user) {
 *         if (failure?.kind === 'http') console.error(failure.response.status);
 *         if (failure?.kind === 'transport') console.error(failure.error.message);
 *         return;
 *     }
 *
 * @param engine - FetchEngine instance
 * @param method - HTTP method (post, put, delete, patch)
 * @param path - Request path
 * @param options - Mutation options (defaults, emitOnSuccess)
 * @param observer - Optional ObserverEngine for emitOnSuccess
 */
export function useMutation<
    T = unknown,
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    S = FetchEngine.InstanceState,
    RH = FetchEngine.InstanceResponseHeaders,
    E extends Record<string, any> = any,
>(
    engine: FetchEngine<H, P, S, RH>,
    method: 'post' | 'put' | 'delete' | 'patch',
    path: string,
    options?: MutationOptions<H, P, E>,
    observer?: ObserverEngine<E>,
): MutationResult<T, RH> {

    const defaults = options?.defaults;
    const emitOnSuccess = options?.emitOnSuccess;

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<T | null>(null);
    const [failure, setFailure] = useState<FetchFailure<T, RH> | null>(null);
    const [called, setCalled] = useState(false);

    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => () => { mountedRef.current = false; }, []);

    const mutate = useCallback(<Payload = unknown>(
        payload?: Payload,
        overrides?: Record<string, unknown>,
    ): Promise<T | undefined> => {

        abortRef.current?.abort();
        abortRef.current = new AbortController();

        const controller = abortRef.current;

        setLoading(true);
        setData(null);
        setFailure(null);

        const config = {
            ...defaults,
            ...overrides,
            abortController: controller,
        };

        const engineMethod = engine[method].bind(engine);

        return attempt(
            () => engineMethod<T>(path, payload, config as any)
        ).then(([res, err]) => {

            if (!mountedRef.current) return undefined;

            if (err) {

                setLoading(false);
                setData(null);
                // attempt()'s tuple types the rejection as a generic Error;
                // FetchEngine only ever rejects with FetchError.
                setFailure({ kind: 'transport', error: err as FetchError });
                setCalled(true);
                return undefined;
            }

            if (!res.ok) {

                setLoading(false);
                setData(null);
                setFailure({ kind: 'http', response: res });
                setCalled(true);
                return undefined;
            }

            const responseData = res.data;

            setLoading(false);
            setData(responseData);
            setFailure(null);
            setCalled(true);

            if (observer && emitOnSuccess) {

                emitEvents(observer, emitOnSuccess, responseData);
            }

            return responseData;
        });

    }, [path, method]);

    const reset = useCallback(() => {

        setLoading(false);
        setData(null);
        setFailure(null);
        setCalled(false);
    }, []);

    const cancel = useCallback(() => {

        abortRef.current?.abort();
    }, []);

    return { data, loading, failure, mutate, reset, cancel, called };
}
