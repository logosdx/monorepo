import type { FetchEngine } from '@logosdx/fetch';
import type { ObserverEngine } from '@logosdx/observer';
import type { MutationResult, MutationOptions } from './types.ts';
import { useMutation } from './use-mutation.ts';

/**
 * Factory that creates a reusable mutation hook pre-bound to an engine, method, and path.
 *
 *     const useCreateUser = createMutation<User>(api, 'post', '/users', {
 *         emitOnSuccess: 'users.created',
 *     }, observer);
 *
 *     // In any component:
 *     const { mutate, loading } = useCreateUser();
 *
 * @param engine - FetchEngine instance
 * @param method - HTTP method (post, put, delete, patch)
 * @param path - Request path
 * @param defaults - Default mutation options
 * @param observer - Optional ObserverEngine for emitOnSuccess
 */
export function createMutation<
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
    defaults?: MutationOptions<H, P, E>,
    observer?: ObserverEngine<E>,
): (overrides?: Partial<MutationOptions<H, P, E>>) => MutationResult<T> {

    return (overrides?: Partial<MutationOptions<H, P, E>>) => {

        const merged = {
            ...defaults,
            ...overrides,
            defaults: { ...defaults?.defaults, ...overrides?.defaults },
            emitOnSuccess: overrides?.emitOnSuccess ?? defaults?.emitOnSuccess,
        } as MutationOptions<H, P, E>;

        return useMutation<T, H, P, S, RH, E>(engine, method, path, merged, observer);
    };
}
