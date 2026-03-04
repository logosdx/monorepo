import type { DependencyList } from 'react';
import type { FetchEngine } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type {
    QueryResult,
    MutationResult,
    QueryOptions,
    MutationOptions,
    AsyncOptions,
} from './types.ts';

import { useQuery as useQueryBase } from './use-query.ts';
import { useMutation as useMutationBase } from './use-mutation.ts';
import { useAsync as useAsyncBase } from './use-async.ts';
import { createQuery as createQueryBase } from './create-query.ts';
import { createMutation as createMutationBase } from './create-mutation.ts';

/**
 * Creates a set of API hooks pre-bound to a FetchEngine and optional ObserverEngine.
 * Returns `{ useQuery, useMutation, useAsync, createQuery, createMutation }` with
 * the engine and observer already wired in.
 *
 *     const api = new FetchEngine({ baseUrl: '/api' });
 *     const events = new ObserverEngine<AppEvents>();
 *     const { useQuery, useMutation, createQuery } = createApiHooks(api, events);
 *
 *     // In components — no need to pass engine/observer:
 *     const { data } = useQuery<User[]>('/users');
 *     const { mutate } = useMutation<User>('post', '/users');
 *
 * @param engine - FetchEngine instance
 * @param observer - Optional ObserverEngine for invalidation and event emission
 */
export function createApiHooks<
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    S = FetchEngine.InstanceState,
    RH = FetchEngine.InstanceResponseHeaders,
    E extends Record<string, any> = Record<string, any>,
>(
    engine: FetchEngine<H, P, S, RH>,
    observer?: ObserverEngine<E>,
) {

    function useQuery<T = unknown>(
        path: string,
        options?: QueryOptions<H, P, E>,
    ): QueryResult<T> {

        return useQueryBase<T, H, P, E>(engine, path, options, observer);
    }

    function useMutation<T = unknown>(
        method: 'post' | 'put' | 'delete' | 'patch',
        path: string,
        options?: MutationOptions<H, P, E>,
    ): MutationResult<T> {

        return useMutationBase<T, H, P, E>(engine, method, path, options, observer);
    }

    function useAsync<T = unknown>(
        fn: () => Promise<any>,
        deps: DependencyList,
        options?: AsyncOptions<E>,
    ): QueryResult<T> {

        return useAsyncBase<T, E>(fn, deps, options, observer);
    }

    function createQuery<T = unknown>(
        path: string,
        defaults?: QueryOptions<H, P, E>,
    ) {

        return createQueryBase<T, H, P, E>(engine, path, defaults, observer);
    }

    function createMutation<T = unknown>(
        method: 'post' | 'put' | 'delete' | 'patch',
        path: string,
        defaults?: MutationOptions<H, P, E>,
    ) {

        return createMutationBase<T, H, P, E>(engine, method, path, defaults, observer);
    }

    return { useQuery, useMutation, useAsync, createQuery, createMutation };
}
