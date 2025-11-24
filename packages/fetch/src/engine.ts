import {
    assert,
    assertOptional,
    clone,
    attempt,
    wait,
    isPlainObject,
    isPrimitive,
} from '@logosdx/utils';

import { ObserverEngine } from '@logosdx/observer';

import {
    type _InternalHttpMethods,
    type HttpMethodOpts,
    type HttpMethods,
    type MethodHeaders,
    type RetryConfig,
    type FetchResponse,
    type FetchConfig
} from './types.ts';

import {
    FetchError,
    fetchTypes,
    validateOptions,
    DEFAULT_RETRY_CONFIG
} from './helpers.ts';

/**
 * Creates a wrapper around `window.fetch` that allows
 * certain overrides of default fetch options. Implements
 * an abort controller per request that can be intercepted
 * using `opts.signal.abort()`.
 *
 * Provides resilient HTTP client with retry logic, request/response
 * interception, and comprehensive error handling for production
 * applications that need reliable API communication.
 *
 * * See abort controller:
 * * * https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 * * * https://github.com/facebook/react-native/blob/0.67-stable/packages/rn-tester/js/examples/XHR/XHRExampleAbortController.js
 *
 * @template H - Type of request headers
 * @template P - Type of request params
 * @template S - Type of instance state
 * @template RH - Type of response headers
 *
 * @example
 * // Basic setup with error handling
 * const api = new FetchEngine({
 *     baseUrl: 'https://api.example.com',
 *     defaultType: 'json',
 *     headers: { 'Authorization': 'Bearer token' }
 * });
 *
 * const [user, err] = await attempt(() => api.get('/users/123'));
 * if (err) {
 *     console.error('Failed to fetch user:', err);
 *     return;
 * }
 *
 * @example
 * // Advanced setup with retry and validation
 * const api = new FetchEngine({
 *     baseUrl: 'https://api.example.com',
 *     retry: {
 *         maxAttempts: 3,
 *         baseDelay: 1000,
 *         shouldRetry: (error) => error.status >= 500
 *     },
 *     validate: {
 *         headers: (headers) => {
 *             if (!headers.Authorization) {
 *                 throw new Error('Authorization header required');
 *             }
 *         }
 *     }
 * });
 */
export class FetchEngine<
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    S = FetchEngine.InstanceState,
    RH = FetchEngine.InstanceResponseHeaders,
> extends ObserverEngine<FetchEngine.EventMap<S, H>> {

    /**
     * Symbol to use the default value or configuration
     * for a given option. For example, if you want to
     * handle the response type yourself, you can set the
     * `determineType` option to a function that returns
     * the type of the response, or you can return the
     * `FetchEngine.useDefault` to use the internal logic.
     *
     * Allows custom type determination logic to fall back to
     * the built-in content-type detection when needed.
     *
     * @example
     * const api = new FetchEngine({
     *     baseUrl: 'https://api.example.com',
     *     determineType: (response) => {
     *         // Custom logic for special endpoints
     *         if (response.url.includes('/download')) {
     *             return 'blob';
     *         }
     *         // Fall back to default detection
     *         return FetchEngine.useDefault;
     *     }
     * });
     */
    static useDefault = Symbol('useDefault');

    #baseUrl: URL;
    #options: Partial<FetchEngine.RequestOpts>;
    #headers: FetchEngine.Headers<H>;
    #methodHeaders: MethodHeaders<H>;
    #params: FetchEngine.Params<P>;
    #methodParams: HttpMethodOpts<P>;
    #type: FetchEngine.Type;

    #modifyOptions?: FetchEngine.Options<H, P, S>['modifyOptions'];
    #modifyMethodOptions?: HttpMethodOpts<FetchEngine.Options<H, P, S>['modifyOptions']>;

    #validate?: FetchEngine.Options<H, P, S>['validate'];

    #instanceAbortController = new AbortController();

    /**
     * For saving values that may be needed to craft requests as the
     * application progresses; for example: as you login, you get a
     * token of some sort which is used to generate an hmac.
     *
     * Maintains request context across multiple API calls, such as
     * authentication tokens, session data, or user preferences that
     * need to be included in subsequent requests.
     *
     * @example
     * const api = new FetchEngine({
     *     baseUrl: 'https://api.example.com'
     * });
     *
     * // Store auth token after login
     * api.setState('authToken', 'bearer-token-123');
     *
     * // Use token in subsequent requests
     * api.addHeader('Authorization', `Bearer ${api.getState().authToken}`);
     */
    #state: S = {} as S;

    #retry: Required<RetryConfig>;

    get #destroyed() {

        return this.#instanceAbortController.signal.aborted;
    }

    /**
     * Removes a header from the `FetchEngine` instance
     */
    removeHeader: FetchEngine<H, P, S>['rmHeader'];

    /**
     * Removes a param from the `FetchEngine` instance
     */
    removeParam: FetchEngine<H, P, S>['rmParams'];

    #validateHeaders(headers: FetchEngine.Headers<H>, method?: HttpMethods) {

        if (this.#validate?.headers) {

            this.#validate.headers(
                headers,
                method?.toUpperCase() as _InternalHttpMethods
            );
        }
    }

    /**
     * Validates parameters using the configured validation function.
     *
     * Ensures request parameters meet requirements before making requests,
     * allowing custom validation logic for data integrity.
     *
     * @param params - Parameters to validate
     * @param method - HTTP method for context-specific validation
     * @internal
     */
    #validateParams(params: FetchEngine.Params<P>, method?: HttpMethods) {

        if (this.#validate?.params) {

            this.#validate.params(
                params,
                method?.toUpperCase() as _InternalHttpMethods
            );
        }
    }

    /**
     * Validates state using the configured validation function.
     *
     * Ensures internal state meets requirements when updated,
     * allowing custom validation logic for state consistency.
     *
     * @param state - State to validate
     * @internal
     */
    #validateState(state: S) {

        if (this.#validate?.state) {

            this.#validate.state(state);
        }
    }

    /**
     * Determines the response type based on content-type header or custom logic.
     *
     * Analyzes the response content-type to determine how to parse the response.
     * Supports custom type determination through the determineType option,
     * with fallback to built-in content-type detection logic.
     *
     * @param response - Fetch Response object to analyze
     * @returns Object with type and isJson flag
     * @throws {FetchError} When content-type is unknown and no fallback is available
     * @internal
     *
     * @example
     * // Custom type determination
     * const api = new FetchEngine({
     *     baseUrl: 'https://api.example.com',
     *     determineType: (response) => {
     *         if (response.url.includes('/csv')) return 'text';
     *         if (response.url.includes('/download')) return 'blob';
     *         return FetchEngine.useDefault; // Use built-in detection
     *     }
     * });
     */
    #determineType(response: Response): {
        type: FetchEngine.Type,
        isJson: boolean
    } {

        if (this.#options.determineType) {

            const type = this.#options.determineType(response);

            if (FetchEngine.useDefault !== type) {

                if (!fetchTypes.includes(type as FetchEngine.Type)) {

                    console.warn(`Invalid type: '${type}'. Defaulting to '${this.#type}'`);

                    return {
                        type: this.#type,
                        isJson: this.#type === 'json'
                    }
                }

                return {
                    type: type as FetchEngine.Type,
                    isJson: type === 'json'
                };
            }
        }

        const contentType = (
            response.headers.get('content-type') ||
            response.headers.get('Content-Type') ||
            ''
        );

        if (contentType) {

            if (/text|xml|html|form-urlencoded/.test(contentType)) {

                return { type: 'text', isJson: false };
            }
            else if (/json/.test(contentType)) {

                return { type: 'json', isJson: true };
            }
            else if (/form-data/.test(contentType)) {

                return { type: 'formData', isJson: false };
            }
            else if (/image|audio|video|font|binary|application/.test(contentType)) {

                return { type: 'blob', isJson: false };
            }
            else {

                throw new FetchError(
                    'Unknown content type: ' +
                    contentType +
                    ' You may need to set the "determineType" option' +
                    ' to customize how the response is parsed.'
                );
            }
        }

        return { type: this.#type, isJson: this.#type === 'json' };
    }


    /**
     * Initializes a new FetchEngine instance with the provided configuration.
     *
     * Sets up the HTTP client with base URL, default settings, retry configuration,
     * and validation rules. Validates all options and establishes the initial state.
     *
     * @param _opts - Configuration options for the FetchEngine instance
     * @throws {Error} When validation fails for required options
     *
     * @example
     * const api = new FetchEngine({
     *     baseUrl: 'https://api.example.com',
     *     defaultType: 'json',
     *     headers: { 'Authorization': 'Bearer token' },
     *     retry: {
     *         maxAttempts: 3,
     *         baseDelay: 1000
     *     }
     * });
     */
    constructor(_opts: FetchEngine.Options<H, P, S>) {

        // Extract ObserverEngine options and pass to super
        super({
            name: _opts.name,
            spy: _opts.spy as any
        });

        validateOptions(_opts);

        const { baseUrl, defaultType, name: _name, spy: _spy, ...opts } = _opts;
        let { retry } = _opts;

        if (retry === true) {
            retry = {}
        }

        this.#baseUrl = new URL(baseUrl);
        this.#type = defaultType || 'json';
        this.#retry = {
            ...DEFAULT_RETRY_CONFIG,
            ...(
                retry ? retry : {
                    maxAttempts: 0
                }
            )
        };

        const {
            modifyOptions,
            modifyMethodOptions,
            validate,
            ...rest
        } = opts;

        this.#options = rest;
        this.#headers = opts.headers || {} as FetchEngine.Headers<H>;
        this.#methodHeaders = Object.fromEntries(
            Object.keys(opts.methodHeaders || {}).map(
                (method) => ([method.toUpperCase(), opts.methodHeaders![method as never]])
            )
        );
        this.#params = opts.params || {} as FetchEngine.Params<P>;
        this.#methodParams = opts.methodParams || {} as HttpMethodOpts<P>;

        this.#modifyOptions = modifyOptions;
        this.#modifyMethodOptions = modifyMethodOptions!;
        this.#validate = validate;

        this.removeHeader = this.rmHeader.bind(this) as FetchEngine<H, P, S>['rmHeader'];
        this.removeParam = this.rmParams.bind(this) as FetchEngine<H, P, S>['rmParams'];

        this.#validateHeaders(this.#headers);
    }

    /**
     * Calculate delay for retry attempt using exponential backoff.
     *
     * Implements exponential backoff strategy to prevent overwhelming
     * servers during retry attempts. Supports both fixed and dynamic
     * delay calculations based on error conditions.
     *
     * @param attemptNo - Current attempt number (1-based)
     * @param retry - Retry configuration with delay settings
     * @param error - Optional error for dynamic delay calculation
     * @returns Delay in milliseconds before next retry attempt
     * @internal
     *
     * @example
     * // Exponential backoff: 1000ms, 2000ms, 4000ms, 8000ms...
     * const delay = this.#calculateRetryDelay(3, {
     *     baseDelay: 1000,
     *     maxDelay: 10000,
     *     useExponentialBackoff: true
     * });
     * // Returns 4000ms for 3rd attempt
     */
    #calculateRetryDelay(attemptNo: number, retry: Required<RetryConfig>): number {

        const { baseDelay, maxDelay, useExponentialBackoff } = retry;

        if (!useExponentialBackoff) return Math.min(baseDelay, maxDelay!);

        const delay = baseDelay * Math.pow(2, attemptNo - 1);

        return Math.min(delay, maxDelay!);
    }

    /**
     * Merges default headers with method-specific and override headers.
     *
     * Combines instance headers, method-specific headers, and request-specific
     * overrides to create the final header set for a request. Applies
     * formatting rules to ensure consistent header casing.
     *
     * @param override - Request-specific header overrides
     * @param method - HTTP method for method-specific headers
     * @returns Merged and formatted headers
     * @internal
     *
     * @example
     * // Merges: default headers + POST headers + request overrides
     * const headers = this.#makeHeaders(
     *     { 'X-Request-ID': '123' },
     *     'POST'
     * );
     */
    #makeHeaders(override: FetchEngine.Headers<H> = {}, method?: HttpMethods) {

        const methodHeaders = this.#methodHeaders;

        const key = method?.toUpperCase() as keyof typeof methodHeaders;

        return {
            ...this.#headers,
            ...(methodHeaders[key] || {}),
            ...override
        };
    }

    /**
     * Merges default parameters with method-specific and override parameters.
     *
     * Combines instance parameters, method-specific parameters, and request-specific
     * overrides to create the final parameter set for a request URL.
     *
     * @param override - Request-specific parameter overrides
     * @param method - HTTP method for method-specific parameters
     * @returns Merged parameters
     * @internal
     *
     * @example
     * // Merges: default params + GET params + request overrides
     * const params = this.#makeParams(
     *     { page: 2 },
     *     'GET'
     * );
     */
    #makeParams(override: FetchEngine.Params<P> = {}, method?: HttpMethods) {

        const methodParams = this.#methodParams;

        const key = method?.toUpperCase() as keyof typeof methodParams;

        return {
            ...(this.#params || {}),
            ...(methodParams[key] || {}),
            ...override
        };
    }

    /**
     * Constructs the full URL by combining base URL, path, and parameters.
     *
     * Builds the complete request URL by merging the base URL with the path
     * and appending merged parameters. Handles existing query parameters
     * in the path and merges them with instance and method-specific parameters.
     *
     * @param path - Request path (may include existing query parameters)
     * @param _params - Request-specific parameters to merge
     * @param method - HTTP method for method-specific parameters
     * @returns Complete URL with merged parameters
     * @internal
     *
     * @example
     * // Input: path='/users?page=1', params={limit: 10}
     * // Output: 'https://api.example.com/users?page=1&limit=10'
     * const url = this.#makeUrl('/users?page=1', { limit: 10 }, 'GET');
     */
    #makeUrl(path: string, _params?: P, method?: HttpMethods) {

        if (path.startsWith('http')) {

            const url = new URL(path);
            const params = this.#makeParams(_params!, method);

            Object.entries(params).forEach(([key, value]) => {

                url.searchParams.set(key, value as string);
            });

            return url.toString();
        }

        path = path?.replace(/^\/{1,}/, '');
        const url = this.#baseUrl.toString().replace(/\/$/, '');
        const params = this.#makeParams(_params!, method);

        const [basePath, ...rest] = path.split('?');

        const existingParams = new URLSearchParams(rest.join('?'));
        const newParams = new URLSearchParams(params);

        if (
            existingParams.size === 0 &&
            newParams.size === 0
        ) {

            return `${url}/${path}`;
        }

        const mergedParams = new URLSearchParams([
            ...existingParams.entries(),
            ...newParams.entries()
        ]);

        if (this.#validate?.perRequest?.params) {

            this.#validateParams(
                Object.fromEntries(mergedParams.entries()) as FetchEngine.Params<P>,
                method
            );
        }


        return `${url}/${basePath}?${mergedParams.toString()}`;
    }

    #extractRetry(opts: FetchEngine.RequestOpts) {

        let { retry } = opts;

        if (retry === true) {
            retry = {};
        }

        return retry;
    }

    #handleError(opts: {
        error: FetchError | Error,
        step: 'fetch' | 'parse' | 'response',
        attempt: number,
        status?: number,
        method?: HttpMethods,
        path?: string,
        aborted?: boolean,
        url?: string,
        headers?: FetchEngine.Headers<H>,
        data?: unknown,
        onError?: FetchEngine.Lifecycle['onError']
    }) {

        const {
            error,
            step,
            attempt: attemptNo,
            status,
            method,
            path,
            aborted,
            data,
            url,
            headers,
            onError
        } = opts;

        let err = error as FetchError<{}, H>;

        if (step === 'fetch') {

            err = new FetchError(err.message);

            err.status = 499;
            err.message = err.message || 'Fetch error';
        }

        if (step === 'parse') {

            err = new FetchError(err.message);

            err.status = status ||999;
            err.message = err.message || 'Parse error';
        }

        if (step === 'response') {

            const asAgg = error as AggregateError;
            let errors = asAgg.errors as Error[];
            let errCode = '';

            // Handle undici errors
            if (
                !errors ||
                errors.length === 0 &&
                error.cause instanceof AggregateError
            ) {

                errors = (error.cause as AggregateError)?.errors as Error[];
            }

            if ((error as any)?.code) {
                errCode = (error as any).code;
            }

            if (errors && errors.length > 0) {

                const msgs = errors.map((e) => e.message).join('; ');

                err = new FetchError(`${errCode}: ${msgs}`);
            }
            else {

                err = new FetchError(error.message);
            }
        }

        err.attempt = attemptNo;
        err.status = err.status || status!;
        err.method = err.method || method!;
        err.path = err.path || path!;
        err.aborted = err.aborted || aborted!;
        err.data = err.data || data as null;
        err.step = err.step || step;
        err.headers = (err.headers || headers) as H;

        const eventData = {
            error: err,
            state: this.#state,
            attempt: attemptNo,
            step,
            status,
            method,
            path,
            aborted,
            data,
            url,
            headers: headers as H
        }

        if (aborted) {

            this.emit('fetch-abort', eventData);
        }
        else {

            this.emit('fetch-error', eventData);
        }

        onError && onError(err);

        throw err;
    }

    /**
     * Makes an API call using fetch with retry logic and returns enhanced response object.
     *
     * Performs the actual HTTP request and returns a comprehensive FetchResponse
     * object containing the parsed data, response headers, status code, request
     * details, and configuration used. This provides full context about the
     * request and response for better debugging and conditional logic.
     *
     * @param _method - HTTP method for the request
     * @param path - Request path relative to base URL
     * @param options - Request options including payload and controller
     * @returns FetchResponse object with data, headers, status, request, and config
     * @internal
     */
    async #makeCall <Res, ReqRH = RH>(
        _method: HttpMethods,
        path: string,
        options: (
            FetchEngine.CallOptions<H, P> &
            {
                payload?: unknown,
                controller: AbortController,
                attempt?: number
            }
        )
    ): Promise<FetchResponse<Res, H, P, ReqRH>> {

        const {
            payload,
            controller,
            onAfterReq: onAfterRequest,
            onBeforeReq: onBeforeRequest,
            onError,
            timeout = this.#options.timeout,
            params,
            attempt: attempNo,
            ...rest
        } = options;

        const type = this.#type;
        const defaultOptions = this.#options;
        const state = this.#state;
        const modifyOptions = this.#modifyOptions;
        const modifyMethodOptions = this.#modifyMethodOptions;
        const method = _method.toUpperCase() as _InternalHttpMethods;
        const url = this.#makeUrl(path, params as P, method);

        let opts: FetchEngine.RequestOpts = {
            method,
            signal: rest.signal || controller.signal,
            controller,
            ...defaultOptions,
            ...rest,
        };

        opts.headers = this.#makeHeaders(rest.headers, method);

        if (/put|post|patch|delete/i.test(method)) {
            if (
                type === 'json' &&
                (isPlainObject(payload) || isPrimitive(payload) || Array.isArray(payload))
            ) {
                opts.body = JSON.stringify(payload);
            }
            else {
                opts.body = payload as BodyInit;
            }
        }

        opts = modifyOptions
            ? modifyOptions(opts as never, state)
            : opts;

        const methodSpecificModify = modifyMethodOptions?.[method] as typeof modifyOptions;

        if (methodSpecificModify) {
            opts = methodSpecificModify(opts as never, state);
        }

        if (this.#validate?.perRequest?.headers) {

            this.#validateHeaders(
                (opts.headers || {}) as FetchEngine.Headers<H>,
                method
            );
        }

        this.emit('fetch-before', {
            ...opts,
            payload,
            url,
            state: this.#state,
            attempt: attempNo
        } as any);

        onBeforeRequest && onBeforeRequest(opts);

        const [response, resErr] = await attempt(async () => {
            return await fetch(url, opts as never) as Response;
        });

        // Fetch will only throw if the request is aborted,
        // denied, timed out, reset, etc.
        if (resErr) {
            this.#handleError({
                error: resErr,
                step: 'fetch',
                attempt: attempNo!,
                method,
                path,
                aborted: options.controller.signal.aborted,
                url,
                headers: opts.headers as FetchEngine.Headers<H>,
                onError
            });

            // #handleError throws, so this should never be reached
            throw resErr;
        }

        this.emit('fetch-after', {
            ...opts,
            payload,
            url,
            state: this.#state,
            response: response.clone(),
            attempt: attempNo
        } as any);

        onAfterRequest && onAfterRequest(response.clone(), opts);

        const [data, parseErr] = await attempt(async () => {

            const { type, isJson } = this.#determineType(response);

            if (isJson) {
                const text = await response.text();

                if (text) {
                    return JSON.parse(text) as Res;
                }

                return null;
            }
            else {

                return await response[type]() as Res;
            }
        });

        if (parseErr) {

            this.#handleError({
                error: parseErr,
                step: 'parse',
                attempt: attempNo!,
                status: response.status,
                method,
                path,
                aborted: options.controller.signal.aborted,
                url,
                headers: opts.headers as FetchEngine.Headers<H>,
                data,
                onError
            });

            // #handleError throws, so this should never be reached
            throw parseErr;
        }

        if (response.ok === false) {

            this.#handleError({
                error: new FetchError(response.statusText),
                step: 'response',
                attempt: attempNo!,
                status: response.status,
                method,
                path,
                aborted: options.controller.signal.aborted,
                url,
                headers: opts.headers as FetchEngine.Headers<H>,
                data,
                onError
            });

            // #handleError throws, so this should never be reached
            throw new FetchError(response.statusText);
        }

        this.emit('fetch-response', {
            ...opts,
            payload,
            url,
            state: this.#state,
            response,
            data,
            attempt: attempNo
        } as any);

        // Build the configuration object for the response
        const mergedParams = this.#makeParams(params as FetchEngine.Params<P>, method);

        const config: FetchConfig<H, P> = {
            baseUrl: this.#baseUrl.toString(),
            timeout,
            method,
            headers: opts.headers as H,
            params: mergedParams as P,
            retry: this.#retry,
            determineType: this.#options.determineType,
        };

        // Create the Request object for the response
        const request = new Request(url, opts as RequestInit);

        // Convert response headers to plain object for typed access
        const headers = {} as Partial<ReqRH>;

        response.headers.forEach((value, key) => {

            headers[key as keyof ReqRH] = value as ReqRH[keyof ReqRH];
        });

        // Return the enhanced response object
        return {
            data: data!,
            headers,
            status: response.status,
            request,
            config
        }
    }

    async #attemptCall<Res, ReqRH = RH>(
        _method: HttpMethods,
        path: string,
        options: (
            FetchEngine.CallOptions<H, P> &
            {
                payload?: unknown,
                controller: AbortController,
                cancelTimeout?: NodeJS.Timeout,
            }
        )
    ): Promise<FetchResponse<Res, H, P, ReqRH>> {
        const mergedRetry = {
            ...this.#retry,
            ...this.#extractRetry(options)
        };

        if (mergedRetry.maxAttempts === 0) {

            return this.#makeCall<Res, ReqRH>(_method, path, options);
        }

        let _attempt = 1;

        while (_attempt <= mergedRetry.maxAttempts!) {

            const [result, err] = await attempt(
                async () => (
                    this.#makeCall<Res, ReqRH>(
                        _method,
                        path,
                        {
                            ...options,
                            attempt: _attempt
                        }
                    )
                )
            );

            if (err === null) {
                return result;
            }

            const fetchError = err as FetchError;

            // Check if we should retry
            const shouldRetry = await mergedRetry.shouldRetry(fetchError, _attempt);

            if (shouldRetry && _attempt <= mergedRetry.maxAttempts!) {

                // If shouldRetry is a number, use it as the delay
                // Otherwise, calculate the delay using the default logic
                const delay = (
                    typeof shouldRetry === 'number' ?
                    shouldRetry :
                    this.#calculateRetryDelay(_attempt, mergedRetry)
                );

                this.emit('fetch-retry', {
                    state: this.#state,
                    error: fetchError,
                    attempt: _attempt,
                    nextAttempt: _attempt + 1,
                    delay
                } as any);

                await wait(delay);

                _attempt++;
                continue;
            }

            throw fetchError;
        }

        // This should never be reached - all paths should either return or throw
        throw new FetchError('Unexpected end of retry logic');
    }

    /**
     * Returns all the headers configured for this instance,
     * including the method specific headers.
     */
    get headers() {

        const method = Object.keys(this.#methodHeaders).reduce(
            (acc, k) => {

                const key = k as _InternalHttpMethods;
                const methodHeaders = this.#methodHeaders;

                const headers = this.#methodHeaders[k as keyof typeof methodHeaders];

                if (headers) {

                    acc[key] = { ...headers };
                }

                return acc;
            },
            {} as MethodHeaders<H>
        );

        return {
            default: {
                ...this.#headers
            },
            ...method
        } as {
            readonly default: Readonly<FetchEngine.Headers<H>>,
            readonly get?: Readonly<FetchEngine.Headers<H>>,
            readonly post?: Readonly<FetchEngine.Headers<H>>,
            readonly put?: Readonly<FetchEngine.Headers<H>>,
            readonly delete?: Readonly<FetchEngine.Headers<H>>,
            readonly options?: Readonly<FetchEngine.Headers<H>>,
            readonly patch?: Readonly<FetchEngine.Headers<H>>,
        }
    }

    /**
     * Returns all the params configured for this instance,
     * including the method specific params.
     */
    get params() {

        const method = Object.keys(this.#methodParams).reduce(
            (acc, k) => {

                const key = k as _InternalHttpMethods;
                const methodParams = this.#methodParams;

                const params = this.#methodParams[k as keyof typeof methodParams];

                if (params) {

                    acc[key] = { ...params };
                }

                return acc;
            },
            {} as HttpMethodOpts<P>
        );

        return {
            default: {
                ...this.#params
            },
            ...method
        } as {
            readonly default: Readonly<FetchEngine.Params<P>>,
            readonly get?: Readonly<FetchEngine.Params<P>>,
            readonly post?: Readonly<FetchEngine.Params<P>>,
            readonly put?: Readonly<FetchEngine.Params<P>>,
            readonly delete?: Readonly<FetchEngine.Params<P>>,
            readonly options?: Readonly<FetchEngine.Params<P>>,
            readonly patch?: Readonly<FetchEngine.Params<P>>,
        }
    }

    /**
     * Makes an HTTP request with comprehensive error handling and retry logic.
     *
     * Executes HTTP requests with automatic retry on failure, timeout handling,
     * and abort controller support. Returns an enhanced response object containing
     * parsed data, HTTP metadata, request details, and configuration used.
     *
     * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
     * @param path - Request path relative to base URL
     * @param options - Request options including payload, timeout, and callbacks
     * @returns AbortablePromise that resolves to FetchResponse object with data and metadata
     *
     * @example
     * // Access response data and metadata
     * const [response, err] = await attempt(() =>
     *     api.request('GET', '/users/123')
     * );
     * if (err) {
     *     console.error('Request failed:', err.status, err.message);
     *     return;
     * }
     *
     * console.log('User data:', response.data);
     * console.log('Status:', response.status);
     * console.log('Headers:', response.headers.get('content-type'));
     *
     * @example
     * // Destructure just the data for backward compatibility
     * const { data: user } = await api.request('GET', '/users/123');
     *
     * @example
     * // Request with payload and timeout
     * const request = api.request('POST', '/users', {
     *     payload: { name: 'John', email: 'john@example.com' },
     *     timeout: 5000,
     *     onBeforeReq: (opts) => console.log('Making request:', opts),
     *     onError: (err) => console.error('Request error:', err)
     * });
     *
     * // Abort request if needed
     * setTimeout(() => request.abort('User cancelled'), 2000);
     */
    request <Res = any, Data = any, ReqRH = RH>(
        method: HttpMethods,
        path: string,
        options: (
            FetchEngine.CallOptions<H, P> &
            ({ payload: Data | null } | {})
         ) = { payload: null }
    ): FetchEngine.AbortablePromise<FetchResponse<Res, H, P, ReqRH>> {

        // Prevent requests on destroyed instances (memory leak prevention)
        if (this.#destroyed) {

            throw new Error('Cannot make requests on destroyed FetchEngine instance');
        }

        // https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
        const controller = options.abortController ?? new AbortController();

        const timeoutMs = options.timeout || this.#options.timeout;

        if (timeoutMs) {

            assert(timeoutMs > -1, 'timeout must be positive number');
        }

        const timeout = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

        const onAfterReq = (...args: any[]) => {

            clearTimeout(timeout);

            options.onAfterReq?.apply(this, args as never);
        }

        const onError = (...args: any[]) => {

            clearTimeout(timeout);

            options.onError?.apply(this, args as never);
        }

        const call = this.#attemptCall <Res, ReqRH>(method, path, {
            ...options,
            controller,
            onAfterReq,
            onError
        }).then((res) => {

            call.isFinished = true;

            return res!;

        }).finally(() => {

            // Guarantee timeout cleanup in all code paths (memory leak prevention)
            clearTimeout(timeout);

        }) as FetchEngine.AbortablePromise<FetchResponse<Res, H, P, ReqRH>>;

        Object.defineProperty(call, 'isAborted', {
            get: () => controller.signal.aborted,
        });

        call.isFinished = false;

        call.abort = (reason?: string) => {

            controller.abort(reason);
        };

        return call;
    }

    /**
     * Makes an OPTIONS request to check server capabilities.
     *
     * Convenience method for OPTIONS requests, commonly used for CORS
     * preflight checks and discovering server capabilities.
     *
     * @param path - Request path relative to base URL
     * @param options - Request options
     * @returns AbortablePromise that resolves to response data
     *
     * @example
     * const [capabilities, err] = await attempt(() =>
     *     api.options('/users')
     * );
     */
    options <Res = any, ReqRH = RH>(path: string, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, null, ReqRH>('options', path, options);
    }

    /**
     * Makes a GET request to retrieve data.
     *
     * Convenience method for GET requests, the most common HTTP method
     * for retrieving data from APIs. Returns an enhanced response object
     * containing parsed data, headers, status, and request context.
     *
     * @param path - Request path relative to base URL
     * @param options - Request options
     * @returns AbortablePromise that resolves to FetchResponse object
     *
     * @example
     * // Access full response details
     * const [response, err] = await attempt(() =>
     *     api.get('/users?page=1&limit=10')
     * );
     * if (err) return;
     *
     * console.log('Users:', response.data);
     * console.log('Status:', response.status);
     * console.log('Content-Type:', response.headers['content-type']);
     *
     * @example
     * // Destructure just the data
     * const { data: users } = await api.get('/users');
     */
    get <Res = any, ReqRH = RH>(path: string, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, null, ReqRH>('get', path, options);
    }

    /**
     * Makes a DELETE request to remove a resource.
     *
     * Convenience method for DELETE requests, typically used to remove
     * resources from the server.
     *
     * @param path - Request path relative to base URL
     * @param payload - Optional payload for the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to response data
     *
     * @example
     * const [result, err] = await attempt(() =>
     *     api.delete('/users/123')
     * );
     */
    delete <Res = any, Data = any, ReqRH = RH>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data, ReqRH>('delete', path, { ...options, payload });
    }

    /**
     * Makes a POST request to create a new resource.
     *
     * Convenience method for POST requests, typically used to create
     * new resources on the server. Returns an enhanced response object
     * containing parsed data, headers, status, and request context.
     *
     * @param path - Request path relative to base URL
     * @param payload - Data to send in the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to FetchResponse object
     *
     * @example
     * // Access full response details
     * const [response, err] = await attempt(() =>
     *     api.post('/users', {
     *         name: 'John Doe',
     *         email: 'john@example.com'
     *     })
     * );
     * if (err) return;
     *
     * console.log('Created user:', response.data);
     * console.log('Location header:', response.headers['location']);
     *
     * @example
     * // Destructure just the data
     * const { data: newUser } = await api.post('/users', userData);
     */
    post <Res = any, Data = any, ReqRH = RH>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data, ReqRH>('post', path, { ...options, payload });
    }

    /**
     * Makes a PUT request to replace a resource.
     *
     * Convenience method for PUT requests, typically used to completely
     * replace an existing resource on the server.
     *
     * @param path - Request path relative to base URL
     * @param payload - Data to send in the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to response data
     *
     * @example
     * const [updatedUser, err] = await attempt(() =>
     *     api.put('/users/123', {
     *         name: 'Jane Doe',
     *         email: 'jane@example.com'
     *     })
     * );
     */
    put <Res = any, Data = any, ReqRH = RH>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data, ReqRH>('put', path, { ...options, payload });
    }

    /**
     * Makes a PATCH request to partially update a resource.
     *
     * Convenience method for PATCH requests, typically used to partially
     * update an existing resource on the server.
     *
     * @param path - Request path relative to base URL
     * @param payload - Partial data to update in the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to response data
     *
     * @example
     * const [updatedUser, err] = await attempt(() =>
     *     api.patch('/users/123', {
     *         email: 'newemail@example.com'
     *     })
     * );
     */
    patch <Res = any, Data = any, ReqRH = RH>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data, ReqRH>('patch', path, { ...options, payload });
    }

    /**
     * Adds headers to the FetchEngine instance for use in requests.
     *
     * Supports adding individual headers, multiple headers at once, and
     * method-specific headers. Headers can be added globally or for
     * specific HTTP methods to provide fine-grained control over
     * request headers.
     *
     * @param headers - Header name, object of headers, or header name with value
     * @param value - Header value (when adding single header)
     * @param method - Optional HTTP method for method-specific headers
     *
     * @example
     * // Add single header globally
     * api.addHeader('Authorization', 'Bearer token');
     *
     * // Add multiple headers globally
     * api.addHeader({
     *     'Content-Type': 'application/json',
     *     'X-API-Version': 'v1'
     * });
     *
     * // Add method-specific headers
     * api.addHeader('Content-Type', 'application/json', 'POST');
     * api.addHeader({
     *     'X-Request-ID': '123',
     *     'X-User-ID': '456'
     * }, 'GET');
     */
    addHeader<K extends keyof H>(name: K, value: H[K], method?: _InternalHttpMethods): void
    addHeader(name: string, value: string, method?: _InternalHttpMethods): void
    addHeader(headers: FetchEngine.Headers<H>, method?: _InternalHttpMethods): void
    addHeader(
        headers: (
            FetchEngine.Headers<H> |
            keyof H |
            string
        ),
        value?: string | H[keyof H],
        method?: _InternalHttpMethods
    ) {

        assert(
            (typeof headers === 'string' && !!value) ||
            typeof headers === 'object',
            'addHeader requires a string and value or an object'
        );

        assertOptional(
            method,
            !!method && typeof method === 'string',
            'addHeader requires a string method'
        );

        const isString = typeof headers === 'string';

        if (isString) {

            assert(
                typeof value !== 'undefined',
                'addHeader requires a value when setting a single property'
            );
        }
        else {

            method = method || value as _InternalHttpMethods;
        }

        let updated = {
            ...this.#headers
        } as FetchEngine.Headers<H>;

        if (method) {

            if (this.#methodHeaders[method]) {
                updated = {
                    ...this.#methodHeaders[method]
                } as FetchEngine.Headers<H>;
            }
            else {
                this.#methodHeaders[method] = {};
            }
        }

        if (typeof headers === 'string') {

            updated[
                headers as keyof FetchEngine.Headers<H>
            ] = value as never;
        }
        else {

            Object
                .keys(headers)
                .forEach(
                    (name) => {

                        const key = name as keyof FetchEngine.Headers<H>;

                        updated[key] = headers[key as never]
                    }
                );
        }

        this.#validateHeaders(updated);

        if (method) {

            this.#methodHeaders[method] = updated;
        }
        else {

            this.#headers = updated;
        }

        this.emit('fetch-header-add', {
            state: this.#state,
            data: {
                headers,
                value,
                updated,
                method
            }
        });
    }

    /**
     * Removes headers from the FetchEngine instance.
     *
     * Supports removing individual headers, multiple headers at once, and
     * method-specific headers. Headers can be removed globally or for
     * specific HTTP methods to provide fine-grained control over
     * request headers.
     *
     * @param headers - Header name, array of header names, or object with header names
     * @param method - Optional HTTP method for method-specific header removal
     *
     * @example
     * // Remove single header globally
     * api.rmHeader('Authorization');
     *
     * // Remove multiple headers globally
     * api.rmHeader(['Content-Type', 'X-API-Version']);
     *
     * // Remove method-specific headers
     * api.rmHeader('Content-Type', 'POST');
     * api.rmHeader(['X-Request-ID', 'X-User-ID'], 'GET');
     *
     * // Remove headers by object reference
     * const headersToRemove = { 'Content-Type': true, 'Authorization': true };
     * api.rmHeader(headersToRemove);
     */
    rmHeader (headers: keyof H, method?: _InternalHttpMethods): void
    rmHeader (headers: (keyof H)[], method?: _InternalHttpMethods): void
    rmHeader (headers: string, method?: _InternalHttpMethods): void
    rmHeader (headers: string[], method?: _InternalHttpMethods): void
    rmHeader (headers: unknown, method?: _InternalHttpMethods): void {

        if (!headers) {
            return;
        }

        let updated = { ...this.#headers };

        if (method) {

            if (this.#methodHeaders[method]) {
                updated = {
                    ...this.#methodHeaders[method]
                } as FetchEngine.Headers<H>;
            }
            else {
                this.#methodHeaders[method] = {};
            }
        }

        if (typeof headers === 'string') {

            delete updated[headers];
        }

        let _names = headers as (keyof FetchEngine.Headers<H>)[];

        if (!Array.isArray(headers)) {

            _names = Object.keys(headers);
        }

        for (const name of _names) {
            delete updated[name];
        }

        this.#validateHeaders(updated);

        if (method) {

            this.#methodHeaders[method] = updated;
        }
        else {

            this.#headers = updated;
        }

        this.emit('fetch-header-remove', {
            state: this.#state,
            data: {
                headers,
                updated,
                method,
            }
        });
    }

    /**
     * Checks if a header is configured for the FetchEngine instance.
     *
     * Determines whether a specific header exists in the global headers
     * or method-specific headers, allowing validation of header configuration.
     *
     * @param name - Header name to check
     * @param method - Optional HTTP method for method-specific header check
     * @returns True if the header exists, false otherwise
     *
     * @example
     * // Check global headers
     * if (api.hasHeader('Authorization')) {
     *     console.log('Auth header is configured');
     * }
     *
     * // Check method-specific headers
     * if (api.hasHeader('Content-Type', 'POST')) {
     *     console.log('POST requests have Content-Type header');
     * }
     */
    hasHeader<K extends keyof H>(name: K, method?: _InternalHttpMethods): boolean
    hasHeader(name: string, method?: _InternalHttpMethods): boolean
    hasHeader(name: string, method?: _InternalHttpMethods): boolean {

        if (method) {

            return this.#methodHeaders[method]?.hasOwnProperty(name) || false;
        }

        return this.#headers.hasOwnProperty(name);
    }

    /**
     * Adds parameters to the FetchEngine instance for use in request URLs.
     *
     * Supports adding individual parameters, multiple parameters at once, and
     * method-specific parameters. Parameters can be added globally or for
     * specific HTTP methods to provide fine-grained control over URL parameters.
     *
     * @param params - Parameter name, object of parameters, or parameter name with value
     * @param value - Parameter value (when adding single parameter)
     * @param method - Optional HTTP method for method-specific parameters
     *
     * @example
     * // Add single parameter globally
     * api.addParam('version', 'v1');
     *
     * // Add multiple parameters globally
     * api.addParam({
     *     'api_key': 'abc123',
     *     'format': 'json'
     * });
     *
     * // Add method-specific parameters
     * api.addParam('page', '1', 'GET');
     * api.addParam({
     *     'limit': '10',
     *     'sort': 'name'
     * }, 'GET');
     */
    addParam<K extends keyof P>(name: K, value: P[K], method?: _InternalHttpMethods): void
    addParam(name: string, value: string, method?: _InternalHttpMethods): void
    addParam(params: FetchEngine.Params<P>, method?: _InternalHttpMethods): void
    addParam(
        params: (
            FetchEngine.Params<P> |
            keyof P |
            string
        ),
        value?: string | P[keyof P],
        method?: _InternalHttpMethods
    ) {

        assert(
            (typeof params === 'string' && !!value) ||
            typeof params === 'object',
            'addParam requires a string and value or an object'
        );

        assertOptional(
            method,
            !!method && typeof method === 'string',
            'addParam requires a string method'
        );

        const paramsIsString = typeof params === 'string';

        if (paramsIsString) {

            assert(
                typeof value !== 'undefined',
                'addParam requires a value when setting a single property'
            );
        }
        else {

            method = method || value as _InternalHttpMethods;
        }

        let updated = {
            ...this.#params
        } as FetchEngine.Params<P>;

        if (method) {

            if (this.#methodParams[method]) {
                updated = {
                    ...this.#methodParams[method]
                };
            }
            else {
                this.#methodParams[method] = {} as P;
            }
        }

        if (paramsIsString) {

            updated[
                params as keyof FetchEngine.Params<P>
            ] = value as never;
        }
        else {

            Object
                .keys(params)
                .forEach(
                    (name) => {

                        const key = name as keyof FetchEngine.Params<P>;

                        updated[key] = params[key as never]
                    }
                );
        }

        if (method) {

            this.#methodParams[method] = updated as P;
        }
        else {

            this.#params = updated;
        }

        this.#validateParams(updated);

        this.emit('fetch-param-add', {
            state: this.#state,
            data: {
                params,
                value,
                updated,
                method
            }
        });
    }

    /**
     * Removes parameters from the FetchEngine instance.
     *
     * Supports removing individual parameters, multiple parameters at once, and
     * method-specific parameters. Parameters can be removed globally or for
     * specific HTTP methods to provide fine-grained control over URL parameters.
     *
     * @param params - Parameter name, array of parameter names, or object with parameter names
     * @param method - Optional HTTP method for method-specific parameter removal
     *
     * @example
     * // Remove single parameter globally
     * api.rmParams('version');
     *
     * // Remove multiple parameters globally
     * api.rmParams(['api_key', 'format']);
     *
     * // Remove method-specific parameters
     * api.rmParams('page', 'GET');
     * api.rmParams(['limit', 'sort'], 'GET');
     *
     * // Remove parameters by object reference
     * const paramsToRemove = { 'api_key': true, 'format': true };
     * api.rmParams(paramsToRemove);
     */
    rmParams (params: keyof P, method?: _InternalHttpMethods): void
    rmParams (params: (keyof P)[], method?: _InternalHttpMethods): void
    rmParams (params: string, method?: _InternalHttpMethods): void
    rmParams (params: string[], method?: _InternalHttpMethods): void
    rmParams (params: unknown, method?: _InternalHttpMethods): void {

        if (!params) {
            return;
        }

        let updated = { ...this.#params };

        if (method) {

            if (this.#methodParams[method]) {
                updated = {
                    ...this.#methodParams[method]
                };
            }
            else {
                this.#methodParams[method] = {} as P;
            }
        }

        if (typeof params === 'string') {

            delete updated[params];
        }

        let _names = params as (keyof FetchEngine.Params<P>)[];

        if (!Array.isArray(params)) {

            _names = Object.keys(params);
        }

        for (const name of _names) {
            delete updated[name];
        }

        if (method) {

            this.#methodParams[method] = updated as P;
        }
        else {

            this.#params = updated;
        }

        this.emit('fetch-param-remove', {
            state: this.#state,
            data: {
                params,
                updated,
                method
            }
        });
    }

    /**
     * Checks if a parameter is configured for the FetchEngine instance.
     *
     * Determines whether a specific parameter exists in the global parameters
     * or method-specific parameters, allowing validation of parameter configuration.
     *
     * @param name - Parameter name to check
     * @param method - Optional HTTP method for method-specific parameter check
     * @returns True if the parameter exists, false otherwise
     *
     * @example
     * // Check global parameters
     * if (api.hasParam('version')) {
     *     console.log('Version parameter is configured');
     * }
     *
     * // Check method-specific parameters
     * if (api.hasParam('page', 'GET')) {
     *     console.log('GET requests have page parameter');
     * }
     */
    hasParam<K extends keyof P>(name: K, method?: _InternalHttpMethods): boolean
    hasParam(name: string, method?: _InternalHttpMethods): boolean
    hasParam(name: string, method?: _InternalHttpMethods): boolean {

        if (method) {

            return this.#methodParams[method]?.hasOwnProperty(name) || false;
        }

        return this.#params.hasOwnProperty(name);
    }


    /**
     * Updates the FetchEngine instance state with new values.
     *
     * Merges new state values into the existing state, supporting both
     * individual property updates and bulk object updates. State is used
     * to maintain request context across multiple API calls.
     *
     * @param conf - State property name or object with state updates
     * @param value - Value to set (when updating single property)
     *
     * @example
     * // Set single state property
     * api.setState('authToken', 'bearer-token-123');
     *
     * // Set multiple state properties
     * api.setState({
     *     userId: '123',
     *     sessionId: 'abc',
     *     preferences: { theme: 'dark' }
     * });
     */
    setState<N extends keyof S>(name: N, value: S[N]): void
    setState(conf: Partial<S>): void
    setState(conf: unknown, value?: unknown) {

        assert(
            typeof conf === 'object' || typeof conf === 'string',
            'setState requires an object or string'
        );

        const updated = {
            ...this.#state
        };

        if (typeof conf === 'string') {

            assert(
                typeof value !== 'undefined',
                'setState requires a value when setting a single property'
            );

            updated[conf as keyof S] = value as S[keyof S];
        }
        else {

            Object
                .keys(conf as object)
                .forEach(
                    (name) => {

                        const key = name as keyof S;

                        updated[key] = (conf as S)[key];
                    }
                );
        }

        this.#validateState(updated);

        this.#state = updated as S;

        this.emit('fetch-state-set', {
            state: updated,
            data: conf
        });
    }

    /**
     * Resets the FetchEngine instance state to an empty object.
     *
     * Clears all stored state values and dispatches a state reset event.
     * Useful for cleaning up state when switching between different
     * user sessions or contexts.
     *
     * @example
     * // Clear all state when user logs out
     * api.resetState();
     * console.log(api.getState()); // {}
     */
    resetState() {

        this.#state = {} as S;

        this.#validateState(this.#state);

        this.emit('fetch-state-reset', {
            state: this.#state,
        });
    }

    /**
     * Returns a deep clone of the FetchEngine instance state.
     *
     * Provides a safe copy of the current state that can be inspected
     * or modified without affecting the original state.
     *
     * @returns Deep clone of the current state object
     *
     * @example
     * const state = api.getState();
     * console.log('Current state:', state);
     * // { authToken: 'bearer-123', userId: '456' }
     */
    getState() {

        return clone(this.#state);
    }

    /**
     * Changes the base URL for this FetchEngine instance.
     *
     * Updates the base URL used for all subsequent requests and dispatches
     * a URL change event. Useful for switching between different API
     * environments (development, staging, production).
     *
     * @param url - New base URL for the FetchEngine instance
     *
     * @example
     * // Switch to production API
     * api.changeBaseUrl('https://api.production.com');
     *
     * // Switch to staging API
     * api.changeBaseUrl('https://api.staging.com');
     */
    changeBaseUrl(url: string) {

        this.#baseUrl = new URL(url);

        this.emit('fetch-url-change', {
            state: this.#state,
            data: url
        });
    }

    /**
     * Updates the modifyOptions function for this FetchEngine instance.
     *
     * Changes the global options modification function that is applied to all
     * requests before they are sent. Pass undefined to clear the function.
     * Dispatches a modify options change event when updated.
     *
     * @param fn - New modifyOptions function or undefined to clear
     *
     * @example
     * // Set a global request modifier
     * api.changeModifyOptions((opts, state) => {
     *     opts.headers = { ...opts.headers, 'X-Request-ID': crypto.randomUUID() };
     *     return opts;
     * });
     *
     * // Clear the modifier
     * api.changeModifyOptions(undefined);
     */
    changeModifyOptions(fn?: FetchEngine.ModifyOptionsFn<H, P, S>) {

        this.#modifyOptions = fn;

        this.emit('fetch-modify-options-change', {
            state: this.#state,
            data: fn
        });
    }

    /**
     * Updates the modifyOptions function for a specific HTTP method.
     *
     * Changes the method-specific options modification function that is applied
     * to requests of the specified HTTP method before they are sent. Pass undefined
     * to clear the function for that method. Dispatches a modify method options
     * change event when updated.
     *
     * @param method - HTTP method to modify options for
     * @param fn - New modifyOptions function or undefined to clear
     *
     * @example
     * // Set a POST-specific request modifier
     * api.changeModifyMethodOptions('POST', (opts, state) => {
     *     opts.headers = { ...opts.headers, 'Content-Type': 'application/json' };
     *     return opts;
     * });
     *
     * // Clear the POST modifier
     * api.changeModifyMethodOptions('POST', undefined);
     */
    changeModifyMethodOptions(method: HttpMethods, fn?: FetchEngine.ModifyOptionsFn<H, P, S>) {

        const normalizedMethod = method.toUpperCase() as _InternalHttpMethods;

        if (!this.#modifyMethodOptions) {

            this.#modifyMethodOptions = {};
        }

        if (fn === undefined) {

            delete this.#modifyMethodOptions[normalizedMethod];
        }
        else {

            this.#modifyMethodOptions[normalizedMethod] = fn;
        }

        this.emit('fetch-modify-method-options-change', {
            state: this.#state,
            data: {
                method: normalizedMethod,
                fn
            }
        });
    }

    // Note: on() and off() are inherited from ObserverEngine
    // Use this.on('fetch-error', handler) or this.on(/fetch-.*/, handler) for wildcard

    /**
     * Destroys the FetchEngine instance and cleans up all resources.
     *
     * Marks the instance as destroyed and clears internal state references.
     * After calling destroy(), the instance should not be used for new requests.
     *
     * **Memory Leak Prevention:**
     * - Prevents new requests from being made (throws error if attempted)
     * - Clears all event listeners via ObserverEngine's clear()
     * - Clears internal state references
     * - Marks instance as destroyed
     *
     * @example
     * const api = new FetchEngine({ baseUrl: 'https://api.example.com' });
     *
     * api.on('fetch-error', (data) => console.error(data.error));
     * api.on('fetch-response', (data) => console.log(data));
     *
     * // destroy() automatically clears all listeners
     * api.destroy();
     */
    destroy() {

        if (this.#destroyed) {

            console.warn('FetchEngine instance already destroyed');
            return;
        }

        // Abort any ongoing requests first
        this.#instanceAbortController.abort();

        // Clear all event listeners via ObserverEngine
        this.clear();

        // Clear all internal references to allow garbage collection
        this.#state = {} as S;
        this.#headers = {} as FetchEngine.Headers<H>;
        this.#methodHeaders = {};
        this.#params = {} as FetchEngine.Params<P>;
        this.#methodParams = {};
        this.#options = {};
        this.#baseUrl = new URL('about:blank');

        // Clear function references (closures may capture large data)
        this.#modifyOptions = undefined;
        this.#modifyMethodOptions = undefined as never;
        this.#validate = undefined;

        // Clear retry config
        this.#retry = undefined as never;
    }

    /**
     * Checks if the FetchEngine instance has been destroyed.
     *
     * @returns true if destroy() has been called
     *
     * @example
     * if (!api.isDestroyed()) {
     *     await api.get('/users');
     * }
     */
    isDestroyed(): boolean {

        return this.#destroyed;
    }
}
