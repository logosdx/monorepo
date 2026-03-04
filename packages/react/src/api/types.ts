import type { CallConfig, FetchError } from '@logosdx/fetch';

// === Return shapes ===

export type QueryResult<T> = {
    data: T | null;
    loading: boolean;
    error: FetchError | null;
    refetch: () => void;
    cancel: () => void;
};

export type MutationResult<T> = {
    data: T | null;
    loading: boolean;
    error: FetchError | null;
    mutate: <Payload = unknown>(payload?: Payload, overrides?: Record<string, unknown>) => Promise<T>;
    reset: () => void;
    cancel: () => void;
    called: boolean;
};

// === Option types ===

export type EmitEntry<E> = {
    event: keyof E;
    payload?: (data: any) => any;
};

export type EmitConfig<E> =
    | keyof E
    | EmitEntry<E>
    | (keyof E | EmitEntry<E>)[];

export type QueryOptions<H, P, E = Record<string, any>> = {
    defaults?: CallConfig<H, P>;
    reactive?: CallConfig<H, P>;
    skip?: boolean;
    pollInterval?: number;
    invalidateOn?: (keyof E)[];
};

export type MutationOptions<H, P, E = Record<string, any>> = {
    defaults?: CallConfig<H, P>;
    emitOnSuccess?: EmitConfig<E>;
};

export type AsyncOptions<E = Record<string, any>> = {
    skip?: boolean;
    pollInterval?: number;
    invalidateOn?: (keyof E)[];
};
