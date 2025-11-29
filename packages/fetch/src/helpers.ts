import {
    assert,
    assertOptional,
    isObject,
    isFunction,
    allKeysValid,
    serializer
} from '@logosdx/utils';
import type { FetchEngine } from './engine.ts';
import {
    type HttpMethods,
    type RetryConfig,
    type MatchTypes,
    type RequestKeyOptions,
    type _InternalHttpMethods
} from './types.ts';

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
        retry,
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

        if (error.aborted) return false; // Aborted requests should not be retried
        if (!error.status) return false; // No status means it failed in a way that was not handled by the engine
        if (error.status === 499) return true; // We set 499 for requests that were reset, dropped, etc.

        // Retry on configured status codes
        return this.retryableStatusCodes?.includes(error.status) ?? false;
    }
};

/**
 * Default HTTP methods that are subject to inflight deduplication.
 * Only GET requests are deduplicated by default since they are idempotent.
 */
export const DEFAULT_INFLIGHT_METHODS: Set<_InternalHttpMethods> = new Set(['GET']);

/**
 * Checks if a path matches a rule's match type.
 *
 * Rules should specify exactly one match type. If multiple are specified,
 * they are checked in order: is → startsWith → endsWith → includes → match.
 *
 * @param rule - The rule containing match type(s)
 * @param path - The request path to match against
 * @returns false if the path matches the rule's criteria
 *
 * @example
 * ```typescript
 * matchPath({ is: '/users' }, '/users');           // true
 * matchPath({ startsWith: '/api' }, '/api/users'); // true
 * matchPath({ endsWith: '.json' }, '/data.json');  // true
 * matchPath({ includes: 'admin' }, '/admin/dash'); // true
 * matchPath({ match: /^\/v\d+/ }, '/v2/users');    // true
 * ```
 */
export const matchPath = (rule: MatchTypes, path: string): boolean => {

    // 'is' is an exact match that can't be combined with others
    if (rule.is !== undefined) {

        return path === rule.is;
    }

    // For other match types, all specified types must match (AND logic)
    // If no types are specified, return false

    let hasMatch = true;
    let hasMatchType = false;

    if (rule.startsWith !== undefined) {

        hasMatchType = true;
        hasMatch = hasMatch && path.startsWith(rule.startsWith);
    }

    if (rule.endsWith !== undefined) {

        hasMatchType = true;
        hasMatch = hasMatch && path.endsWith(rule.endsWith);
    }

    if (rule.includes !== undefined) {

        hasMatchType = true;
        hasMatch = hasMatch && path.includes(rule.includes);
    }

    if (rule.match !== undefined) {

        hasMatchType = true;
        hasMatch = hasMatch && rule.match.test(path);
    }

    // Must have at least one match type and all specified types must match
    return hasMatchType && hasMatch;
};

const toSet = <T>(arr?: T[] | Set<T>): Set<T> | undefined => {

    if (!arr) return;

    return arr instanceof Set ? arr : new Set(arr);
};

/**
 * Checks if a method matches the rule's method constraints.
 *
 * @param method - The HTTP method to check
 * @param ruleMethods - Methods specified in the rule (undefined means inherit from defaults)
 * @param defaultMethods - Default methods when rule doesn't specify any
 * @returns true if the method is allowed by the rule
 */
export const matchMethod = (
    method: string,
    ruleMethods: _InternalHttpMethods[] | undefined,
    defaultMethods: _InternalHttpMethods[] | undefined,
): boolean => {

    const methods = toSet(ruleMethods) ?? toSet(defaultMethods) ?? DEFAULT_INFLIGHT_METHODS;
    const normalizedMethod = method.toUpperCase() as _InternalHttpMethods;

    return methods.has(normalizedMethod);
};


/**
 * Validates an array of match rules.
 *
 * Each rule must be an object specifying at least one match type:
 * is, startsWith, endsWith, includes, or match.
 *
 * Rules can specify multiple match types, which are combined with a logical AND.
 * Except for 'is', which cannot be combined with other types, because it logically
 * contradicts anything except an exact match.
 *
 * @param rules - Array of match rules to validate
 * @throws {AssertionError} If any rule is invalid
 *
 * @example
 * ```typescript
 * const rules = [
 *     { is: '/users' },
 *     { startsWith: '/api' },
 *     { endsWith: '.json' },
 *     { includes: 'admin' },
 *     { match: /^\/v\d+/ },
 *     { startsWith: '/public', endsWith: '.html' },
 *     { includes: 'user', match: /\/dash/ }
 * ];
 *
 * validateMatchRules(rules); // No error thrown
 * ```
 */
export const validateMatchRules = <T extends MatchTypes>(
    rules: T[]
) => {

    assert(Array.isArray(rules), 'rules must be an array');

    for (const r in rules) {

        const rule = rules[r]!;

        assert(rule && typeof rule === 'object', `rule[${r}] must be an object`);

        const matchTypes = ['is', 'startsWith', 'endsWith', 'includes', 'match'] as const;

        assert(
            matchTypes.some(type => rule[type] !== undefined),
            `rule[${r}] must specify at least one match type (is, startsWith, endsWith, includes, match)`
        );

        for (const type of matchTypes) {

            const value = rule[type];

            if (value === undefined) {

                continue;
            }

            if (type === 'match') {

                assert(
                    value instanceof RegExp,
                    `rule[${r}].match must be a RegExp`
                );

                continue;
            }

            assert(
                typeof value === 'string',
                `rule[${r}].${type} must be a string`
            );

            assert(
                (value as string).length > 0,
                `rule[${r}].${type} cannot be an empty string`
            );
        }

        // If 'is' is defined, no other match types should be defined
        if (rule.is !== undefined) {

            assert(
                !matchTypes
                    .filter(type => type !== 'is')
                    .some(type => rule[type] !== undefined),
                `rule[${r}] 'is' contradicts with other match types and cannot be used together`
            );
        }
    }

}

/**
 * Finds the first matching rule from a list of rules.
 *
 * Rules are checked in order - first match wins. Both path and method
 * must match for a rule to be considered a match.
 *
 * @param rules - Array of rules to check
 * @param method - HTTP method of the request
 * @param path - Request path
 * @param defaultMethods - Default methods to use when rule doesn't specify any
 * @returns The first matching rule, or undefined if no rules match
 *
 * @example
 * ```typescript
 * const rules = [
 *     { startsWith: '/admin', enabled: false },
 *     { endsWith: '/stream', enabled: false },
 *     { startsWith: '/api', methods: ['GET', 'POST'] }
 * ];
 *
 * findMatchingRule(rules, 'GET', '/admin/users', ['GET']);
 * // Returns: { startsWith: '/admin', enabled: false }
 * ```
 */
export const findMatchingRule = <T extends MatchTypes & { methods?: _InternalHttpMethods[] | undefined }>(
    rules: T[],
    method: string,
    path: string,
    defaultMethods: _InternalHttpMethods[]
): T | undefined => {

    for (const rule of rules) {

        if (matchPath(rule, path) && matchMethod(method, rule.methods, defaultMethods)) {

            return rule;
        }
    }

    return undefined;
};

/**
 * Default request serializer for generating deduplication and cache keys.
 *
 * Serializes method, URL path+search, payload, and headers into a unique string key.
 * Objects are serialized with sorted keys for consistency.
 *
 * Uses `url.pathname + url.search` which:
 * - Includes the full path and query parameters
 * - Excludes the hash fragment (which shouldn't affect request identity)
 * - Excludes the origin (handled by FetchEngine instance)
 *
 * Note: `params` is no longer serialized separately since it's already
 * included in `url.search`.
 *
 * @param opts - Request key options containing method, url, payload, headers
 * @returns A unique string key for the request
 *
 * @example
 * ```typescript
 * defaultRequestSerializer({
 *     method: 'GET',
 *     path: '/users/123',
 *     url: new URL('https://api.example.com/users/123?page=1'),
 *     payload: undefined,
 *     headers: { Authorization: 'Bearer token' }
 * });
 * // Returns: 'GET|/users/123?page=1|undefined|{"Authorization":"Bearer token"}'
 * ```
 */
export const defaultRequestSerializer = (opts: RequestKeyOptions): string => {

    // Use url.pathname + url.search to get path with query params, excluding hash
    const urlKey = opts.url.pathname + opts.url.search;

    const parts = [
        serializer([opts.method]),
        serializer([urlKey]),
        serializer([opts.payload]),
        serializer([opts.headers])
    ];

    return parts.join('|');
};


/**
 * Default serializer for rate limit bucket keys.
 *
 * Groups requests by method + pathname only (no query params, payload, or headers).
 * This creates per-endpoint rate limiting where all requests to the same path
 * share the same rate limit bucket.
 *
 * @param opts - Request key options
 * @returns A unique string key for the rate limit bucket
 *
 * @example
 * ```typescript
 * defaultRateLimitSerializer({
 *     method: 'GET',
 *     path: '/users/123',
 *     url: new URL('https://api.example.com/users/123?page=1'),
 *     headers: { Authorization: 'Bearer token' }
 * });
 * // Returns: 'GET|/users/123'
 * ```
 */
export const defaultRateLimitSerializer = (opts: RequestKeyOptions): string => {

    return `${opts.method}|${opts.url.pathname}`;
};

