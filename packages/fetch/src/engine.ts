import {
    Func,
    assert,
    assertOptional,
    deepClone,
    isFunction,
    txt,
    attempt,
    attemptSync
} from '@logosdx/utils';

import {
    _InternalHttpMethods,
    HttpMethodOpts,
    HttpMethods,
    MethodHeaders,
    RetryConfig
} from './types.ts';

import {
    FetchError,
    FetchEvent,
    FetchEventName,
    FetchEventNames,
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
 * * See abort controller:
 * * * https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 * * * https://github.com/facebook/react-native/blob/0.67-stable/packages/rn-tester/js/examples/XHR/XHRExampleAbortController.js
 *
 * @example
 *
 * const api = new FetchEngine({
 *      baseUrl: 'http://website.com'
 *      type: 'json',
 *      headers: { 'content-type': 'application/json' }
 * })
 */
export class FetchEngine<
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    S = {},
> extends EventTarget {

    /**
     * Symbol to use the default value or configuration
     * for a given option. For example, if you want to
     * handle the response type yourself, you can set the
     * `determineType` option to a function that returns
     * the type of the response, or you can return the
     * `FetchEngine.useDefault` to use the internal logic.
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

    /**
     * For saving values that may be needed to craft requests as the
     * application progresses; for example: as you login, you get a
     * token of some sort which is used to generate an hmac.
     */
    #state: S = {} as S;

    #retryConfig: Required<RetryConfig>;

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

    #validateParams(params: FetchEngine.Params<P>, method?: HttpMethods) {

        if (this.#validate?.params) {

            this.#validate.params(
                params,
                method?.toUpperCase() as _InternalHttpMethods
            );
        }
    }

    #validateState(state: S) {

        if (this.#validate?.state) {

            this.#validate.state(state);
        }
    }

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

                throw new FetchError(txt.msgs(
                    'Unknown content type:',
                    contentType,
                    'You may need to set the "determineType" option',
                    'to customize how the response is parsed.',
                ));
            }
        }

        return { type: this.#type, isJson: this.#type === 'json' };
    }

    #formatHeaders(headers: FetchEngine.Headers<H>) {

        const opts = this.#options.formatHeaders ?? 'lowercase';

        if (opts === false) {

            return headers as FetchEngine.Headers<H>;
        }

        if (typeof opts === 'function') {

            return opts(headers) as FetchEngine.Headers<H>;
        }

        const formatWith = (
            headers: FetchEngine.Headers<H>,
            callback: (key: string) => string
        ) => {

            return Object.fromEntries(
                Object.keys(headers).map(
                    (key) => ([callback(key), headers[key]])
                )
            ) as FetchEngine.Headers<H>;
        }

        if (opts === 'lowercase') {

            return formatWith(
                headers,
                (key: string) => key.toLowerCase()
            ) as FetchEngine.Headers<H>;
        }

        if (opts === 'uppercase') {

            return formatWith(
                headers,
                (key: string) => key.toUpperCase()
            ) as FetchEngine.Headers<H>;
        }
    }
    constructor(_opts: FetchEngine.Options<H, P, S>) {

        super()

        validateOptions(_opts);

        const { baseUrl, defaultType, retryConfig, ...opts } = _opts;

        this.#baseUrl = new URL(baseUrl);
        this.#type = defaultType || 'json';
        this.#retryConfig = {
            ...DEFAULT_RETRY_CONFIG,
            ...retryConfig
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
     * Calculate delay for retry attempt using exponential backoff
     */
    #calculateRetryDelay(attempt: number, retryConfig: Required<RetryConfig>, error?: FetchError): number {

        const { baseDelay, maxDelay, useExponentialBackoff } = retryConfig;

        // Get base delay value, handling both function and number cases
        let baseDelayValue: number;
        if (typeof baseDelay === 'function' && error) {
            baseDelayValue = baseDelay(error, attempt);
        } else if (typeof baseDelay === 'number') {
            baseDelayValue = baseDelay;
        } else {
            baseDelayValue = 1000; // Default fallback
        }

        if (!useExponentialBackoff) return Math.min(baseDelayValue, maxDelay!);

        const delay = baseDelayValue * Math.pow(2, attempt - 1);

        return Math.min(delay, maxDelay!);
    }

    /**
     * Makes headers
     */
    #makeHeaders(override: FetchEngine.Headers<H> = {}, method?: HttpMethods) {

        const methodHeaders = this.#methodHeaders;

        const key = method?.toUpperCase() as keyof typeof methodHeaders;

        return this.#formatHeaders({
            ...this.#headers,
            ...(methodHeaders[key] || {}),
            ...override
        });
    }

    /**
     * Makes params
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
     * Makes url based on basePath
     * @param path
     */
    #makeUrl(path: string, _params?: P, method?: HttpMethods) {

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
            attempt,
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

            err.status = 999;
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

        err.attempt = attempt;
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
            attempt,
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

            this.dispatchEvent(
                new FetchEvent(FetchEventNames['fetch-abort'], eventData)
            );
        }
        else {

            this.dispatchEvent(
                new FetchEvent(FetchEventNames['fetch-error'], eventData)
            );
        }

        onError && onError(err);

        throw err;
    }

    /**
     * Makes an API call using fetch with retry logic
     */
    async #makeCall <Res>(
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
    ) {

        const {
            payload,
            controller,
            onAfterReq: onAfterRequest,
            onBeforeReq: onBeforeRequest,
            onError,
            timeout = this.#options.timeout,
            params,
            attempt: _attempt,
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
            if (type === 'json') {
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

        this.dispatchEvent(
            new FetchEvent(
                FetchEventNames['fetch-before'],
                {
                    ...opts,
                    payload,
                    url,
                    state: this.#state,
                    attempt: _attempt
                }
            )
        );

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
                attempt: _attempt!,
                method,
                path,
                aborted: options.controller.signal.aborted,
                url,
                headers: opts.headers as FetchEngine.Headers<H>,
                onError
            });

            return;
        }

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-after'], {
                ...opts,
                payload,
                url,
                state: this.#state,
                response: response.clone(),
                attempt: _attempt
            })
        );

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
                attempt: _attempt!,
                status: response.status,
                method,
                path,
                aborted: options.controller.signal.aborted,
                url,
                headers: opts.headers as FetchEngine.Headers<H>,
                data,
                onError
            });

            return;
        }

        if (response.ok === false) {

            this.#handleError({
                error: new FetchError(response.statusText),
                step: 'response',
                attempt: _attempt!,
                status: response.status,
                method,
                path,
                aborted: options.controller.signal.aborted,
                url,
                headers: opts.headers as FetchEngine.Headers<H>,
                data,
                onError
            });

            return;
        }

        this.dispatchEvent(
            new FetchEvent(
                FetchEventNames['fetch-response'],
                {
                    ...opts,
                    payload,
                    url,
                    state: this.#state,
                    response,
                    data,
                    attempt: _attempt
                }
            )
        );

        return data as Res
    }

    async #attemptCall<Res>(
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
    ) {
        const mergedRetryConfig = {
            ...this.#retryConfig,
            ...options.retryConfig
        };

        if (mergedRetryConfig.maxAttempts === 0) {
            return this.#makeCall<Res>(_method, path, options);
        }

        let _attempt = 1;

        while (_attempt <= mergedRetryConfig.maxAttempts!) {

            const [result, err] = await attempt(
                async () => (
                    this.#makeCall<Res>(
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
            const shouldRetry = await mergedRetryConfig.shouldRetry(fetchError, _attempt);

            if (shouldRetry && _attempt <= mergedRetryConfig.maxAttempts!) {
                const delay = this.#calculateRetryDelay(_attempt, mergedRetryConfig, fetchError);

                this.dispatchEvent(
                    new FetchEvent(FetchEventNames['fetch-retry'], {
                        state: this.#state,
                        error: fetchError,
                        attempt: _attempt,
                        nextAttempt: _attempt + 1,
                        delay
                    })
                );

                await new Promise(resolve => setTimeout(resolve, delay));
                _attempt++;
                continue;
            }

            throw fetchError;
        }
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
     * Makes a request
     */
    request <Res = any, Data = any>(
        method: HttpMethods,
        path: string,
        options: (
            FetchEngine.CallOptions<H, P> &
            ({ payload: Data | null } | {})
         ) = { payload: null }
    ): FetchEngine.AbortablePromise<Res> {

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

        const call = this.#attemptCall <Res>(method, path, {
            ...options,
            controller,
            onAfterReq,
            onError
        }).then((res) => {

            call.isFinished = true;

            return res;

        }) as FetchEngine.AbortablePromise<Res>;

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
     * Makes a options request
     */
    options <Res = any>(path: string, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, null>('options', path, options);
    }

    /**
     * Makes a get request
     */
    get <Res = any>(path: string, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, null>('get', path, options);
    }

    /**
     * Makes a delete request
     */
    delete <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data>('delete', path, { ...options, payload });
    }

    /**
     * Makes a post request
     */
    post <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data>('post', path, { ...options, payload });
    }

    /**
     * Makes a put request
     */
    put <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data>('put', path, { ...options, payload });
    }

    /**
     * Makes a patch request
     */
    patch <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data>('patch', path, { ...options, payload });
    }

    /**
     * Set an object of headers
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

            this.#methodHeaders[method] = this.#formatHeaders(updated)!;
        }
        else {

            this.#headers = this.#formatHeaders(updated)!;
        }

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-header-add'], {
                state: this.#state,
                data: {
                    headers,
                    value,
                    updated,
                    method
                }
            })
        );
    }

    /**
     * Remove headers by reference, array of names, or single name
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

            this.#methodHeaders[method] = this.#formatHeaders(updated)!;
        }
        else {

            this.#headers = this.#formatHeaders(updated)!;
        }

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-header-remove'], {
                state: this.#state,
                data: {
                    headers,
                    updated,
                    method,
                }
            })
        );
    }

    /**
     * Checks if header is set
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
     * Sets a param
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

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-param-add'], {
                state: this.#state,
                data: {
                    params,
                    value,
                    updated,
                    method
                }
            })
        );
    }

    /**
     * Remove params by reference, array of names, or single name
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

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-param-remove'], {
                state: this.#state,
                data: {
                    params,
                    updated,
                    method
                }
            })
        );
    }

    /**
     * Checks if param is set
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
     * Merges a passed object into the `FetchEngine` instance state
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

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-state-set'], {
                state: updated,
                data: conf
            })
        );
    }

    /**
     * Resets the `FetchEngine` instance state.
     */
    resetState() {

        this.#state = {} as S;

        this.#validateState(this.#state);

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-state-reset'], {
                state: this.#state,
            })
        );
    }

    /**
     * Returns the `FetchEngine` instance state.
     */
    getState() {

        return deepClone(this.#state);
    }

    /**
     * Changes the base URL for this fetch instance
     * @param url
     */
    changeBaseUrl(url: string) {

        this.#baseUrl = new URL(url);

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-url-change'], {
                state: this.#state,
                data: url
            })
        );
    }

    /**
     * Listen for events on this FetchEngine instance
     */
    on(
        ev: FetchEventName | '*',
        listener: (
            e: (
                FetchEvent<S, H>
            )
        ) => void,
        once = false
    ) {

        if (ev === '*') {
            for (const _e in FetchEventNames) {

                this.addEventListener(_e, listener as Func, { once });
            }

            return;
        }

        this.addEventListener(ev, listener as Func, { once });
    }

    /**
     * Remove events listeners from this FetchEngine instance
     */
    off (ev: FetchEventName | '*', listener: EventListenerOrEventListenerObject) {

        if (ev === '*') {
            for (const _e in FetchEventNames) {

                this.removeEventListener(_e, listener);
            }

            return;
        }

        this.removeEventListener(ev, listener);
    }
}
