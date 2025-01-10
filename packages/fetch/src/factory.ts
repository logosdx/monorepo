import { Func, assert, assertOptional, deepClone, isFunction, txt } from '@logos-ui/utils';

import {
    _InternalHttpMethods,
    HttpMethodOpts,
    HttpMethods,
    MethodHeaders
} from './types.ts';

import {
    FetchError,
    FetchEvent,
    FetchEventName,
    FetchEventNames,
    fetchTypes,
    mapErrCodeToStatus,
    validateOptions
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
 * const api = new FetchFactory({
 *      baseUrl: 'http://website.com'
 *      type: 'json',
 *      headers: { 'content-type': 'application/json' }
 * })
 */
export class FetchFactory<
    H = FetchFactory.InstanceHeaders,
    P = FetchFactory.InstanceParams,
    S = {},
> extends EventTarget {

    /**
     * Symbol to use the default value or configuration
     * for a given option. For example, if you want to
     * handle the response type yourself, you can set the
     * `determineType` option to a function that returns
     * the type of the response, or you can return the
     * `FetchFactory.useDefault` to use the internal logic.
     */
    static useDefault = Symbol('useDefault');

    #baseUrl: URL;
    #options: Partial<FetchFactory.RequestOpts>;
    #headers: FetchFactory.Headers<H>;
    #methodHeaders: MethodHeaders<H>;
    #params: FetchFactory.Params<P>;
    #methodParams: HttpMethodOpts<P>;
    #type: FetchFactory.Type;

    #modifyOptions?: FetchFactory.Options<H, P, S>['modifyOptions'];
    #modifyMethodOptions?: HttpMethodOpts<FetchFactory.Options<H, P, S>['modifyOptions']>;

    #validate?: FetchFactory.Options<H, P, S>['validate'];

    /**
     * For saving values that may be needed to craft requests as the
     * application progresses; for example: as you login, you get a
     * token of some sort which is used to generate an hmac.
     */
    #state: S = {} as S;

    /**
     * Removes a header from the `FetchFactory` instance
     */
    removeHeader: FetchFactory<H, P, S>['rmHeader'];

    /**
     * Removes a param from the `FetchFactory` instance
     */
    removeParam: FetchFactory<H, P, S>['rmParams'];

    #validateHeaders(headers: FetchFactory.Headers<H>, method?: HttpMethods) {

        if (this.#validate?.headers) {

            this.#validate.headers(
                headers,
                method?.toUpperCase() as _InternalHttpMethods
            );
        }
    }

    #validateParams(params: FetchFactory.Params<P>, method?: HttpMethods) {

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
        type: FetchFactory.Type,
        isJson: boolean
    } {

        if (this.#options.determineType) {

            const type = this.#options.determineType(response);

            if (FetchFactory.useDefault !== type) {

                if (!fetchTypes.includes(type as FetchFactory.Type)) {

                    console.warn(`Invalid type: '${type}'. Defaulting to '${this.#type}'`);

                    return {
                        type: this.#type,
                        isJson: this.#type === 'json'
                    }
                }

                return {
                    type: type as FetchFactory.Type,
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

    #formatHeaders(headers: FetchFactory.Headers<H>) {

        const opts = this.#options.formatHeaders ?? 'lowercase';

        if (opts === false) {

            return headers as FetchFactory.Headers<H>;
        }

        if (typeof opts === 'function') {

            return opts(headers) as FetchFactory.Headers<H>;
        }

        const formatWith = (
            headers: FetchFactory.Headers<H>,
            callback: (key: string) => string
        ) => {

            return Object.fromEntries(
                Object.keys(headers).map(
                    (key) => ([callback(key), headers[key]])
                )
            ) as FetchFactory.Headers<H>;
        }

        if (opts === 'lowercase') {

            return formatWith(
                headers,
                (key: string) => key.toLowerCase()
            ) as FetchFactory.Headers<H>;
        }

        if (opts === 'uppercase') {

            return formatWith(
                headers,
                (key: string) => key.toUpperCase()
            ) as FetchFactory.Headers<H>;
        }
    }
    constructor(_opts: FetchFactory.Options<H, P, S>) {

        super()

        validateOptions(_opts);

        const { baseUrl, defaultType, ...opts } = _opts;

        this.#baseUrl = new URL(baseUrl);
        this.#type = defaultType || 'json';

        const {
            modifyOptions,
            modifyMethodOptions,
            validate,
            ...rest
        } = opts;

        this.#options = rest;
        this.#headers = opts.headers || {} as FetchFactory.Headers<H>;
        this.#methodHeaders = Object.fromEntries(
            Object.keys(opts.methodHeaders || {}).map(
                (method) => ([method.toUpperCase(), opts.methodHeaders![method as never]])
            )
        );
        this.#params = opts.params || {} as FetchFactory.Params<P>;
        this.#methodParams = opts.methodParams || {} as HttpMethodOpts<P>;

        this.#modifyOptions = modifyOptions;
        this.#modifyMethodOptions = modifyMethodOptions!;
        this.#validate = validate;

        this.removeHeader = this.rmHeader.bind(this) as FetchFactory<H, P, S>['rmHeader'];
        this.removeParam = this.rmParams.bind(this) as FetchFactory<H, P, S>['rmParams'];

        this.#validateHeaders(this.#headers);
    }

    /**
     * Makes headers
     */
    private makeHeaders(override: FetchFactory.Headers<H> = {}, method?: HttpMethods) {

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
    private makeParams(override: FetchFactory.Params<P> = {}, method?: HttpMethods) {

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
    private makeUrl(path: string, _params?: P, method?: HttpMethods) {

        path = path?.replace(/^\/{1,}/, '');
        const url = this.#baseUrl.toString().replace(/\/$/, '');
        const params = this.makeParams(_params!, method);

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
                Object.fromEntries(mergedParams.entries()) as FetchFactory.Params<P>,
                method
            );
        }


        return `${url}/${basePath}?${mergedParams.toString()}`;
    }

    /**
     * Makes an API call using fetch
     */
    private async makeCall <Res>(
        _method: HttpMethods,
        path: string,
        options: (
            FetchFactory.CallOptions<H, P> &
            {
                payload?: unknown,
                controller: AbortController,
                cancelTimeout?: NodeJS.Timeout
            }
        )
    ) {

        const {
            payload,
            controller,
            cancelTimeout,
            onAfterReq: onAfterRequest,
            onBeforeReq: onBeforeRequest,
            onError,
            timeout = this.#options.timeout,
            params,
            ...rest
        } = options;


        const type = this.#type;
        const defaultOptions = this.#options;
        const state = this.#state;
        const modifyOptions = this.#modifyOptions;
        const modifyMethodOptions = this.#modifyMethodOptions;
        const method = _method.toUpperCase() as _InternalHttpMethods;
        const url = this.makeUrl(path, params as P, method);

        let opts: FetchFactory.RequestOpts = {
            method,
            signal: rest.signal || controller.signal,
            controller,
            ...defaultOptions,
            ...rest,
        };

        opts.headers = this.makeHeaders(rest.headers, method);

        if (/put|post|patch|delete/i.test(method)) {

            if (type === 'json') {

                opts.body = JSON.stringify(payload);
            }
            else {

                opts.body = payload as BodyInit;
            }
        }

        let error!: FetchError | Error;
        let response: Response;

        opts = modifyOptions
            ? modifyOptions(opts as never, state)
            : opts;

        const methodSpecificModify = modifyMethodOptions?.[method] as typeof modifyOptions;

        if (methodSpecificModify) {

            opts = methodSpecificModify(opts as never, state);
        }

        if (this.#validate?.perRequest?.headers) {

            this.#validateHeaders(
                (
                    opts.headers ||
                    {}
                ) as FetchFactory.Headers<H>,
                method
            );
        }

        try {

            this.dispatchEvent(
                new FetchEvent(
                    FetchEventNames['fetch-before'],
                    {
                        ...opts,
                        payload,
                        url,
                        state: this.#state
                    }
                )
            );

            onBeforeRequest && onBeforeRequest(opts);

            response = await fetch(url, opts as never) as Response;

            clearTimeout(cancelTimeout);

            this.dispatchEvent(
                new FetchEvent(FetchEventNames['fetch-after'], {
                    ...opts,
                    payload,
                    url,
                    state: this.#state,
                    response: response.clone()
                })
            );

            onAfterRequest && onAfterRequest(response.clone(), opts);

            let data: unknown;
            let { status, statusText, ok } = response;

            try {

                const { type, isJson } = this.#determineType(response);

                if (isJson) {

                    data = await response.text();

                    if (data) {

                        data = JSON.parse(data as string);
                    }

                    if (!data) {

                        data = null;
                    }

                }
                else {

                    data = await response[type]();
                }
            }
            catch (e) {

                const err = e as Error;

                ok = false;
                error = new FetchError(err.message);
                error.stack = err.stack!;

                data = null;
                status = 999;
                statusText = err.message;
            }

            if (ok === true) {

                this.dispatchEvent(

                    new FetchEvent(

                        FetchEventNames['fetch-response'],
                        {
                            ...opts,
                            payload,
                            url,
                            state: this.#state,
                            response,
                            data
                        }
                    )
                );

                return data as Res;
            }

            if (error === undefined) {
                error = new FetchError(statusText);
            }

            const fetchError = error as FetchError;

            fetchError.data = data as null;
            fetchError.status = status;
            fetchError.method = method;
            fetchError.path = path;
            fetchError.aborted = options.controller.signal.aborted;

            throw fetchError;
        }
        catch (e) {

            const err = e as FetchError | Error;

            let errors: Error[] = [];
            let errCode: string = '';

            // Handle undici errors
            if (err?.cause instanceof AggregateError) {

                errors = err.cause.errors;
            }

            if ((err as any)?.code) {

                errCode = (err as any).code;
            }

            if (err instanceof FetchError === false) {

                error = new FetchError(err.message);
            }
            else {

                error = err;
            }

            const fetchError = error as FetchError;

            let statusCode = fetchError.status || mapErrCodeToStatus(errCode) || 999;
            const name = err.name;
            const message = (
                options.controller.signal.reason ||
                err.message ||
                name
            ) as string;

            if (options.controller.signal.aborted) {

                statusCode = 499;
                error.message = message
            }

            fetchError.status = statusCode;
            fetchError.data = fetchError.data || { message };
            fetchError.method = method;
            fetchError.path = path;
            fetchError.aborted = options.controller.signal.aborted;
        }

        if (options.controller.signal.aborted) {

            this.dispatchEvent(
                new FetchEvent(FetchEventNames['fetch-abort'], {
                    ...opts,
                    payload,
                    url,
                    state: this.#state
                })
            );
        }
        else {

            this.dispatchEvent(
                new FetchEvent(FetchEventNames['fetch-error'], {
                    ...opts,
                    payload,
                    url,
                    state: this.#state,
                    error: error as FetchError
                })
            );
        }

        onError && onError(error as FetchError);

        throw error;
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
            readonly default: Readonly<FetchFactory.Headers<H>>,
            readonly get?: Readonly<FetchFactory.Headers<H>>,
            readonly post?: Readonly<FetchFactory.Headers<H>>,
            readonly put?: Readonly<FetchFactory.Headers<H>>,
            readonly delete?: Readonly<FetchFactory.Headers<H>>,
            readonly options?: Readonly<FetchFactory.Headers<H>>,
            readonly patch?: Readonly<FetchFactory.Headers<H>>,
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
            readonly default: Readonly<FetchFactory.Params<P>>,
            readonly get?: Readonly<FetchFactory.Params<P>>,
            readonly post?: Readonly<FetchFactory.Params<P>>,
            readonly put?: Readonly<FetchFactory.Params<P>>,
            readonly delete?: Readonly<FetchFactory.Params<P>>,
            readonly options?: Readonly<FetchFactory.Params<P>>,
            readonly patch?: Readonly<FetchFactory.Params<P>>,
        }
    }

    /**
     * Makes a request
     */
    request <Res = any, Data = any>(
        method: HttpMethods,
        path: string,
        options: (
            FetchFactory.CallOptions<H, P> &
            ({ payload: Data | null } | {})
         ) = { payload: null }
    ): FetchFactory.AbortablePromise<Res> {


        // https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
        const controller = new AbortController();

        let cancelTimeout!: NodeJS.Timeout;
        const timeout = options.timeout || this.#options.timeout;

        if (timeout) {

            assert(timeout > -1, 'timeout must be positive number');

            cancelTimeout = setTimeout(() => (

                controller.abort(`Timeout after ${timeout}ms`)
            ), timeout);
        }


        const call = this.makeCall <Res>(method, path, {
            ...options,
            controller,
            cancelTimeout
        }).then((res) => {

            call.isFinished = true;

            return res;

        }) as FetchFactory.AbortablePromise<Res>;


        call.isFinished = false;
        call.isAborted = false;
        call.abort = (reason?: string) => {

            call.isAborted = true;

            if (cancelTimeout) {

                clearTimeout(cancelTimeout);
            }

            controller.abort(reason);
        };

        return call;
    }

    /**
     * Makes a options request
     */
    options <Res = any>(path: string, options: FetchFactory.CallOptions<H, P> = {}) {

        return this.request <Res, null>('options', path, options);
    }

    /**
     * Makes a get request
     */
    get <Res = any>(path: string, options: FetchFactory.CallOptions<H, P> = {}) {

        return this.request <Res, null>('get', path, options);
    }

    /**
     * Makes a delete request
     */
    delete <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchFactory.CallOptions<H, P> = {}) {

        return this.request <Res, Data>('delete', path, { ...options, payload });
    }

    /**
     * Makes a post request
     */
    post <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchFactory.CallOptions<H, P> = {}) {

        return this.request <Res, Data>('post', path, { ...options, payload });
    }

    /**
     * Makes a put request
     */
    put <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchFactory.CallOptions<H, P> = {}) {

        return this.request <Res, Data>('put', path, { ...options, payload });
    }

    /**
     * Makes a patch request
     */
    patch <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchFactory.CallOptions<H, P> = {}) {

        return this.request <Res, Data>('patch', path, { ...options, payload });
    }

    /**
     * Set an object of headers
     */
    addHeader<K extends keyof H>(name: K, value: H[K], method?: _InternalHttpMethods): void
    addHeader(name: string, value: string, method?: _InternalHttpMethods): void
    addHeader(headers: FetchFactory.Headers<H>, method?: _InternalHttpMethods): void
    addHeader(
        headers: (
            FetchFactory.Headers<H> |
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
        } as FetchFactory.Headers<H>;

        if (method) {

            if (this.#methodHeaders[method]) {
                updated = {
                    ...this.#methodHeaders[method]
                } as FetchFactory.Headers<H>;
            }
            else {
                this.#methodHeaders[method] = {};
            }
        }

        if (typeof headers === 'string') {

            updated[
                headers as keyof FetchFactory.Headers<H>
            ] = value as never;
        }
        else {

            Object
                .keys(headers)
                .forEach(
                    (name) => {

                        const key = name as keyof FetchFactory.Headers<H>;

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
                } as FetchFactory.Headers<H>;
            }
            else {
                this.#methodHeaders[method] = {};
            }
        }

        if (typeof headers === 'string') {

            delete updated[headers];
        }

        let _names = headers as (keyof FetchFactory.Headers<H>)[];

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
    addParam(params: FetchFactory.Params<P>, method?: _InternalHttpMethods): void
    addParam(
        params: (
            FetchFactory.Params<P> |
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
        } as FetchFactory.Params<P>;

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
                params as keyof FetchFactory.Params<P>
            ] = value as never;
        }
        else {

            Object
                .keys(params)
                .forEach(
                    (name) => {

                        const key = name as keyof FetchFactory.Params<P>;

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

        let _names = params as (keyof FetchFactory.Params<P>)[];

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
     * Merges a passed object into the `FetchFactory` instance state
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
     * Resets the `FetchFactory` instance state.
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
     * Returns the `FetchFactory` instance state.
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
     * Listen for events on this FetchFactory instance
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
     * Remove events listeners from this FetchFactory instance
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
