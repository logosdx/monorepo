import { FetchError } from './helpers.ts';

export type _InternalHttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH';
export type HttpMethods = _InternalHttpMethods | string;

export type HttpMethodOpts<T> = Partial<Record<_InternalHttpMethods, T>>;

export type RawRequestOptions = Omit<RequestInit, 'headers'>
export type DictOrT<T> = Record<string, string> & Partial<T>;
export type MethodHeaders<T> = HttpMethodOpts<DictOrT<T>>;

declare module './factory.ts' {
    export namespace FetchFactory {

        export type Type = 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text';

        /**
         * Override this interface with the headers you intend
         * to use and set throughout your app. These are the
         * universal headers that will be set on all requests.
         */
        export interface InstanceHeaders {
            Authorization?: string;
            'Content-Type'?: string;
        }

        export interface InstanceParams {
        }

        /**
         * Headers helper type that can be used to set headers
         */
        export type Headers<T = InstanceHeaders> = DictOrT<T>;

        /**
         * Params helper type that can be used to set URL parameters
         * on requests
         */
        export type Params<T = InstanceParams> = DictOrT<T>;


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
            (response: Response): Type | Symbol
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
            onError?: (err: FetchError) => void | Promise<void> | undefined

            /**
             * Called before the fetch request is made
             */
            onBeforeReq?: (opts: FetchFactory.RequestOpts) => void | Promise<void> | undefined

            /**
             * Called after the fetch request is made. The response
             * object is cloned before it is passed to this function.
             */
            onAfterReq?: (response: Response, opts: FetchFactory.RequestOpts) => void | Promise<void> | undefined
        };


        export type RequestOpts<T = InstanceHeaders, P = InstanceParams> = RawRequestOptions & {

            /**
             * The abort controller to be used to abort the request
             */
            controller: AbortController,
            headers?: Headers<T> | undefined,
            params?: Params<P> | undefined,

            /**
             * The headers of the request
             */
            timeout?: number | undefined

            /**
             * The type of response expected from the server
             */
            determineType?: DetermineTypeFn | undefined,

            /**
             * The format to be used to format headers before they are sent
             */
            formatHeaders?: boolean | 'lowercase' | 'uppercase' | FormatHeadersFn | undefined
        };

        export type Options<
            H = Headers,
            P = Params,
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
                defaultType?: Type | undefined,

                /**
                 * The headers to be set on all requests
                 */
                headers?: DictOrT<H> | undefined,

                /**
                 * The headers to be set on requests of a specific method
                 * @example
                 * {
                 *     GET: { 'content-type': 'application/json' },
                 *     POST: { 'content-type': 'application/x-www-form-urlencoded'
                 * }
                 */
                methodHeaders?: MethodHeaders<H> | undefined,

                /**
                 * URL parameters to be set on all requests
                 */
                params?: DictOrT<P> | undefined,

                /**
                 * URL parameters to be set on requests of a specific method
                 */
                methodParams?: HttpMethodOpts<P> | undefined,

                // Applies to requests of a specific method
                /**
                 *
                 * @param opts
                 * @param state
                 * @returns
                 */
                modifyOptions?: ((opts: RequestOpts<H, P>, state: S) => RequestOpts<H>) | undefined
                modifyMethodOptions?: HttpMethodOpts<Options<H, P, S>['modifyOptions']> | undefined,

                /**
                 * The timeout for all requests in milliseconds
                 */
                timeout?: number | undefined,

                /**
                 * Validators for when setting headers and state
                 */
                validate?: {
                    headers?: ((headers: Headers<H>, method?: _InternalHttpMethods) => void) | undefined,
                    params?: ((params: Params<P>, method?: _InternalHttpMethods) => void) | undefined,
                    state?: ((state: S) => void) | undefined,

                    perRequest?: {
                        /**
                         * Whether to validate the headers before the request is made
                         */
                        headers?: boolean | undefined,

                        /**
                         * Whether to validate the params before the request is made
                         */
                        params?: boolean | undefined,
                    } | undefined
                },

                /**
                 * The type of response expected from the server
                 */
                determineType?: DetermineTypeFn | undefined,

                /**
                 * The format to be used to format headers before they are sent
                 */
                formatHeaders?: false | 'lowercase' | 'uppercase' | FormatHeadersFn | undefined
            }
        );

        export interface AbortablePromise<T> extends Promise<T> {

            isFinished: boolean
            isAborted: boolean
            abort(reason?: string): void | undefined
        }

        /**
         * Options used when making a fetch request
         */
        export type CallOptions<H = InstanceHeaders, P = InstanceParams> = (
            Lifecycle &
            Omit<RequestOpts, 'body' | 'method' | 'controller'> &
            {
                headers?: DictOrT<H> | undefined,
                params?: DictOrT<P> | undefined,
            }
        );
    }
}
