/**
 * Engine Config Types
 *
 * This file defines the Config interface independently of the FetchEngine class
 * to avoid circular dependencies. The FetchEngine.Config namespace type in
 * types.ts is defined to match this interface.
 */

import type {
    _InternalHttpMethods,
    HttpMethodOpts,
    RetryConfig,
    DeduplicationConfig,
    CacheConfig,
    RateLimitConfig,
    DictAndT,
    MethodHeaders,
} from '../types.ts';

import type { FetchError } from '../helpers/fetch-error.ts';


/**
 * Response type that can be returned from the server.
 */
export type EngineType = 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text';


/**
 * Base headers interface that users can augment.
 */
export interface InstanceHeaders {

    Authorization?: string;
    'Content-Type'?: string;
    Accept?: string;
    'Accept-Language'?: string;
}


/**
 * Base params interface that users can augment.
 */
export interface InstanceParams {}


/**
 * Base state interface that users can augment.
 */
export interface InstanceState {}


/**
 * Result from determineType function.
 */
export interface DetermineTypeResult {

    type: Exclude<EngineType, 'formData'>;
    isJson: boolean;
}


/**
 * Function type for determining response body type.
 */
export interface DetermineTypeFn {

    (response: Response): DetermineTypeResult;
}


/**
 * Base request configuration shared between per-request and instance-level config.
 *
 * Extends native fetch RequestInit with typed headers/params and timeout settings.
 * This is the foundation for both CallConfig and EngineConfig.
 *
 * @template H - Headers type
 * @template P - Params type
 */
export interface RequestConfig<H = InstanceHeaders, P = InstanceParams>
    extends Omit<RequestInit, 'headers' | 'signal'> {

    /** Request headers (merged with instance defaults) */
    headers?: DictAndT<H> | undefined;

    /** URL parameters (merged with instance defaults) */
    params?: DictAndT<P> | undefined;

    /** AbortSignal for request cancellation */
    signal?: AbortSignal | undefined;

    /** Total timeout for entire request lifecycle including retries (ms) */
    totalTimeout?: number | undefined;

    /** Per-attempt timeout (ms) - each retry gets fresh timeout */
    attemptTimeout?: number | undefined;

    /** Function to determine response body type based on response */
    determineType?: DetermineTypeFn | undefined;

    /** Retry configuration */
    retry?: RetryConfig | boolean | undefined;
}


/**
 * Per-request configuration passed to HTTP methods (get, post, etc).
 *
 * Extends RequestConfig with per-request lifecycle hooks and abort controller.
 *
 * @template H - Headers type
 * @template P - Params type
 */
export interface CallConfig<H = InstanceHeaders, P = InstanceParams>
    extends RequestConfig<H, P>, EngineLifecycle<H, P> {

    /** AbortController for manual request cancellation */
    abortController?: AbortController | undefined;

    /**
     * Return raw Response without body parsing.
     *
     * When true, the response `data` will be the raw `Response` object
     * with an unconsumed body stream. Cache and deduplication are skipped
     * because each caller needs their own readable stream.
     *
     * Rate limiting and lifecycle events (before-request, after-request,
     * response) still fire normally.
     */
    stream?: boolean | undefined;

    /**
     * Override the auto-generated request ID for this request.
     *
     * When provided, this value is used instead of `generateRequestId()`
     * or the default `generateId()`. Useful for propagating an external
     * trace ID from an upstream service or user-defined correlation ID.
     *
     * @example
     * ```typescript
     * await api.get('/orders', {
     *     requestId: incomingTraceId
     * });
     * ```
     */
    requestId?: string | undefined;

    /** @deprecated Use totalTimeout instead */
    timeout?: number | undefined;
}


/**
 * Request config passed to modifyConfig and callbacks.
 *
 * This is what callbacks receive - includes the controller that was created
 * for the request.
 */
export interface EngineRequestConfig<H = InstanceHeaders, P = InstanceParams>
    extends RequestConfig<H, P> {

    /** The AbortController created for this request */
    controller: AbortController;
}


/**
 * Function type for modifying request config before they are sent.
 */
export type ModifyConfigFn<H = InstanceHeaders, P = InstanceParams, S = InstanceState> =
    (opts: EngineRequestConfig<H, P>, state: S) => EngineRequestConfig<H>;


/**
 * Lifecycle hooks for requests.
 */
export interface EngineLifecycle<H = InstanceHeaders, P = InstanceParams> {

    onError?: ((err: FetchError<any, any>) => void | Promise<void>) | undefined;
    onBeforeReq?: ((opts: EngineRequestConfig<H, P>) => void | Promise<void>) | undefined;
    onAfterReq?: ((response: Response, opts: EngineRequestConfig<H, P>) => void | Promise<void>) | undefined;
}


/**
 * Validation configuration for headers, params, and state.
 */
export interface ValidateConfig<H, P, S> {

    headers?: ((headers: DictAndT<H>, method?: _InternalHttpMethods) => void) | undefined;
    params?: ((params: DictAndT<P>, method?: _InternalHttpMethods) => void) | undefined;
    state?: ((state: S) => void) | undefined;

    perRequest?: {
        headers?: boolean | undefined;
        params?: boolean | undefined;
    } | undefined;
}


/**
 * Full configuration options for FetchEngine.
 *
 * This is the primary configuration interface. It's defined here
 * independently of the FetchEngine class to avoid circular dependencies.
 *
 * Extends native fetch RequestInit to allow instance-level defaults for
 * options like `credentials`, `mode`, `cache`, `redirect`, etc.
 *
 * @template H - Headers type
 * @template P - Params type
 * @template S - State type
 */
export interface EngineConfig<
    H = InstanceHeaders,
    P = InstanceParams,
    S = InstanceState
> extends Omit<RequestInit, 'headers' | 'signal' | 'body' | 'method'>, EngineLifecycle<H, P> {

    /**
     * The base URL for all requests.
     */
    baseUrl: string;

    /**
     * The default type of response expected from the server.
     */
    defaultType?: EngineType | undefined;

    /**
     * The headers to be set on all requests.
     */
    headers?: DictAndT<H> | undefined;

    /**
     * The headers to be set on requests of a specific method.
     */
    methodHeaders?: MethodHeaders<H> | undefined;

    /**
     * URL parameters to be set on all requests.
     */
    params?: DictAndT<P> | undefined;

    /**
     * URL parameters to be set on requests of a specific method.
     */
    methodParams?: HttpMethodOpts<Partial<DictAndT<P>>> | undefined;

    /**
     * Function that can be used to change the config before a request.
     */
    modifyConfig?: ModifyConfigFn<H, P, S> | undefined;

    /**
     * Object for modifying config for requests of a specific method.
     */
    modifyMethodConfig?: HttpMethodOpts<ModifyConfigFn<H, P, S>> | undefined;

    /**
     * Validators for headers, params, and state.
     */
    validate?: ValidateConfig<H, P, S>;

    /**
     * Optional name for this FetchEngine instance.
     */
    name?: string | undefined;

    /**
     * Spy function that receives all event emissions.
     */
    spy?: ((action: {
        event: string | RegExp | '*',
        fn: 'on' | 'once' | 'off' | 'emit' | 'cleanup',
        data?: unknown,
        listener?: Function | null,
        context: any
    }) => void) | undefined;

    /**
     * Deduplication policy configuration.
     */
    dedupePolicy?: boolean | DeduplicationConfig<S, H, P> | undefined;

    /**
     * Cache policy configuration.
     */
    cachePolicy?: boolean | CacheConfig<S, H, P> | undefined;

    /**
     * Rate limit policy configuration.
     */
    rateLimitPolicy?: boolean | RateLimitConfig<S, H, P> | undefined;

    /**
     * Custom function to generate request IDs for tracing.
     * When omitted, uses `generateId` from `@logosdx/utils`.
     */
    generateRequestId?: (() => string) | undefined;

    /**
     * Header name for sending the request ID with every request.
     *
     * When set, each outgoing request includes this header with the
     * generated `requestId` value, enabling end-to-end distributed tracing.
     *
     * @example
     * ```typescript
     * const api = new FetchEngine({
     *     baseUrl: 'https://api.example.com',
     *     requestIdHeader: 'X-Request-Id'
     * });
     * ```
     */
    requestIdHeader?: string | undefined;

    // From RequestOpts
    totalTimeout?: number | undefined;
    attemptTimeout?: number | undefined;
    determineType?: DetermineTypeFn | undefined;
    retry?: RetryConfig | boolean | undefined;
}
