import type { FetchEngine } from '../engine/index.ts';
import type { HttpMethods } from '../types.ts';


export interface FetchError<T = {}, H = FetchEngine.Headers> extends Error {
    data: T | null;
    status: number;
    method: HttpMethods;
    path: string;

    /**
     * Whether the request was aborted (any cause: manual, timeout, or server).
     */
    aborted?: boolean | undefined;

    /**
     * Whether the request was aborted due to a timeout (attemptTimeout or totalTimeout).
     * When true, `aborted` will also be true.
     * When false but `aborted` is true, the abort was manual or server-initiated.
     */
    timedOut?: boolean | undefined;

    requestId?: string | undefined;
    attempt?: number | undefined;
    step?: 'fetch' | 'parse' | 'response' | undefined;
    url?: string | undefined;
    headers?: H | undefined;
}

export class FetchError<T = {}> extends Error {

    /**
     * Returns true if the request was intentionally cancelled by the client
     * (not due to a timeout). This indicates a user/app initiated abort.
     *
     * Use this to distinguish between "user navigated away" vs "request failed".
     *
     * @returns true if manually aborted, false otherwise
     *
     * @example
     * ```typescript
     * const [res, err] = await attempt(() => api.get('/data'));
     * if (err?.isCancelled()) {
     *     // User cancelled - don't show error, don't log
     *     return;
     * }
     * ```
     */
    isCancelled(): boolean {

        if (this.status !== 499) return false;

        return this.aborted === true && this.timedOut !== true;
    }

    /**
     * Returns true if the request timed out (either attemptTimeout or totalTimeout).
     *
     * Use this to show "request timed out" messages or decide whether to retry.
     *
     * @returns true if a timeout fired, false otherwise
     *
     * @example
     * ```typescript
     * const [res, err] = await attempt(() => api.get('/data'));
     * if (err?.isTimeout()) {
     *     toast.warn('Request timed out. Retrying...');
     * }
     * ```
     */
    isTimeout(): boolean {

        if (this.status !== 499) return false;

        return this.timedOut === true;
    }

    /**
     * Returns true if the connection was lost (server dropped, network failed, etc.).
     * This indicates the failure was NOT initiated by the client.
     *
     * Use this to show "connection lost" messages or trigger offline mode.
     *
     * @returns true if connection was lost, false otherwise
     *
     * @example
     * ```typescript
     * const [res, err] = await attempt(() => api.get('/data'));
     * if (err?.isConnectionLost()) {
     *     toast.error('Connection lost. Check your internet.');
     * }
     * ```
     */
    isConnectionLost(): boolean {

        if (this.status !== 499) return false;

        return this.step === 'fetch' && this.aborted === false;
    }
}

export const isFetchError = (error: unknown): error is FetchError<any, any> => {

    return error instanceof FetchError;
};
