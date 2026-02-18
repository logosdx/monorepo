import {
    assert,
    assertOptional,
    isObject,
    isFunction,
    allKeysValid,
} from '@logosdx/utils';
import type { FetchEngine } from '../engine/index.ts';
import type { RetryConfig } from '../types.ts';


export const fetchTypes = [
    'arrayBuffer',
    'blob',
    'formData',
    'json',
    'text',
] satisfies FetchEngine.Type[];


export const validateOptions = <H, P, S>(
    opts: FetchEngine.Config<H, P, S>
) => {

    const {
        baseUrl,
        defaultType,
        headers,
        methodHeaders,
        params,
        methodParams,
        totalTimeout,
        attemptTimeout,
        validate,
        determineType,
        retry,
    } = opts as FetchEngine.Config<H, P, S> & {
        totalTimeout?: number;
        attemptTimeout?: number;
    };

    assert(baseUrl, 'baseUrl is required');

    // Validate URL format
    try {

        new URL(baseUrl);
    }
    catch {

        throw new Error('Invalid URL');
    }

    assertOptional(
        defaultType,
        fetchTypes.includes(defaultType!),
        'invalid type'
    );

    assertOptional(
        totalTimeout,
        Number.isInteger(totalTimeout!) && totalTimeout! > -1,
        'totalTimeout must be non-negative integer'
    );

    assertOptional(
        attemptTimeout,
        Number.isInteger(attemptTimeout!) && attemptTimeout! > -1,
        'attemptTimeout must be non-negative integer'
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


    if (retry) {

        const optionalNumbers = [
            'maxAttempts',
            'baseDelay',
            'maxDelay',
        ] as const;

        for (const key of optionalNumbers) {

            const value = (retry as RetryConfig)[key];

            if (typeof value !== 'number') continue;

            assertOptional(
                value,
                Number.isInteger(value) && value > 0,
                `retry.${key} must be a positive number, got ${value}`
            );
        }

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

        // Note: Parent controller abort (totalTimeout) is checked in the retry loop,
        // not here. This allows attemptTimeout aborts to still be retried.

        if (!error.status) return false; // No status means it failed in a way that was not handled by the engine
        if (error.status === 499) return true; // We set 499 for requests that were reset, dropped, etc.

        // Retry on configured status codes
        return this.retryableStatusCodes?.includes(error.status) ?? false;
    }
};
