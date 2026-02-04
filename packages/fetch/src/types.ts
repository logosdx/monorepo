import { type MaybePromise, type CacheAdapter, RateLimitTokenBucket } from '@logosdx/utils';
import { FetchError } from './helpers/fetch-error.ts';
import { type FetchEngine } from './engine/index.ts';

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
    headers?: DictAndT<H> | undefined;

    /** URL parameters (extracted from url.searchParams for flat access) */
    params?: DictAndT<P> | undefined;

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

export type DictAndT<T> = Record<string, string> & Partial<T>;
export type MethodHeaders<T> = HttpMethodOpts<DictAndT<T>>;

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

    /**
     * Total timeout for the entire request lifecycle in milliseconds.
     * Applies to the complete operation including all retry attempts.
     * If this fires, no more retries will be attempted.
     */
    totalTimeout?: number | undefined;

    /**
     * Per-attempt timeout in milliseconds.
     * Each retry attempt gets a fresh timeout. If an attempt times out,
     * it can still be retried (unlike totalTimeout which stops everything).
     */
    attemptTimeout?: number | undefined;

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

// Note: The FetchEngine namespace is now defined via declaration merging
// in src/engine/index.ts. Types are defined in their modular locations
// and forwarded to the namespace for external access.
//
// Users can augment FetchEngine.InstanceHeaders, FetchEngine.InstanceParams,
// FetchEngine.InstanceState, and FetchEngine.InstanceResponseHeaders
// using module augmentation:
//
// declare module '@logosdx/fetch' {
//     namespace FetchEngine {
//         interface InstanceHeaders {
//             'X-Custom-Header': string;
//         }
//     }
// }
