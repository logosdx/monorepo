import type { StorageEventPayload } from './types.ts';

export function makeEventPayload<V, K extends keyof V>(
    key: K,
    value?: V[K] | null
): StorageEventPayload<V, K> {

    return { key, value: value ?? null } as StorageEventPayload<V, K>;
}
