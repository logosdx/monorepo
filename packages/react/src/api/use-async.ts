import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import type { DependencyList } from 'react';
import type { ObserverEngine } from '@logosdx/observer';
import type { QueryResult, AsyncOptions } from './types.ts';

/**
 * Checks whether a value looks like a FetchResponse (has `.data` and `.status`
 * and `.request`). Used to auto-unwrap FetchResponse from FetchEngine methods.
 */
function isFetchResponse(value: unknown): value is { data: unknown } {

    return (
        typeof value === 'object'
        && value !== null
        && 'data' in value
        && 'status' in value
        && 'request' in value
    );
}

/**
 * Generic async hook — wraps any async function with loading/error/data state.
 * Auto-executes on mount and when deps change.
 *
 * If the function returns a FetchResponse (from FetchEngine methods),
 * the `.data` property is automatically unwrapped.
 *
 *     const { data, loading, error } = useAsync(
 *         () => myApi.getUsers(page),
 *         [page],
 *     );
 *
 * @param fn - Async function to execute
 * @param deps - React dependency list — re-executes when these change
 * @param options - skip, pollInterval, invalidateOn
 * @param observer - Optional ObserverEngine for invalidateOn support
 */
export function useAsync<
    T = unknown,
    E extends Record<string, any> = Record<string, any>,
>(
    fn: () => Promise<any>,
    deps: DependencyList,
    options?: AsyncOptions<E>,
    observer?: ObserverEngine<E>,
): QueryResult<T> {

    const skip = options?.skip ?? false;
    const pollInterval = options?.pollInterval;
    const invalidateOn = options?.invalidateOn;

    const [loading, setLoading] = useState(!skip);
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<any>(null);
    const [refetchCount, setRefetchCount] = useState(0);

    const mountedRef = useRef(true);

    useEffect(() => () => { mountedRef.current = false; }, []);

    useEffect(() => {

        if (skip) {

            setLoading(false);
            return;
        }

        setLoading(true);

        let cancelled = false;

        fn().then(
            (result) => {

                if (cancelled || !mountedRef.current) return;

                const unwrapped = isFetchResponse(result) ? result.data : result;

                setLoading(false);
                setData(unwrapped as T);
                setError(null);
            },
            (err) => {

                if (cancelled || !mountedRef.current) return;

                setLoading(false);
                setData(null);
                setError(err);
            },
        );

        return () => { cancelled = true; };

    }, [...deps, skip, refetchCount]);

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

    const cancel = useCallback(() => {}, []);

    return { data, loading, error, refetch, cancel };
}
