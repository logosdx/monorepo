import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { attempt } from '@logosdx/utils';
import type { FetchEngine, FetchError } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type { QueryResult, QueryOptions } from './types.ts';

/**
 * Apollo-style query hook — auto-fetches on mount, re-fetches when reactive
 * config changes. Returns `{ data, loading, error, refetch, cancel }`.
 *
 * `data` is the parsed response body (not the full FetchResponse).
 *
 *     const { data, loading, error } = useQuery<User[]>(api, '/users', {
 *         reactive: { params: { page: 1 } },
 *     });
 *
 * @param engine - FetchEngine instance
 * @param path - Request path (appended to engine's baseUrl)
 * @param options - Query options (defaults, reactive, skip, pollInterval, invalidateOn)
 * @param observer - Optional ObserverEngine for invalidateOn support
 */
export function useQuery<
    T = unknown,
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    S = FetchEngine.InstanceState,
    RH = FetchEngine.InstanceResponseHeaders,
    E extends Record<string, any> = any,
>(
    engine: FetchEngine<H, P, S, RH>,
    path: string,
    options?: QueryOptions<H, P, E>,
    observer?: ObserverEngine<E>,
): QueryResult<T> {

    const defaults = options?.defaults;
    const reactive = options?.reactive;
    const skip = options?.skip ?? false;
    const pollInterval = options?.pollInterval;
    const invalidateOn = options?.invalidateOn;

    const reactiveKey = reactive ? JSON.stringify(reactive) : '';
    const key = path + reactiveKey;

    const [loading, setLoading] = useState(!skip);
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<FetchError | null>(null);
    const [refetchCount, setRefetchCount] = useState(0);

    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => () => { mountedRef.current = false; }, []);

    useEffect(() => {

        if (skip) {

            setLoading(false);
            return;
        }

        abortRef.current?.abort();
        abortRef.current = new AbortController();

        const controller = abortRef.current;

        setLoading(true);

        const config = {
            ...defaults,
            ...reactive,
            abortController: controller,
        };

        const promise = attempt(
            () => engine.get<T>(path, config as any)
        );

        promise.then(([res, err]) => {

            if (controller.signal.aborted || !mountedRef.current) return;

            if (err) {

                setLoading(false);
                setData(null);
                setError(err as FetchError);
                return;
            }

            setLoading(false);
            setData(res!.data);
            setError(null);
        });

        return () => controller.abort();

    }, [key, skip, refetchCount]);

    // Polling
    useEffect(() => {

        if (!pollInterval || skip) return;

        const interval = setInterval(
            () => setRefetchCount(c => c + 1),
            pollInterval,
        );

        return () => clearInterval(interval);

    }, [pollInterval, skip]);

    // Observer invalidation
    useEffect(() => {

        if (!observer || !invalidateOn?.length) return;

        const cleanups = invalidateOn.map(event =>
            observer.on(event as any, () => setRefetchCount(c => c + 1))
        );

        return () => cleanups.forEach(fn => fn());

    }, [observer, JSON.stringify(invalidateOn)]);

    const refetch = useCallback(
        () => setRefetchCount(c => c + 1),
        [],
    );

    const cancel = useCallback(() => {

        abortRef.current?.abort();
    }, []);

    return { data, loading, error, refetch, cancel };
}
