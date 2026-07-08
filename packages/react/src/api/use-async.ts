import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import type { DependencyList } from 'react';
import type { ObserverEngine } from '@logosdx/observer';
import type { AsyncResult, AsyncFailure, AsyncOptions, ResponseLike } from './types.ts';

/**
 * Checks whether a value looks like a FetchResponse (has `.ok`, `.data`,
 * `.status`, `.request`). Used to auto-unwrap FetchResponse from FetchEngine
 * methods and to detect a resolved-but-failed (`ok: false`) exchange.
 * Checked structurally, without importing `@logosdx/fetch` — `useAsync`
 * wraps arbitrary async functions, and `@logosdx/fetch` is an optional
 * peer dependency this generic hook shouldn't require.
 */
function isResponseLike(value: unknown): value is ResponseLike {

    return (
        typeof value === 'object'
        && value !== null
        && 'data' in value
        && 'status' in value
        && 'request' in value
        && 'ok' in value
    );
}

/**
 * Generic async hook — wraps any async function with loading/failure/data
 * state. Auto-executes on mount and when deps change.
 *
 * If the function returns a FetchResponse (from FetchEngine methods), the
 * `.data` property is automatically unwrapped, and an `ok: false` response
 * sets `failure: { kind: 'http', response }` instead of being treated as
 * success. `useAsync` wraps an arbitrary function, so it can't promise a
 * `FetchError` the way `useQuery` does — a rejection sets
 * `failure: { kind: 'rejected', error }` with the thrown value as-is.
 *
 *     const { data, loading, failure } = useAsync(
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
    fn: () => Promise<unknown>,
    deps: DependencyList,
    options?: AsyncOptions<E>,
    observer?: ObserverEngine<E>,
): AsyncResult<T> {

    const skip = options?.skip ?? false;
    const pollInterval = options?.pollInterval;
    const invalidateOn = options?.invalidateOn;

    const [loading, setLoading] = useState(!skip);
    const [data, setData] = useState<T | null>(null);
    const [failure, setFailure] = useState<AsyncFailure | null>(null);
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

                if (isResponseLike(result) && !result.ok) {

                    setLoading(false);
                    setData(null);
                    setFailure({ kind: 'http', response: result });
                    return;
                }

                const unwrapped = isResponseLike(result) ? result.data : result;

                setLoading(false);
                // `fn` is caller-typed as returning `T` (or a FetchResponse
                // wrapping `T`) — nothing at this generic boundary can prove
                // the unwrapped value's runtime shape matches `T`.
                setData(unwrapped as T);
                setFailure(null);
            },
            (error: unknown) => {

                if (cancelled || !mountedRef.current) return;

                setLoading(false);
                setData(null);
                setFailure({ kind: 'rejected', error });
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

    return { data, loading, failure, refetch, cancel };
}
