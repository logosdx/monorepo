import type { FetchEngine } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type { QueryResult, QueryOptions } from './types.ts';
import { useQuery } from './use-query.ts';

/**
 * Factory that creates a reusable query hook pre-bound to an engine and path.
 *
 *     const useUsers = createQuery<User[]>(api, '/users', {
 *         invalidateOn: ['users.created'],
 *     }, observer);
 *
 *     // In any component:
 *     const { data, loading } = useUsers({ reactive: { params: { page: 1 } } });
 *
 * @param engine - FetchEngine instance
 * @param path - Request path
 * @param defaults - Default query options (merged with call-time overrides)
 * @param observer - Optional ObserverEngine for invalidateOn
 */
export function createQuery<
    T = unknown,
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    E extends Record<string, any> = Record<string, any>,
>(
    engine: FetchEngine<H, P, any, any>,
    path: string,
    defaults?: QueryOptions<H, P, E>,
    observer?: ObserverEngine<E>,
): (overrides?: Partial<QueryOptions<H, P, E>>) => QueryResult<T> {

    return (overrides?: Partial<QueryOptions<H, P, E>>) => {

        const merged: QueryOptions<H, P, E> = {
            ...defaults,
            ...overrides,
            defaults: { ...defaults?.defaults, ...overrides?.defaults } as any,
            reactive: { ...defaults?.reactive, ...overrides?.reactive } as any,
            invalidateOn: overrides?.invalidateOn ?? defaults?.invalidateOn,
        };

        return useQuery<T, H, P, E>(engine, path, merged, observer);
    };
}
