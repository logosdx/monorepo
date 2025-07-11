import {
    assert,
    definePublicProps,
    assertOptional,
    isObject,
    isFunction,
    allKeysValid
} from '@logosdx/utils';
import type { FetchEngine } from './engine.ts';
import { type HttpMethods, type RetryConfig } from './types.ts';

export interface FetchError<T = {}, H = FetchEngine.Headers> extends Error {
    data: T | null;
    status: number;
    method: HttpMethods;
    path: string;
    aborted?: boolean | undefined;
    attempt?: number | undefined;
    step?: 'fetch' | 'parse' | 'response' | undefined;
    url?: string | undefined;
    headers?: H | undefined;
}

export class FetchError<T = {}> extends Error {}

export const isFetchError = (error: unknown): error is FetchError<any, any> => {
    return error instanceof FetchError;
}


export class  FetchEvent<
    InstanceHeaders = FetchEngine.InstanceHeaders,
    Params = FetchEngine.Params,
    State = {},
> extends Event {
    state!: State
    url?: string | undefined
    method?: HttpMethods | undefined
    headers?: InstanceHeaders | undefined
    params?: Params | undefined
    options?: FetchEngine.RequestOpts | undefined
    data?: unknown | undefined
    payload?: unknown | undefined
    response?: Response | undefined
    error?: FetchError<any, InstanceHeaders> | undefined
    attempt?: number | undefined
    nextAttempt?: number | undefined
    delay?: number | undefined
    step?: 'fetch' | 'parse' | 'response' | undefined
    status?: number | undefined
    path?: string | undefined
    aborted?: boolean | undefined

    constructor(
        event: FetchEventName,
        opts: {
            state: State,
            url?: string | undefined,
            method?: HttpMethods | undefined,
            headers?: InstanceHeaders | undefined,
            params?: Params | undefined,
            error?: FetchError<any, InstanceHeaders> | undefined,
            response?: Response | undefined,
            data?: unknown | undefined,
            payload?: unknown | undefined,
            attempt?: number | undefined,
            nextAttempt?: number | undefined,
            delay?: number | undefined,
            step?: 'fetch' | 'parse' | 'response' | undefined,
            status?: number | undefined,
            path?: string | undefined,
            aborted?: boolean | undefined,
        },
        initDict?: EventInit | undefined
    ) {

        super(event, initDict);

        definePublicProps(this, opts);
    }
}

export enum FetchEventNames {

    'fetch-before' = 'fetch-before',
    'fetch-after' = 'fetch-after',
    'fetch-abort' = 'fetch-abort',
    'fetch-error' = 'fetch-error',
    'fetch-response' = 'fetch-response',
    'fetch-header-add' = 'fetch-header-add',
    'fetch-header-remove' = 'fetch-header-remove',
    'fetch-param-add' = 'fetch-param-add',
    'fetch-param-remove' = 'fetch-param-remove',
    'fetch-state-set' = 'fetch-state-set',
    'fetch-state-reset' = 'fetch-state-reset',
    'fetch-url-change' = 'fetch-url-change',
    'fetch-retry' = 'fetch-retry',
};

export type FetchEventName = keyof typeof FetchEventNames;

export const fetchTypes = [
    'arrayBuffer',
    'blob',
    'formData',
    'json',
    'text',
] satisfies FetchEngine.Type[];


export const validateOptions = <H, P, S>(
    opts: FetchEngine.Options<H, P, S>
) => {

    const {
        baseUrl,
        defaultType,
        headers,
        methodHeaders,
        params,
        methodParams,
        modifyOptions,
        modifyMethodOptions,
        timeout,
        validate,
        determineType,
        formatHeaders,
    } = opts;

    assert(baseUrl, 'baseUrl is required');

    assertOptional(
        defaultType,
        fetchTypes.includes(defaultType!),
        'invalid type'
    );

    assertOptional(
        timeout,
        Number.isInteger(timeout!) && timeout! > -1,
        'timeout must be positive number'
    );

    assertOptional(
        headers,
        isObject(headers),
        'headers must be an object'
    );

    assertOptional(
        methodHeaders,
        isObject(methodHeaders),
        'methodHeaders must be an object'
    );

    assertOptional(
        methodHeaders,
        () => allKeysValid(methodHeaders!, isObject),
        'methodHeaders items must be objects'
    );

    assertOptional(
        params,
        isObject(params),
        'params must be an object'
    );

    assertOptional(
        methodParams,
        isObject(methodParams),
        'methodParams must be an object'
    );

    assertOptional(
        methodParams,
        () => allKeysValid(methodParams!, isObject),
        'methodParams items must be objects'
    );

    assertOptional(
        modifyOptions,
        isFunction(modifyOptions),
        'modifyOptions must be a function'
    );

    assertOptional(
        modifyMethodOptions,
        isObject(modifyMethodOptions),
        'modifyMethodOptions must be an object'
    );

    assertOptional(
        modifyMethodOptions,
        () => allKeysValid(modifyMethodOptions!, isFunction),
        'modifyMethodOptions items must be functions'
    );

    assertOptional(
        validate,
        isObject(validate),
        'validate must be an object'
    );

    if (validate) {

        const { headers, state, perRequest } = validate;

        assertOptional(
            headers,
            isFunction(headers),
            'validate.headers must be a function'
        );

        assertOptional(
            state,
            isFunction(state),
            'validate.state must be a function'
        );

        assertOptional(
            perRequest,
            isObject(perRequest),
            'validate.perRequest must be an object'
        );

        if (perRequest) {

            const { headers } = perRequest;

            assertOptional(
                headers,
                typeof headers === 'boolean',
                'validate.perRequest.headers must be a boolean'
            );
        }
    }

    assertOptional(
        determineType,
        typeof determineType === 'function',
        'determineType must be a function'
    );

    const formatHeadersMsg = 'formatHeaders must be false, lowercase, uppercase, or a function';

    switch (typeof formatHeaders) {

        case 'undefined':
            break;

        case 'boolean':
            assert( formatHeaders === false, formatHeadersMsg);
            break;

        case 'function':
            break;

        case 'string':
            assert(
                formatHeaders === 'lowercase' ||
                formatHeaders === 'uppercase',
                formatHeadersMsg
            );
            break;

        default:
            assert(
                false,
                formatHeadersMsg
            );
    }
}


// Add default retry configuration
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    useExponentialBackoff: true,
    retryableStatusCodes: [408, 429, 499, 500, 502, 503, 504],
    shouldRetry(error) {

        if (error.aborted) return false; // Aborted requests should not be retried
        if (!error.status) return false; // No status means it failed in a way that was not handled by the engine
        if (error.status === 499) return true; // We set 499 for requests that were reset, dropped, etc.

        // Retry on configured status codes
        return this.retryableStatusCodes?.includes(error.status) ?? false;
    }
};