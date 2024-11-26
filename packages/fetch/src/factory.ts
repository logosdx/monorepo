import { Func, assert, isFunction, txt } from '@logos-ui/utils';

import {
    _InternalHttpMethods,
    HttpMethodOpts,
    HttpMethods,
    LogosUiFetch,
    MethodHeaders
} from './types.ts';

import { FetchError,
    FetchEvent,
    FetchEventName,
    FetchEventNames,
    fetchTypes,
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
    H = LogosUiFetch.InstanceHeaders,
    S = {},
> extends EventTarget {

    #baseUrl: URL;
    #options: Partial<LogosUiFetch.RequestOpts>;
    #headers: LogosUiFetch.Headers<H>;
    #methodHeaders: MethodHeaders<H>;
    #type: LogosUiFetch.Type;

    #modifyOptions?: LogosUiFetch.Options<H, S>['modifyOptions'];
    #modifyMethodOptions?: HttpMethodOpts<LogosUiFetch.Options<H, S>['modifyOptions']>;

    #validate?: LogosUiFetch.Options<H, S>['validate'];

    /**
     * For saving values that may be needed to craft requests as the
     * application progresses; for example: as you login, you get a
     * token of some sort which is used to generate an hmac.
     */
    #state: S = {} as S;

    /**
     * Removes a header from the `FetchFactory` instance
     */
    removeHeader: FetchFactory<S, H>['rmHeader'];

    #validateHeaders(headers: LogosUiFetch.Headers<H>, method?: HttpMethods) {

        if (this.#validate?.headers) {

            this.#validate.headers(
                headers,
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
        type: LogosUiFetch.Type,
        isJson: boolean
    } {

        if (this.#options.determineType) {

            const type = this.#options.determineType(response);

            if (!fetchTypes.includes(type)) {

                console.warn(`Invalid type: '${type}'. Defaulting to '${this.#type}'`);

                return {
                    type: this.#type,
                    isJson: this.#type === 'json'
                }
            }

            return {
                type,
                isJson: type === 'json'
            };
        }
        else {

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
                else if (/image|audio|video|font|binary|application/.test(contentType)) {

                    return { type: 'blob', isJson: false };
                }
                else if (/form-data/.test(contentType)) {

                    return { type: 'formData', isJson: false };
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
        }

        return { type: this.#type, isJson: this.#type === 'json' };
    }

    #formatHeaders(headers: LogosUiFetch.Headers<H>) {

        const opts = this.#options.formatHeaders ?? 'lowercase';

        if (opts === false) {

            return headers as LogosUiFetch.Headers<H>;
        }

        if (typeof opts === 'function') {

            return opts(headers) as LogosUiFetch.Headers<H>;
        }

        const formatWith = (
            headers: LogosUiFetch.Headers<H>,
            callback: (key: string) => string
        ) => {

            return Object.fromEntries(
                Object.keys(headers).map(
                    (key) => ([callback(key), headers[key]])
                )
            ) as LogosUiFetch.Headers<H>;
        }

        if (opts === 'lowercase') {

            return formatWith(
                headers,
                (key: string) => key.toLowerCase()
            ) as LogosUiFetch.Headers<H>;
        }

        if (opts === 'uppercase') {

            return formatWith(
                headers,
                (key: string) => key.toUpperCase()
            ) as LogosUiFetch.Headers<H>;
        }
    }

    constructor(_opts: LogosUiFetch.Options<H, S>) {

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
        this.#headers = opts.headers || {} as LogosUiFetch.Headers<H>;
        this.#methodHeaders = Object.fromEntries(
            Object.keys(opts.methodHeaders || {}).map(
                (method) => ([method.toUpperCase(), opts.methodHeaders![method as never]])
            )
        );

        this.#modifyOptions = modifyOptions;
        this.#modifyMethodOptions = modifyMethodOptions ;
        this.#validate = validate;

        this.removeHeader = this.rmHeader.bind(this) as FetchFactory<S, H>['rmHeader'];

        this.#validateHeaders(this.#headers);
    }

    /**
     * Makes headers
     * @param override
     * @returns
     */
    private makeHeaders(override: LogosUiFetch.Headers<H> = {}, method?: HttpMethods) {

        const methodHeaders = this.#methodHeaders;

        const key = method?.toUpperCase() as keyof typeof methodHeaders;

        return this.#formatHeaders({
            ...this.#headers,
            ...(methodHeaders[key] || {}),
            ...override
        });
    }

    /**
     * Makes url based on basePath
     * @param path
     */
    private makeUrl(path: string) {

        path = path?.replace(/^\/{1,}/, '');
        const url = this.#baseUrl.toString().replace(/\/$/, '');

        return `${url}/${path}`;
    }

    /**
     * Makes an API call using fetch
     * @returns
     */
    private async makeCall <Res>(
        _method: HttpMethods,
        path: string,
        options: (
            LogosUiFetch.CallOptions<H> &
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
            ...rest
        } = options;

        const url = this.makeUrl(path);

        const type = this.#type;
        const defaultOptions = this.#options;
        const state = this.#state;
        const modifyOptions = this.#modifyOptions;
        const modifyMethodOptions = this.#modifyMethodOptions;
        const method = _method.toUpperCase() as _InternalHttpMethods;

        let opts: LogosUiFetch.RequestOpts = {
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
                ) as LogosUiFetch.Headers<H>,
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

            response = await fetch(url, opts) as Response;

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
                error.stack = err.stack;

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

            if (err instanceof FetchError === false) {

                error = new FetchError(err.message);
            }
            else {

                error = err;
            }

            const fetchError = error as FetchError;

            let statusCode = fetchError.status || 999;
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
            readonly default: Readonly<LogosUiFetch.Headers<H>>,
            readonly get?: Readonly<LogosUiFetch.Headers<H>>,
            readonly post?: Readonly<LogosUiFetch.Headers<H>>,
            readonly put?: Readonly<LogosUiFetch.Headers<H>>,
            readonly delete?: Readonly<LogosUiFetch.Headers<H>>,
            readonly options?: Readonly<LogosUiFetch.Headers<H>>,
            readonly patch?: Readonly<LogosUiFetch.Headers<H>>,
        }
    }

    /**
     * Makes a request
     */
    request <Res = any, Data = any>(
        method: HttpMethods,
        path: string,
        options: (
            LogosUiFetch.CallOptions<H> &
            ({ payload: Data | null } | {})
         ) = { payload: null }
    ): LogosUiFetch.AbortablePromise<Res> {


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

        }) as LogosUiFetch.AbortablePromise<Res>;


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
    options <Res = any>(path: string, options: LogosUiFetch.CallOptions<H> = {}) {

        return this.request <Res, null>('options', path, options);
    }

    /**
     * Makes a get request
     */
    get <Res = any>(path: string, options: LogosUiFetch.CallOptions<H> = {}) {

        return this.request <Res, null>('get', path, options);
    }

    /**
     * Makes a delete request
     */
    delete <Res = any, Data = any>(path: string, payload: Data | null = null, options: LogosUiFetch.CallOptions<H> = {}) {

        return this.request <Res, Data>('delete', path, { ...options, payload });
    }

    /**
     * Makes a post request
     */
    post <Res = any, Data = any>(path: string, payload: Data | null = null, options: LogosUiFetch.CallOptions<H> = {}) {

        return this.request <Res, Data>('post', path, { ...options, payload });
    }

    /**
     * Makes a put request
     */
    put <Res = any, Data = any>(path: string, payload: Data | null = null, options: LogosUiFetch.CallOptions<H> = {}) {

        return this.request <Res, Data>('put', path, { ...options, payload });
    }

    /**
     * Makes a patch request
     */
    patch <Res = any, Data = any>(path: string, payload: Data | null = null, options: LogosUiFetch.CallOptions<H> = {}) {

        return this.request <Res, Data>('patch', path, { ...options, payload });
    }

    /**
     * Set an object of headers
     */
    addHeader<K extends keyof H>(name: K, value: H[K]): void
    addHeader(name: string, value: string): void
    addHeader(headers: LogosUiFetch.Headers<H>): void
    addHeader(
        headers: (
            LogosUiFetch.Headers<H> |
            keyof H |
            string
        ),
        value?: string | H[keyof H]
    ) {

        assert(
            (typeof headers === 'string' && !!value) ||
            typeof headers === 'object',
            'addHeader requires a string and value or an object'
        );

        let updated = {
            ...this.#headers
        } as LogosUiFetch.Headers<H>;

        if (typeof headers === 'string') {

            updated[
                headers as keyof LogosUiFetch.Headers<H>
            ] = value as never;
        }
        else {

            Object
                .keys(headers)
                .forEach(
                    (name) => {

                        const key = name as keyof LogosUiFetch.Headers<H>;

                        updated[key] = headers[key as never]
                    }
                );
        }

        this.#validateHeaders(updated);

        this.#headers = this.#formatHeaders(updated)!;

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-header-add'], {
                state: this.#state,
                data: {
                    headers,
                    value,
                    updated
                }
            })
        );
    }

    /**
     * Remove headers by reference, array of names, or single name
     */
    rmHeader (headers: keyof H): void
    rmHeader (headers: (keyof H)[]): void
    rmHeader (headers: string): void
    rmHeader (headers: string[]): void
    rmHeader (headers: unknown) {

        if (!headers) {
            return;
        }

        if (typeof headers === 'string') {

            delete this.#headers[headers];
        }

        let _names = headers as (keyof LogosUiFetch.Headers<H>)[];

        if (!Array.isArray(headers)) {

            _names = Object.keys(headers);
        }

        for (const name of _names) {
            delete this.#headers[name];
        }

        this.#validateHeaders(this.#headers);

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-header-remove'], {
                state: this.#state,
                data: headers
            })
        );
    }

    /**
     * Checks if header is set
     */
    hasHeader(name: (keyof LogosUiFetch.Headers<H>)) {

        return this.#headers.hasOwnProperty(name);
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

        return this.#state;
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
