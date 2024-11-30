import {
    assert,
    definePublicProps,
    assertOptional,
    isObject,
    isFunction,
    forInIsEqual
} from '@logos-ui/utils';
import type { FetchFactory } from './factory.ts';
import { HttpMethods } from './types.ts';

export interface FetchError<T = {}> extends Error {
    data: T | null;
    status: number;
    method: HttpMethods;
    path: string;
    aborted?: boolean;
}

export class FetchError<T = {}> extends Error {}


export class  FetchEvent<
    InstanceHeaders = FetchFactory.InstanceHeaders,
    Params = FetchFactory.Params,
    State = {},
> extends Event {
    state!: State
    url?: string
    method?: HttpMethods
    headers?: InstanceHeaders
    params?: Params
    options?: FetchFactory.RequestOpts
    data?: unknown
    payload?: unknown
    response?: Response
    error?: FetchError

    constructor(
        event: FetchEventName,
        opts: {
            state: State,
            url?: string,
            method?: HttpMethods,
            headers?: FetchFactory.Headers,
            params?: FetchFactory.Params,
            error?: FetchError,
            response?: Response,
            data?: unknown,
            payload?: unknown,
        },
        initDict?: EventInit
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
};

export type FetchEventName = keyof typeof FetchEventNames;

export const fetchTypes = [
    'arrayBuffer',
    'blob',
    'formData',
    'json',
    'text',
] satisfies FetchFactory.Type[];


export const validateOptions = <H, P, S>(
    opts: FetchFactory.Options<H, P, S>
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
        () => forInIsEqual(methodHeaders!, (val) => isObject(val)),
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
        () => forInIsEqual(methodParams!, (val) => isObject(val)),
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
        () => forInIsEqual(modifyMethodOptions!, (val) => isFunction(val)),
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