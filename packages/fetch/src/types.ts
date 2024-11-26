import { FetchError } from './helpers.ts';

export type _InternalHttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH';
export type HttpMethods = _InternalHttpMethods | string;

export type HttpMethodOpts<T> = Partial<Record<_InternalHttpMethods, T>>;

export type RawRequestOptions = Omit<RequestInit, 'headers'>
export type HeaderObj<T> = Record<string, string> & Partial<T>;
export type MethodHeaders<T> = HttpMethodOpts<HeaderObj<T>>;

export namespace LogosUiFetch {

    export type Type = 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text';

    /**
     * Override this interface with the headers you intend
     * to use and set throughout your app. These are the
     * universal headers that will be set on all requests.
     */
    export interface InstanceHeaders {
        Authorization?: string;
        'Content-Type'?: string;
    };

    /**
     * Headers helper type that can be used to set headers
     */
    export type Headers<T = InstanceHeaders> = HeaderObj<T>;


    export type HeaderKeys = keyof Headers;

    /**
     * If you don't want FetchFactory to guess your content type,
     * you can set it explicitly here. You should return the name
     * of the function that will be used to parse the response body.
     *
     * @example
     *
     * const determineType: DetermineTypeFn = (response) => {
     *
     *     if (response.headers.get('content-type') === 'application/json') {
     *         return 'json';
     *     }
     * }
     *
     */
    export interface DetermineTypeFn {
        (response: Response): Type;
    }

    /**
     * Function that can be used to format headers before they are
     * sent to the server. This can be used to format headers in
     * a specific way before they are sent to the server.
     *
     * @example
     *
     * const formatHeaders: FormatHeadersFn = (headers) => {
     *
     *     return Object.keys(headers).reduce((acc, key) => {
     *
     *         acc[key.toLowerCase()] = headers[key];
     *         return acc;
     *     }, {});
     * }
     *
     */
    export interface FormatHeadersFn {
        (headers: Headers): Headers;
    }

    /**
     * Lifecycle hooks that can be used to handle various
     * events during the fetch request lifecycle.
     */
    export type Lifecycle = {
        /**
         * Called when the fetch request errors
         */
        onError?: (err: FetchError) => void | Promise<void>

        /**
         * Called before the fetch request is made
         */
        onBeforeReq?: (opts: LogosUiFetch.RequestOpts) => void | Promise<void>

        /**
         * Called after the fetch request is made. The response
         * object is cloned before it is passed to this function.
         */
        onAfterReq?: (response: Response, opts: LogosUiFetch.RequestOpts) => void | Promise<void>
    };


    export type RequestOpts<T = InstanceHeaders> = RawRequestOptions & {

        /**
         * The abort controller to be used to abort the request
         */
        controller: AbortController,
        headers?: Headers<T>,

        /**
         * The headers of the request
         */
        timeout?: number

        /**
         * The type of response expected from the server
         */
        determineType?: DetermineTypeFn,

        /**
         * The format to be used to format headers before they are sent
         */
        formatHeaders?: boolean | 'lowercase' | 'uppercase' | FormatHeadersFn
    };

    export type Options<
        H = Headers,
        S = {},
    > = (

        Omit<
            RequestOpts<H>,
            'method' | 'body' | 'integrity' | 'controller'
        > &

        {
            /**
             * The base URL for all requests
             */
            baseUrl: string,

            /**
             * The default type of response expected from the server.
             * This will be used to determine how to parse the
             * response from the server when content-type headers
             * are not present or fail to do so.
             */
            defaultType?: Type,

            /**
             * The headers to be set on all requests
             */
            headers?: HeaderObj<H>,

            /**
             * The headers to be set on requests of a specific method
             * @example
             * {
             *     GET: { 'content-type': 'application/json' },
             *     POST: { 'content-type': 'application/x-www-form-urlencoded'
             * }
             */
            methodHeaders?: MethodHeaders<H>,

            // Applies to requests of a specific method
            /**
             *
             * @param opts
             * @param state
             * @returns
             */
            modifyOptions?: (opts: RequestOpts<H>, state: S) => RequestOpts<H>
            modifyMethodOptions?: HttpMethodOpts<
                Options<
                    H,
                    S
                >['modifyOptions']
            >,

            /**
             * The timeout for all requests in milliseconds
             */
            timeout?: number,

            /**
             * Validators for when setting headers and state
             */
            validate?: {
                headers?: (headers: Headers<H>, method?: _InternalHttpMethods) => void
                state?: (state: S) => void

                perRequest?: {
                    /**
                     * Whether to validate the headers before the request is made
                     */
                    headers?: boolean
                }
            },

            /**
             * The type of response expected from the server
             */
            determineType?: DetermineTypeFn,

            /**
             * The format to be used to format headers before they are sent
             */
            formatHeaders?: false | 'lowercase' | 'uppercase' | FormatHeadersFn
        }
    );

    export interface AbortablePromise<T> extends Promise<T> {

        isFinished: boolean
        isAborted: boolean
        abort(reason?: string): void
    }

    /**
     * Options used when making a fetch request
     */
    export type CallOptions<H = InstanceHeaders> = (
        Lifecycle &
        Omit<RequestOpts, 'body' | 'method' | 'controller'> &
        { headers?: HeaderObj<H>}
    );

}
