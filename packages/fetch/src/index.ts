import { Func, NonFunctionProps, assert, definePublicProps } from '@logos-ui/utils';

export type TypeOfFactory = 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text';

type _InternalHttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH';
type HttpMethods = _InternalHttpMethods | string;

type HttpMethodOpts<T> = Partial<Record<_InternalHttpMethods, T>>;

type RequestOptions = Omit<RequestInit, 'headers'>

/**
 * Override this interface with the headers you intend
 * to use and set throughout your app.
 */
export interface FetchHeaders {
    authorization?: string;
    'content-type'?: string;
};

type HeaderObj<T> = Record<string, string> & Partial<T>;

export type RequestHeaders = HeaderObj<FetchHeaders>;

export type FetchHeaderKeys = keyof RequestHeaders;

export type FetchReqOpts = RequestOptions &  {
    controller: AbortController,
    headers?: RequestHeaders,
    timeout?: number
};

type FetchFactoryLifecycle = {
    onError?: (err: FetchError) => void | Promise<void>
    onBeforeReq?: (opts: FetchReqOpts) => void | Promise<void>
    onAfterReq?: (response: Response, opts: FetchReqOpts) => void | Promise<void>
};

export type FetchFactoryOptions<
    State = {},
    InstanceHeaders = RequestHeaders
> = (

    Omit<
        FetchReqOpts,
        'method' | 'body' | 'integrity' | 'controller'
    > &

    {
        /**
         * The base URL for all requests
         */
        baseUrl: string,

        /**
         * The type of response expected from the server.
         * This will be used to determine how to parse the
         * response from the server.
         */
        type: TypeOfFactory,

        /**
         * The headers to be set on all requests
         */
        headers?: HeaderObj<InstanceHeaders>,

        /**
         * The headers to be set on requests of a specific method
         * @example
         * {
         *     GET: { 'content-type': 'application/json' },
         *     POST: { 'content-type': 'application/x-www-form-urlencoded'
         * }
         */
        methodHeaders?: HttpMethodOpts<HeaderObj<InstanceHeaders>>,

        // Applies to requests of a specific method
        /**
         *
         * @param opts
         * @param state
         * @returns
         */
        modifyOptions?: (opts: FetchReqOpts, state: State) => FetchReqOpts
        modifyMethodOptions?: HttpMethodOpts<
            FetchFactoryOptions<
                State,
                InstanceHeaders
            >['modifyOptions']
        >,

        timeout?: number,
        validate?: {
            headers?: (headers: HeaderObj<InstanceHeaders>, method?: HttpMethods) => void
            state?: (state: State) => void

            perRequest?: {
                headers?: boolean
            }
        }
    }
);

export interface AbortablePromise<T> extends Promise<T> {

    isFinished: boolean
    isAborted: boolean
    abort(reason?: string): void
}

export type FetchFactoryRequestOptions<InstanceHeaders = FetchHeaders> = (
    FetchFactoryLifecycle &
    Omit<FetchReqOpts, 'body' | 'method' | 'controller'> &
    { headers?: HeaderObj<InstanceHeaders>}
);

export interface FetchError<T = {}> extends Error {
    data: T | null;
    status: number;
    method: HttpMethods;
    path: string;
    aborted?: boolean;
}

export class FetchError<T = {}> extends Error {}

export class  FetchEvent<State = {}, InstanceHeaders = FetchHeaders> extends Event {
    state!: State
    url?: string
    method?: HttpMethods
    headers?: HeaderObj<InstanceHeaders>
    options?: FetchReqOpts
    data?: any
    payload?: any
    response?: Response
    error?: FetchError

    constructor(
        event: FetchEventName,
        opts: {
            state: State,
            url?: string,
            method?: HttpMethods,
            headers?: FetchHeaders,
            error?: FetchError,
            response?: Response,
            data?: any,
            payload?: any
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
    'fetch-state-set' = 'fetch-state-set',
    'fetch-state-reset' = 'fetch-state-reset',
    'fetch-url-change' = 'fetch-url-change',
};

export type FetchEventName = keyof typeof FetchEventNames;
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
    State = {},
    InstanceHeaders = FetchHeaders
> extends EventTarget {

    #_baseUrl: URL;
    #_options: Partial<FetchReqOpts>;
    #_headers: HeaderObj<InstanceHeaders>;
    #_methodHeaders: HttpMethodOpts<HeaderObj<InstanceHeaders>>;
    #_type: TypeOfFactory;

    #_modifyOptions?: FetchFactoryOptions<State, InstanceHeaders>['modifyOptions'];
    #_modifyMethodOptions?: HttpMethodOpts<FetchFactoryOptions<State, InstanceHeaders>['modifyOptions']>;

    #_validate?: FetchFactoryOptions<State, InstanceHeaders>['validate'];

    /**
     * For saving values that may be needed to craft requests as the
     * application progresses; for example: as you login, you get a
     * token of some sort which is used to generate an hmac.
     */
    #_state: State = {} as State;

    removeHeader: FetchFactory<State, InstanceHeaders>['rmHeader'];

    #_validateHeaders(headers: HeaderObj<InstanceHeaders>, method?: HttpMethods) {

        if (this.#_validate?.headers) {

            this.#_validate.headers(headers, method);
        }
    }

    #_validateState(state: State) {

        if (this.#_validate?.state) {

            this.#_validate.state(state);
        }
    }

    /**
     *
     * @param opts
     */
    constructor({ baseUrl, type, ...opts }: FetchFactoryOptions<State, InstanceHeaders>) {

        super()

        assert(!!baseUrl, 'baseUrl is required');
        assert(!!type, 'type is required');

        assert(
            ['json', 'arrayBuffer', 'blob', 'formData', 'text'].includes(type),
            'invalid type'
        );

        if (opts.timeout) {

            assert(opts.timeout > -1, 'timeout must be positive number');
        }

        this.#_baseUrl = new URL(baseUrl);
        this.#_type = type;

        const {
            modifyOptions,
            modifyMethodOptions,
            validate,
            ...rest
        } = opts;

        this.#_options = rest;
        this.#_headers = opts.headers || {} as HeaderObj<InstanceHeaders>;
        this.#_methodHeaders = Object.fromEntries(
            Object.keys(opts.methodHeaders || {}).map(
                (method) => ([method.toUpperCase(), opts.methodHeaders![method as never]])
            )
        );

        this.#_modifyOptions = modifyOptions;
        this.#_modifyMethodOptions = modifyMethodOptions;
        this.#_validate = validate;

        this.removeHeader = this.rmHeader.bind(this);

        this.#_validateHeaders(this.#_headers);
    }

    /**
     * Makes headers
     * @param override
     * @returns
     */
    private makeHeaders(override: RequestHeaders = {}, method?: HttpMethods) {

        const methodHeaders = this.#_methodHeaders[method?.toUpperCase() as keyof HttpMethodOpts<HeaderObj<InstanceHeaders>>] || {};

        return {
            ...this.#_headers,
            ...methodHeaders,
            ...override
        };
    }

    /**
     * Makes url based on basePath
     * @param path
     */
    private makeUrl(path: string) {

        path = path?.replace(/^\/{1,}/, '');
        const url = this.#_baseUrl.toString().replace(/\/$/, '');

        return `${url}/${path}`;
    }

    /**
     * Makes an API call using fetch
     * @returns
     */
    private async makeCall <Res>(
        method: HttpMethods,
        path: string,
        options: (
            FetchFactoryRequestOptions<InstanceHeaders> &
            FetchFactoryLifecycle &
            {
                payload?: any,
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
            timeout = this.#_options.timeout,
            ...rest
        } = options;

        const url = this.makeUrl(path);

        const type = this.#_type;
        const defaultOptions = this.#_options;
        const state = this.#_state;
        const modifyOptions = this.#_modifyOptions;
        const modifyMethodOptions = this.#_modifyMethodOptions;

        let opts: FetchReqOpts = {
            method: method.toUpperCase(),
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

                opts.body = payload;
            }
        }

        let error: FetchError;
        let response: Response;

        opts = modifyOptions ? modifyOptions(opts, state) : opts;

        const methodSpecificModify = modifyMethodOptions?.[method.toUpperCase() as never] as typeof modifyOptions;

        if (methodSpecificModify) {

            opts = methodSpecificModify(opts, state);
        }


        if (this.#_validate?.perRequest?.headers) {

            this.#_validateHeaders(
                opts.headers as HeaderObj<InstanceHeaders>,
                method
            );
        }


        try {

            this.dispatchEvent(
                new FetchEvent(FetchEventNames['fetch-before'], {
                    ...opts,
                    payload,
                    url,
                    state: this.#_state
                })
            );

            onBeforeRequest && onBeforeRequest(opts);

            response = await fetch(url, opts) as Response;

            const contentType = response.headers.get('content-type');

            clearTimeout(cancelTimeout);

            this.dispatchEvent(
                new FetchEvent(FetchEventNames['fetch-after'], {
                    ...opts,
                    payload,
                    url,
                    state: this.#_state,
                    response: response.clone()
                })
            );

            onAfterRequest && onAfterRequest(response.clone(), opts);

            let data: unknown;
            let { status, statusText } = response;

            if (contentType) {
                if (/text|xml|html|form-urlencoded/.test(contentType!)) {

                    data = await response.text() as any;
                }
                else if (/json/.test(contentType!)) {

                    data = await response.json();
                }
                else if (/audio|video|font|binary|application/.test(contentType!)) {

                    data = await response.blob();
                }
                else if (/form-data/.test(contentType!)) {

                    data = await response.formData();
                }
                else {

                    data = await response[type]() as Res;
                }
            }
            else {

                data = await response.text();
            }

            if (response.ok) {

                this.dispatchEvent(

                    new FetchEvent(FetchEventNames['fetch-response'], {
                        ...opts,
                        payload,
                        url,
                        state: this.#_state,
                        response,
                        data
                    })
                );

                return data as Res;
            }

            error = new FetchError(statusText);
            error.data = data as any;
            error.status = status;
            error.method = method;
            error.path = path;
            error.aborted = options.controller.signal.aborted;

            throw error;
        }
        catch (e: any) {

            if (e instanceof FetchError === false) {

                error = new FetchError(e.message);
            }
            else {

                error = e;
            }

            let statusCode = error.status || 999;
            const name = e.name;
            const message = (
                options.controller.signal.reason ||
                e.message ||
                name
            );

            if (options.controller.signal.aborted) {

                statusCode = 499;
                error.message = message
            }

            error.status = statusCode;
            error.data = error.data || { message };
            error.method = method;
            error.path = path;
            error.aborted = options.controller.signal.aborted;
        }


        if (options.controller.signal.aborted) {

            this.dispatchEvent(
                new FetchEvent(FetchEventNames['fetch-abort'], {
                    ...opts,
                    payload,
                    url,
                    state: this.#_state
                })
            );
        }
        else {

            this.dispatchEvent(
                new FetchEvent(FetchEventNames['fetch-error'], {
                    ...opts,
                    payload,
                    url,
                    state: this.#_state,
                    error
                })
            );
        }

        onError && onError(error);

        throw error;
    }

    get headers() {

        const method = Object.keys(this.#_methodHeaders).reduce(
            (acc, key) => {

                const headers = this.#_methodHeaders[key as keyof HttpMethodOpts<HeaderObj<InstanceHeaders>>];

                if (headers) {

                    acc[key] = { ...headers };
                }

                return acc;
            },
            {} as any
        );

        return {
            default: {
                ...this.#_headers
            },
            ...method
        } as {
            readonly default: Readonly<HeaderObj<InstanceHeaders>>,
            readonly get?: Readonly<HeaderObj<InstanceHeaders>>,
            readonly post?: Readonly<HeaderObj<InstanceHeaders>>,
            readonly put?: Readonly<HeaderObj<InstanceHeaders>>,
            readonly delete?: Readonly<HeaderObj<InstanceHeaders>>,
            readonly options?: Readonly<HeaderObj<InstanceHeaders>>,
            readonly patch?: Readonly<HeaderObj<InstanceHeaders>>,
        }
    }

    /**
     * Makes a request
     * @param method
     * @param path
     * @param options
     */
    request <Res = any, Data = any>(
        method: HttpMethods,
        path: string,
        options: (
            FetchFactoryRequestOptions<InstanceHeaders> &
            ({ payload: Data | null } | {})
         ) = { payload: null }
    ): AbortablePromise<Res> {


        // https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
        const controller = new AbortController();

        let cancelTimeout!: NodeJS.Timeout;
        const timeout = options.timeout || this.#_options.timeout;

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

        }) as AbortablePromise<Res>;


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
     * @param path
     * @param headers
     * @returns
     */
    options <Res = any>(path: string, options: FetchFactoryRequestOptions<InstanceHeaders> = {}) {

        return this.request <Res, null>('options', path, options);
    }

    /**
     * Makes a get request
     * @param path
     * @param headers
     * @returns
     */
    get <Res = any>(path: string, options: FetchFactoryRequestOptions<InstanceHeaders> = {}) {

        return this.request <Res, null>('get', path, options);
    }

    /**
     * Makes a delete request
     * @param path
     * @param headers
     * @returns
     */
    delete <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchFactoryRequestOptions<InstanceHeaders> = {}) {

        return this.request <Res, Data>('delete', path, { ...options, payload });
    }

    /**
     * Makes a post request
     * @param path
     * @param headers
     * @returns
     */
    post <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchFactoryRequestOptions<InstanceHeaders> = {}) {

        return this.request <Res, Data>('post', path, { ...options, payload });
    }

    /**
     * Makes a put request
     * @param path
     * @param headers
     * @returns
     */
    put <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchFactoryRequestOptions<InstanceHeaders> = {}) {

        return this.request <Res, Data>('put', path, { ...options, payload });
    }

    /**
     * Makes a patch request
     * @param path
     * @param headers
     * @returns
     */
    patch <Res = any, Data = any>(path: string, payload: Data | null = null, options: FetchFactoryRequestOptions<InstanceHeaders> = {}) {

        return this.request <Res, Data>('patch', path, { ...options, payload });
    }

    /**
     * Set an object of headers
     * @param headers
     */
    addHeader(name: keyof InstanceHeaders, value: string): void
    addHeader(name: string, value: string): void
    addHeader(headers: HeaderObj<InstanceHeaders>): void
    addHeader(headers: unknown, value?: string) {

        assert(
            (typeof headers === 'string' && !!value) ||
            typeof headers === 'object',
            'addHeader requires a string and value or an object'
        );

        if (typeof headers === 'string') {

            headers = headers.toLowerCase();
        }

        let updated = {
            ...this.#_headers
        } as FetchHeaders;

        if (typeof headers === 'string') {

            updated[headers as keyof FetchHeaders] = value as FetchHeaders[keyof FetchHeaders];
        }
        else {

            Object
                .keys(headers as object)
                .forEach(
                    (name) => {

                        const key = name.toLowerCase() as keyof FetchHeaders;

                        updated[key] = (headers as FetchHeaders)[key];
                    }
                );
        }

        this.#_validateHeaders(updated as never);

        this.#_headers = updated as HeaderObj<InstanceHeaders>;

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-header-add'], {
                state: this.#_state,
                data: headers
            })
        );
    }

    /**
     * Remove headers by reference, array of names, or single name
     * @param headers
     */
    rmHeader (headers: keyof InstanceHeaders): void
    rmHeader (headers: (keyof InstanceHeaders)[]): void
    rmHeader (headers: string): void
    rmHeader (headers: string[]): void
    rmHeader (headers: unknown) {

        if (!headers) {
            return;
        }

        if (typeof headers === 'string') {

            delete this.#_headers[headers];
        }

        let _names = headers as (keyof HeaderObj<InstanceHeaders>)[];

        if (!Array.isArray(headers)) {

            _names = Object.keys(headers);
        }

        for (const name of _names) {
            delete this.#_headers[name];
        }

        this.#_validateHeaders(this.#_headers);

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-header-remove'], {
                state: this.#_state,
                data: headers
            })
        );
    }

    /**
     * Checks if header is set
     * @param name
     * @returns
     */
    hasHeader(name: (keyof HeaderObj<InstanceHeaders>)) {

        return this.#_headers.hasOwnProperty(name);
    }

    /**
     * Merges a passed object into the `FetchFactory` instance state
     * @param conf
     */
    setState<N extends keyof State>(name: N, value: State[N]): void
    setState(conf: Partial<State>): void
    setState(conf: unknown, value?: unknown) {

        assert(
            typeof conf === 'object' || typeof conf === 'string',
            'setState requires an object or string'
        );

        const updated = {
            ...this.#_state
        };

        if (typeof conf === 'string') {

            assert(
                typeof value !== 'undefined',
                'setState requires a value when setting a single property'
            );

            updated[conf as keyof State] = value as State[keyof State];
        }
        else {

            Object
                .keys(conf as object)
                .forEach(
                    (name) => {

                        const key = name as keyof State;

                        updated[key] = (conf as State)[key];
                    }
                );
        }

        this.#_validateState(updated);

        this.#_state = updated as State;

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

        this.#_state = {} as State;

        this.#_validateState(this.#_state);

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-state-reset'], {
                state: this.#_state,
            })
        );
    }

    /**
     * Returns the `FetchFactory` instance state.
     */
    getState() {

        return this.#_state;
    }

    /**
     * Changes the base URL for this fetch instance
     * @param url
     */
    changeBaseUrl(url: string) {

        this.#_baseUrl = new URL(url);

        this.dispatchEvent(
            new FetchEvent(FetchEventNames['fetch-url-change'], {
                state: this.#_state,
                data: url
            })
        );
    }

    /**
     * Listen for events on this FetchFactory instance
     * @param ev
     * @param listener
     * @param once
     */
    on(
        ev: FetchEventName | '*',
        listener: (
            e: (
                FetchEvent<State, InstanceHeaders>
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
     * @param ev
     * @param listener
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
