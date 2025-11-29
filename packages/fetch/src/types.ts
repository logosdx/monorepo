import { type MaybePromise, type CacheAdapter, RateLimitTokenBucket } from '@logosdx/utils';
import { FetchError } from './helpers.ts';
import { type FetchEngine } from './engine.ts';

export type { CacheAdapter };

export type _InternalHttpMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH';
export type HttpMethods = _InternalHttpMethods | string;

export type HttpMethodOpts<T> = Partial<Record<_InternalHttpMethods, T>>;


/**
 * Match types for route-based configuration rules.
 *
 * These options determine how paths are matched for deduplication/cache rules.
 * Multiple match types can be combined (AND logic), except for `is` which
 * requires an exact match and cannot be combined with others.
 */
export interface MatchTypes {

    /** Exact path match */
    is?: string | undefined;

    /** Path must start with this prefix */
    startsWith?: string | undefined;

    /** Path must end with this suffix */
    endsWith?: string | undefined;

    /** Path must contain this substring */
    includes?: string | undefined;

    /** Path must match this regular expression */
    match?: RegExp | undefined;
}


/**
 * Context object passed to request serializers for key generation.
 *
 * Note: H and P represent the header/param type arguments, but the actual
 * values are DictOrT<H> and DictOrT<P> as stored by FetchEngine.
 */
export interface RequestKeyOptions<S = unknown, H = unknown, P = unknown> {

    /** HTTP method (GET, POST, etc.) */
    method: string;

    /** Request path (original path without base URL) */
    path: string;

    /**
     * Fully-constructed URL including base URL, path, and query parameters.
     *
     * Use `url.pathname + url.search` for cache/dedupe keys to exclude hash
     * while including the full path and query string.
     */
    url: URL;

    /** Request payload/body */
    payload?: unknown | undefined;

    /** Request headers (instance headers merged with method headers) */
    headers?: DictOrT<H> | undefined;

    /** URL parameters (extracted from url.searchParams for flat access) */
    params?: DictOrT<P> | undefined;

    /** Instance state */
    state?: S | undefined;
}


/**
 * Function that generates a unique string key from request context.
 *
 * Used for deduplication and caching to determine request identity.
 */
export type RequestSerializer<S = unknown, H = unknown, P = unknown> =
    (ctx: RequestKeyOptions<S, H, P>) => string;


/**
 * Rule for matching specific routes in deduplication configuration.
 */
export interface DedupeRule<S = unknown, H = unknown, P = unknown> extends MatchTypes {

    /** HTTP methods this rule applies to */
    methods?: _InternalHttpMethods[] | undefined;

    /** Enable/disable deduplication for matching routes */
    enabled?: boolean | undefined;

    /** Override serializer for this rule */
    serializer?: RequestSerializer<S, H, P> | undefined;
}


/**
 * Configuration for request deduplication.
 *
 * Deduplication prevents duplicate concurrent requests by sharing
 * the same in-flight promise among callers with identical request keys.
 */
export interface DeduplicationConfig<S = unknown, H = unknown, P = unknown> {

    /** Enable deduplication globally. Default: true */
    enabled?: boolean | undefined;

    /** HTTP methods to dedupe. Default: ['GET'] */
    methods?: _InternalHttpMethods[] | undefined;

    /** Custom serializer for generating request keys */
    serializer?: RequestSerializer<S, H, P> | undefined;

    /** Pre-serialization check. Return false to bypass deduplication. */
    shouldDedupe?: (ctx: RequestKeyOptions<S, H, P>) => boolean | undefined;

    /** Route-specific rules */
    rules?: DedupeRule[] | undefined;
}

export interface DeduplicationInternalState<S, H, P> {
    methods: Set<string>;
    config: DeduplicationConfig<S, H, P>;
    enabled: boolean;
    serializer: RequestSerializer<S, H, P>;
    rulesCache: Map<string, DedupeRule<S, H, P> | null>;
}


/**
 * Rule for matching specific routes in cache configuration.
 */
export interface CacheRule<S = unknown, H = unknown, P = unknown> extends MatchTypes {

    /** HTTP methods this rule applies to */
    methods?: _InternalHttpMethods[] | undefined;

    /** Enable/disable caching for matching routes */
    enabled?: boolean | undefined;

    /** TTL for cached responses (ms) */
    ttl?: number | undefined;

    /** Time until stale for SWR (ms) */
    staleIn?: number | undefined;

    /** Override serializer for this rule */
    serializer?: RequestSerializer<S, H, P> | undefined;

    /** Skip caching for this rule based on request context */
    skip?: ((ctx: RequestKeyOptions<S, H, P>) => boolean) | undefined;
}

export interface CacheInternalState<S, H, P> {
    methods: Set<string>;
    config: CacheConfig<S, H, P>;
    enabled: boolean;
    ttl: number;
    staleIn: number | undefined;
    serializer: RequestSerializer<S, H, P>;
    rulesCache: Map<string, CacheRule<S, H, P> | null>;
    activeKeys: Set<string>;
    revalidatingKeys: Set<string>;
}


/**
 * Rule for matching specific routes in rate limit configuration.
 */
export interface RateLimitRule<S = unknown, H = unknown, P = unknown> extends MatchTypes {

    /** HTTP methods this rule applies to */
    methods?: _InternalHttpMethods[] | undefined;

    /** Enable/disable rate limiting for matching routes */
    enabled?: boolean | undefined;

    /** Maximum calls allowed within the time window */
    maxCalls?: number | undefined;

    /** Time window in milliseconds */
    windowMs?: number | undefined;

    /** Override serializer for this rule's bucket key generation */
    serializer?: RequestSerializer<S, H, P> | undefined;

    /**
     * Behavior when rate limit is exceeded.
     * - true: Wait for token to become available (default)
     * - false: Reject immediately with RateLimitError
     */
    waitForToken?: boolean | undefined;
}


/**
 * Configuration for request rate limiting.
 *
 * Rate limiting controls the rate of outgoing requests using a token bucket
 * algorithm. Each unique request key (generated by the serializer) gets its
 * own rate limit bucket, allowing per-endpoint or per-user rate limiting.
 */
export interface RateLimitConfig<S = unknown, H = unknown, P = unknown> {

    /** Enable rate limiting globally. Default: true */
    enabled?: boolean | undefined;

    /** HTTP methods to rate limit. Default: all methods */
    methods?: _InternalHttpMethods[] | undefined;

    /** Maximum calls allowed within the time window. Default: 100 */
    maxCalls?: number | undefined;

    /** Time window in milliseconds. Default: 60000 (1 minute) */
    windowMs?: number | undefined;

    /**
     * Custom serializer for generating rate limit bucket keys.
     * Default groups requests by method + pathname.
     *
     * @example
     * // Per-user rate limiting
     * serializer: (ctx) => `user:${ctx.headers?.['X-User-ID'] ?? 'anonymous'}`
     *
     * @example
     * // Global rate limiting (all requests share one bucket)
     * serializer: () => 'global'
     */
    serializer?: RequestSerializer<S, H, P> | undefined;

    /**
     * Pre-check callback. Return false to bypass rate limiting for this request.
     * Useful for whitelisting certain requests or implementing dynamic bypass logic.
     */
    shouldRateLimit?: (ctx: RequestKeyOptions<S, H, P>) => boolean | undefined;

    /**
     * Behavior when rate limit is exceeded.
     * - true: Wait for token to become available (default)
     * - false: Reject immediately with RateLimitError
     */
    waitForToken?: boolean | undefined;

    /**
     * Callback invoked when a request is rate limited.
     * Called before waiting (if waitForToken is true) or rejecting.
     */
    onRateLimit?: ((ctx: RequestKeyOptions<S, H, P>, waitTimeMs: number) => void | Promise<void>) | undefined;

    /** Route-specific rules */
    rules?: RateLimitRule<S, H, P>[] | undefined;
}

export interface RateLimitInternalState<S, H, P> {
    methods: Set<string>;
    config: RateLimitConfig<S, H, P>;
    enabled: boolean;
    maxCalls: number;
    windowMs: number;
    waitForToken: boolean;
    serializer: RequestSerializer<S, H, P>;
    rulesCache: Map<string, RateLimitRule<S, H, P> | null>;
    rateLimiters: Map<string, RateLimitTokenBucket>;
}

/**
 * Configuration for response caching.
 *
 * Caching stores responses and returns cached values for identical
 * requests, reducing API load and improving response times.
 * Supports stale-while-revalidate (SWR) for background refresh.
 */
export interface CacheConfig<S = unknown, H = unknown, P = unknown> {

    /** Enable caching globally. Default: true */
    enabled?: boolean | undefined;

    /** HTTP methods to cache. Default: ['GET'] */
    methods?: _InternalHttpMethods[] | undefined;

    /** Default TTL for cached responses (ms). Default: 60000 */
    ttl?: number | undefined;

    /** Time until stale for SWR (ms). Default: undefined (no SWR) */
    staleIn?: number | undefined;

    /** Custom serializer for generating cache keys */
    serializer?: RequestSerializer<S, H, P> | undefined;

    /** Skip caching based on request context. Return true to skip. */
    skip?: ((ctx: RequestKeyOptions<S, H, P>) => boolean) | undefined;

    /** Route-specific rules */
    rules?: CacheRule[] | undefined;

    /**
     * Custom cache adapter for external storage backends.
     *
     * Enables caching to Redis, IndexedDB, AsyncStorage, localStorage, etc.
     * If omitted, uses in-memory MapCacheAdapter.
     *
     * @example
     * // Redis adapter
     * cachePolicy: {
     *     adapter: new RedisCacheAdapter(redisClient)
     * }
     *
     * @example
     * // localStorage adapter
     * cachePolicy: {
     *     adapter: new LocalStorageCacheAdapter('api-cache')
     * }
     */
    adapter?: CacheAdapter<unknown> | undefined;
}

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
            url?: string | URL | undefined;
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
         * Event data for deduplication events
         */
        export interface DedupeEventData<S = InstanceState, H = InstanceHeaders> extends EventData<S, H> {

            /** The generated deduplication key */
            key: string;

            /** Number of callers waiting on this request (join events only) */
            waitingCount?: number | undefined;
        }

        /**
         * Event data for cache events
         */
        export interface CacheEventData<S = InstanceState, H = InstanceHeaders> extends EventData<S, H> {

            /** The generated cache key */
            key: string;

            /** Whether the cache entry is stale (SWR) */
            isStale?: boolean | undefined;

            /** Time until expiration (ms) */
            expiresIn?: number | undefined;
        }

        /**
         * Event data for rate limit events
         */
        export interface RateLimitEventData<S = InstanceState, H = InstanceHeaders> extends EventData<S, H> {

            /** The rate limit bucket key */
            key: string;

            /** Current tokens available in the bucket */
            currentTokens: number;

            /** Maximum capacity of the bucket */
            capacity: number;

            /** Time to wait before next token is available (ms) */
            waitTimeMs: number;

            /** When the next token will be available */
            nextAvailable: Date;
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
            'fetch-dedupe-start': DedupeEventData<S, H>;
            'fetch-dedupe-join': DedupeEventData<S, H>;
            'fetch-cache-hit': CacheEventData<S, H>;
            'fetch-cache-stale': CacheEventData<S, H>;
            'fetch-cache-miss': CacheEventData<S, H>;
            'fetch-cache-set': CacheEventData<S, H>;
            'fetch-cache-revalidate': CacheEventData<S, H>;
            'fetch-cache-revalidate-error': CacheEventData<S, H>;
            'fetch-ratelimit-wait': RateLimitEventData<S, H>;
            'fetch-ratelimit-reject': RateLimitEventData<S, H>;
            'fetch-ratelimit-acquire': RateLimitEventData<S, H>;
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
            onBeforeReq?: ((opts: FetchEngine.RequestOpts<any, any>) => void | Promise<void>) | undefined

            /**
             * Called after the fetch request is made. The response
             * object is cloned before it is passed to this function.
             */
            onAfterReq?: ((response: Response, opts: FetchEngine.RequestOpts<any, any>) => void | Promise<void>) | undefined
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

                /**
                 * Deduplication policy configuration.
                 *
                 * - `true`: Enable with defaults (GET requests only)
                 * - `false` | omitted: Disabled
                 * - Object: Full configuration
                 *
                 * @example
                 * // Enable with defaults (GET only)
                 * dedupePolicy: true
                 *
                 * @example
                 * // Custom configuration
                 * dedupePolicy: {
                 *     enabled: true,
                 *     methods: ['GET', 'POST'],
                 *     rules: [{ startsWith: '/admin', enabled: false }]
                 * }
                 */
                dedupePolicy?: boolean | DeduplicationConfig<S, H, P> | undefined,

                /**
                 * Cache policy configuration.
                 *
                 * - `true`: Enable with defaults (GET requests, 60s TTL)
                 * - `false` | omitted: Disabled
                 * - Object: Full configuration
                 *
                 * @example
                 * // Enable with defaults (GET only, 60s TTL)
                 * cachePolicy: true
                 *
                 * @example
                 * // Custom configuration with SWR
                 * cachePolicy: {
                 *     enabled: true,
                 *     methods: ['GET'],
                 *     ttl: 300000,     // 5 minutes
                 *     staleIn: 60000,  // Stale after 1 minute
                 *     rules: [
                 *         { startsWith: '/static', ttl: 3600000 },
                 *         { startsWith: '/admin', enabled: false }
                 *     ]
                 * }
                 */
                cachePolicy?: boolean | CacheConfig<S, H, P> | undefined,

                /**
                 * Rate limit policy configuration.
                 *
                 * - `true`: Enable with defaults (100 req/min for all methods)
                 * - `false` | omitted: Disabled
                 * - Object: Full configuration
                 *
                 * @example
                 * // Enable with defaults (100 req/min)
                 * rateLimitPolicy: true
                 *
                 * @example
                 * // Custom configuration with per-route limits
                 * rateLimitPolicy: {
                 *     enabled: true,
                 *     maxCalls: 60,
                 *     windowMs: 60000,  // 60 req/min globally
                 *     rules: [
                 *         { startsWith: '/api/search', maxCalls: 10, windowMs: 1000 },  // 10/sec for search
                 *         { startsWith: '/admin', enabled: false }  // No limit for admin
                 *     ]
                 * }
                 *
                 * @example
                 * // Per-user rate limiting
                 * rateLimitPolicy: {
                 *     enabled: true,
                 *     maxCalls: 100,
                 *     windowMs: 60000,
                 *     serializer: (ctx) => `user:${ctx.headers?.['X-User-ID'] ?? 'anonymous'}`
                 * }
                 */
                rateLimitPolicy?: boolean | RateLimitConfig<S, H, P> | undefined,
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
