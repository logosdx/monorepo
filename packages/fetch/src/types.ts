import { type MaybePromise } from '@logosdx/utils';
import { FetchError } from './helpers.ts';

export type _InternalHttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH';
export type HttpMethods = _InternalHttpMethods | string;

export type HttpMethodOpts<T> = Partial<Record<_InternalHttpMethods, T>>;

export type RawRequestOptions = Omit<RequestInit, 'headers'>
export type DictOrT<T> = Record<string, string> & Partial<T>;
export type MethodHeaders<T> = HttpMethodOpts<DictOrT<T>>;

// Add RetryConfig type
export interface RetryConfig {

    /**
     * Maximum number of retry attempts.
     *
     * @default 3
     */
    maxAttempts?: number | undefined;

    /**
     * Base delay between retries in ms.
     *
     * @default 1000
     */
    baseDelay?: number;

    /**
     * Maximum delay between retries in ms
     *
     * @default 10000
     */
    maxDelay?: number | undefined;

    /**
     * Whether to use exponential backoff
     *
     * @default true
     */
    useExponentialBackoff?: boolean | undefined;

    /**
     * Status codes that should trigger a retry
     *
     * @default [408, 429, 500, 502, 503, 504]
     */
    retryableStatusCodes?: number[] | undefined;

    /**
     * Custom function to determine if a request should be retried.
     * If the function returns a number, it will be used as the delay
     * in milliseconds before the next retry.
     *
     * @default (error, attempt) => attempt < maxAttempts
     */
    shouldRetry?: (error: FetchError, attempt: number) => MaybePromise<boolean | number> | undefined;
}

declare module './engine.ts' {
    export namespace FetchEngine {

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

        /**
         * Override this interface with the params you intend
         * to use and set throughout your app. These are the
         * universal params that will be set on all requests.
         */
        export interface InstanceParams {
        }

        /**
         * Override this interface with the state you intend
         * to use and set throughout your app. These are the
         * universal state that will be set on all requests.
         */
        export interface InstanceState {
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

        /**
         * Function type for modifying request options before they are sent.
         * Used by modifyOptions and modifyMethodOptions configuration.
         */
        export type ModifyOptionsFn<H = InstanceHeaders, P = InstanceParams, S = InstanceState> = (opts: RequestOpts<H, P>, state: S) => RequestOpts<H>;

        export type HeaderKeys = keyof Headers;

        /**
         * If you don't want FetchEngine to guess your content type,
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
            onError?: (err: FetchError<any, any>) => void | Promise<void> | undefined

            /**
             * Called before the fetch request is made
             */
            onBeforeReq?: (opts: FetchEngine.RequestOpts<any, any>) => void | Promise<void> | undefined

            /**
             * Called after the fetch request is made. The response
             * object is cloned before it is passed to this function.
             */
            onAfterReq?: (response: Response, opts: FetchEngine.RequestOpts<any, any>) => void | Promise<void> | undefined
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

            /**
             * The retry configuration for the fetch request. If false, or undefined,
             * no retries will be made.
             */
            retryConfig?: RetryConfig | false | undefined
        };

        export type Options<
            H = Headers,
            P = Params,
            S = InstanceState,
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
                 * Function that can be used to change the options in a specific
                 * way before they are used to make a request. The passed options
                 * are mutable objects. The returned object will be used instead
                 * of the original.
                 *
                 * @example
                 *
                 * const modifyOptions: ModifyOptionsFn = (opts, state) => {
                 *     return opts;
                 * }
                 */
                modifyOptions?: ModifyOptionsFn<H, P, S> | undefined

                /**
                 * Object that can be used to modify the options for requests of a specific method
                 * @example
                 *
                 * const modifyMethodOptions: ModifyMethodOptions = {
                 *     GET: (opts, state) => {
                 *         return opts;
                 *     },
                 *     POST: (opts, state) => {
                 *         return opts;
                 *     }
                 * }
                 */
                modifyMethodOptions?: HttpMethodOpts<ModifyOptionsFn<H, P, S>> | undefined,

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
                abortController?: AbortController | undefined,
            }
        );
    }
}
