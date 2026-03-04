import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { attempt } from '@logosdx/utils';
import type { FetchEngine, FetchError } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type { MutationResult, MutationOptions, EmitConfig, EmitEntry } from './types.ts';

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
 * Returns `{ data, loading, error, mutate, reset, cancel, called }`.
 *
 * `mutate()` returns a Promise that resolves with the parsed response body.
 *
 *     const { mutate, loading, error } = useMutation<User>(api, 'post', '/users', {
 *         emitOnSuccess: 'users.created',
 *     }, observer);
 *
 *     const user = await mutate({ name: 'Alice' });
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
    E extends Record<string, any> = Record<string, any>,
>(
    engine: FetchEngine<H, P, any, any>,
    method: 'post' | 'put' | 'delete' | 'patch',
    path: string,
    options?: MutationOptions<H, P, E>,
    observer?: ObserverEngine<E>,
): MutationResult<T> {

    const defaults = options?.defaults;
    const emitOnSuccess = options?.emitOnSuccess;

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<FetchError | null>(null);
    const [called, setCalled] = useState(false);

    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => () => { mountedRef.current = false; }, []);

    const mutate = useCallback(<Payload = unknown>(
        payload?: Payload,
        overrides?: Record<string, unknown>,
    ): Promise<T> => {

        abortRef.current?.abort();
        abortRef.current = new AbortController();

        const controller = abortRef.current;

        setLoading(true);
        setData(null);
        setError(null);

        const config = {
            ...defaults,
            ...overrides,
            abortController: controller,
        };

        const engineMethod = engine[method].bind(engine);

        return attempt(
            () => engineMethod<T>(path, payload, config as any)
        ).then(([res, err]) => {

            if (!mountedRef.current) return undefined as any;

            if (err) {

                setLoading(false);
                setData(null);
                setError(err as FetchError);
                setCalled(true);
                return undefined as any;
            }

            const responseData = res!.data;

            setLoading(false);
            setData(responseData);
            setError(null);
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
        setError(null);
        setCalled(false);
    }, []);

    const cancel = useCallback(() => {

        abortRef.current?.abort();
    }, []);

    return { data, loading, error, mutate, reset, cancel, called };
}
