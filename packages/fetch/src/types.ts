import { type MaybePromise } from '@logosdx/utils';
import { FetchError } from './helpers.ts';
import { type FetchEngine } from './engine.ts';

export type _InternalHttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH';
export type HttpMethods = _InternalHttpMethods | string;

export type HttpMethodOpts<T> = Partial<Record<_InternalHttpMethods, T>>;

export type RawRequestOptions = Omit<RequestInit, 'headers'>
export type DictOrT<T> = Record<string, string> & Partial<T>;
export type MethodHeaders<T> = HttpMethodOpts<DictOrT<T>>;

/**
 * Configuration object used for a fetch request, combining instance-level
 * and request-specific settings.
 *
 * Provides complete context about how a request was configured, including
 * retry settings, timeout, headers, and other options that influenced
 * the request behavior.
 *
 * @example
 * // Configuration contains merged settings from instance and request
 * const config: FetchConfig = {
 *     baseUrl: 'https://api.example.com',
 *     timeout: 5000,
 *     retry: { maxAttempts: 3 },
 *     headers: { 'Authorization': 'Bearer token' }
 * };
 */
export interface FetchConfig<H = FetchEngine.InstanceHeaders, P = FetchEngine.InstanceParams> {
    baseUrl?: string;
    timeout?: number | undefined;
    headers?: H;
    params?: P;
    retry?: RetryConfig | false | undefined;
    method?: string;
    determineType?: any;
}

/**
 * Enhanced response object that provides comprehensive information about
 * a fetch request and its result.
 *
 * Replaces the previous pattern of returning just parsed data with a rich
 * response object containing the data, metadata, and request context.
 * Designed to be easily destructurable while providing full access to
 * HTTP response details.
 *
 * @template T - Type of the parsed response data
 * @template H - Type of request headers used in the config
 * @template P - Type of request params used in the config
 * @template RH - Type of response headers received from the server
 *
 * @example
 * // Destructure just the data (backward compatibility pattern)
 * const { data: user } = await api.get<User>('/users/123');
 *
 * @example
 * // Access full response details
 * const response = await api.get<User[]>('/users');
 * console.log('Status:', response.status);
 * console.log('Headers:', response.headers.get('content-type'));
 * console.log('Data:', response.data);
 * console.log('Request config:', response.config);
 *
 * @example
 * // Use with error handling
 * const [response, err] = await attempt(() => api.get('/users'));
 * if (err) {
 *     console.error('Request failed:', err);
 *     return;
 * }
 *
 * if (response.status === 200) {
 *     console.log('Success:', response.data);
 * }
 */
export interface FetchResponse<
    T = any,
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    RH = FetchEngine.InstanceResponseHeaders
> {
    /**
     * Parsed response body data.
     *
     * The response content parsed according to the content-type header
     * or the configured determineType function. For JSON responses,
     * this will be the parsed JavaScript object. For text responses,
     * this will be a string.
     */
    data: T;

    /**
     * HTTP response headers received from the server.
     *
     * A plain object containing the response headers with type-safe access
     * to headers you've defined in the InstanceResponseHeaders interface.
     * All header names are preserved as-is from the server response.
     *
     * @example
     * // Define your response headers
     * declare module '@logosdx/fetch' {
     *     namespace FetchEngine {
     *         interface InstanceResponseHeaders {
     *             'x-rate-limit': string;
     *             'x-request-id': string;
     *         }
     *     }
     * }
     *
     * // Now TypeScript knows about your response headers
     * const response = await api.get('/users');
     * const rateLimit = response.headers['x-rate-limit'];
     * const requestId = response.headers['x-request-id'];
     */
    headers: Partial<RH>;

    /**
     * HTTP status code.
     *
     * The numeric HTTP status code (200, 404, 500, etc.) returned
     * by the server. Useful for conditional logic based on response
     * status without needing to catch errors.
     */
    status: number;

    /**
     * Original request object.
     *
     * The Request object that was sent to the server, containing
     * the final URL, headers, method, and body after all modifications
     * and merging of instance and request-specific options.
     */
    request: Request;

    /**
     * Configuration used for the request.
     *
     * The merged configuration object that was used to make this request,
     * including instance-level settings and request-specific overrides.
     * Useful for debugging and understanding how the request was configured.
     */
    config: FetchConfig<H, P>;
}

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
         * Event data payload for FetchEngine events
         */
        export interface EventData<S = InstanceState, H = InstanceHeaders> {
            state: S;
            url?: string | undefined;
            method?: HttpMethods | undefined;
            headers?: H | undefined;
            params?: InstanceParams | undefined;
            error?: FetchError<any, H> | undefined;
            response?: Response | undefined;
            data?: unknown;
            payload?: unknown;
            attempt?: number | undefined;
            nextAttempt?: number | undefined;
            delay?: number | undefined;
            step?: 'fetch' | 'parse' | 'response' | undefined;
            status?: number | undefined;
            path?: string | undefined;
            aborted?: boolean | undefined;
        }

        /**
         * Event map for ObserverEngine - maps event names to their data types
         */
        export interface EventMap<S = InstanceState, H = InstanceHeaders> {
            'fetch-before': EventData<S, H>;
            'fetch-after': EventData<S, H>;
            'fetch-abort': EventData<S, H>;
            'fetch-error': EventData<S, H>;
            'fetch-response': EventData<S, H>;
            'fetch-header-add': EventData<S, H>;
            'fetch-header-remove': EventData<S, H>;
            'fetch-param-add': EventData<S, H>;
            'fetch-param-remove': EventData<S, H>;
            'fetch-state-set': EventData<S, H>;
            'fetch-state-reset': EventData<S, H>;
            'fetch-url-change': EventData<S, H>;
            'fetch-modify-options-change': EventData<S, H>;
            'fetch-modify-method-options-change': EventData<S, H>;
            'fetch-retry': EventData<S, H>;
        }

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
         * Override this interface with the response headers you expect
         * to receive from your API. These are the headers that will be
         * returned in the FetchResponse object.
         */
        export interface InstanceResponseHeaders extends Record<string, string> {
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
         * Response headers helper type that represents headers received
         * from the server in API responses
         */
        export type ResponseHeaders<T = InstanceResponseHeaders> = DictOrT<T>;

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
             * The retry configuration for the fetch request. If false, or undefined,
             * no retries will be made.
             */
            retry?: RetryConfig | boolean | undefined
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

                /**
                 * Optional name for this FetchEngine instance.
                 * Useful for debugging when using multiple instances.
                 */
                name?: string | undefined,

                /**
                 * Spy function that receives all event emissions.
                 * Useful for debugging and logging event flow.
                 *
                 * @example
                 * const api = new FetchEngine({
                 *     baseUrl: 'https://api.example.com',
                 *     spy: ({ event, fn, data }) => {
                 *         console.log(`[${event}] ${fn}:`, data);
                 *     }
                 * });
                 */
                spy?: ((action: {
                    event: keyof EventMap<S, H> | RegExp | '*',
                    fn: 'on' | 'once' | 'off' | 'emit' | 'cleanup',
                    data?: unknown,
                    listener?: Function | null,
                    context: any
                }) => void) | undefined,
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
