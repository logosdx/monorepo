import type { CallConfig } from '@logosdx/fetch';
import type { FetchFailure } from '../types.ts';

// `FetchFailure` is canonically defined in `../types.ts` (it also backs
// `FetchContextQueryResult`/`FetchContextMutationResult`); re-exported here
// so `@logosdx/react/api` consumers can import it from this subpath too.
export type { FetchFailure };

// === Return shapes ===

export type QueryResult<T, RH = Record<string, string>> = {
    data: T | null;
    loading: boolean;
    failure: FetchFailure<T, RH> | null;
    refetch: () => void;
    cancel: () => void;
};

export type MutationResult<T, RH = Record<string, string>> = {
    data: T | null;
    loading: boolean;
    failure: FetchFailure<T, RH> | null;
    // Never rejects — a non-2xx or transport failure resolves `undefined`;
    // callers read `failure` for why, or just check the returned value.
    mutate: <Payload = unknown>(payload?: Payload, overrides?: Record<string, unknown>) => Promise<T | undefined>;
    reset: () => void;
    cancel: () => void;
    called: boolean;
};

/**
 * Structural shape of a FetchEngine response — checked without importing
 * `@logosdx/fetch`, an optional peer dependency `useAsync` shouldn't
 * require since it wraps arbitrary async functions, not just FetchEngine
 * calls.
 */
export type ResponseLike = {
    ok: boolean;
    status: number;
    data: unknown;
    /** Discriminator distinguishing response-like objects from arbitrary `{ ok, status, data }` domain shapes. */
    request: unknown;
};

/**
 * `useAsync` wraps an arbitrary async function, not just FetchEngine calls,
 * so unlike `FetchFailure` it cannot promise a `FetchError` on rejection —
 * all it truly knows is that *something* was thrown. `kind: 'http'` still
 * narrows precisely when the resolved value structurally looks like a
 * non-2xx response.
 *
 * `kind: 'rejected'` (not `'transport'`) is deliberate: `FetchFailure`'s
 * `'transport'` means "no response exists, and it came from a FetchEngine
 * call" — a promise from an arbitrary async function that isn't hitting an
 * HTTP endpoint has no "transport" at all, so labeling its rejection
 * `'transport'` would lie about what actually happened. `'rejected'` names
 * only what's true for any wrapped function: the promise rejected.
 */
export type AsyncFailure =
    | { kind: 'rejected'; error: unknown }
    | { kind: 'http'; response: ResponseLike };

export type AsyncResult<T> = {
    data: T | null;
    loading: boolean;
    failure: AsyncFailure | null;
    refetch: () => void;
    cancel: () => void;
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
