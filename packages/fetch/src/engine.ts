import {
    assert,
    assertOptional,
    clone,
    attempt,
    wait,
    SingleFlight,
    Deferred,
    RateLimitTokenBucket,
    RateLimitError,
} from '@logosdx/utils';

import { ObserverEngine } from '@logosdx/observer';

import {
    type _InternalHttpMethods,
    type HttpMethodOpts,
    type HttpMethods,
    type MethodHeaders,
    type RetryConfig,
    type FetchResponse,
    type FetchConfig,
    type DeduplicationConfig,
    type CacheConfig,
    type RateLimitConfig,
    type RequestKeyOptions,
    type DeduplicationInternalState,
    type DedupeRule,
    type CacheInternalState,
    type CacheRule,
    type RateLimitInternalState,
    type RateLimitRule,
} from './types.ts';

import {
    FetchError,
    fetchTypes,
    validateOptions,
    DEFAULT_RETRY_CONFIG,
    DEFAULT_INFLIGHT_METHODS,
    validateMatchRules,
    findMatchingRule,
    defaultRequestSerializer,
    defaultRateLimitSerializer,
} from './helpers.ts';

/**
 * Internal normalized request options - flat structure used throughout FetchEngine.
 *
 * This is the single source of truth for all request data, flowing to:
 * - Cache/dedupe serializers (satisfies RequestKeyOptions)
 * - Event data (spread directly into events)
 * - Request execution (#attemptCall → #makeCall)
 */
type InternalReqOptions<H, P, S> = {
    // === Request identity (satisfies RequestKeyOptions) ===
    /** HTTP method (uppercase) */
    method: HttpMethods;
    /** Original request path */
    path: string;
    /** Request payload/body */
    payload?: unknown;
    /** Merged headers (instance + method + request) */
    headers: FetchEngine.Headers<H>;
    /** URL parameters as flat object (from url.searchParams) */
    params: FetchEngine.Params<P>;
    /** Instance state */
    state: S;

    // === URL (native URL class) ===
    /** Fully-constructed URL - source of truth for path + params */
    url: URL;

    // === Execution plumbing ===
    /** AbortSignal for request cancellation */
    signal: AbortSignal;
    /** AbortController for cancelling the request */
    controller: AbortController;
    /** Serialized body for fetch() */
    body?: BodyInit | undefined;
    /** Request timeout in ms */
    timeout?: number | undefined;
    /** Retry configuration */
    retry?: RetryConfig | false | undefined;
    /** Custom response type determination */
    determineType?: FetchEngine.DetermineTypeFn | undefined;

    // === Callbacks ===
    onBeforeRequest?: FetchEngine.CallOptions<H, P>['onBeforeReq'] | undefined;
    onAfterRequest?: FetchEngine.CallOptions<H, P>['onAfterReq'] | undefined;
    onError?: FetchEngine.CallOptions<H, P>['onError'] | undefined;

    // === Runtime state ===
    /**
     * Current attempt number (used in retry logic and events).
     * Named differently from the `attempt` utility function to avoid shadowing.
     */
    attempt?: number | undefined;
}

/**
 * Creates a wrapper around `window.fetch` that allows
 * certain overrides of default fetch options. Implements
 * an abort controller per request that can be intercepted
 * using `opts.signal.abort()`.
 *
 * Provides resilient HTTP client with retry logic, request/response
 * interception, and comprehensive error handling for production
 * applications that need reliable API communication.
 *
 * * See abort controller:
 * * * https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 * * * https://github.com/facebook/react-native/blob/0.67-stable/packages/rn-tester/js/examples/XHR/XHRExampleAbortController.js
 *
 * @template H - Type of request headers
 * @template P - Type of request params
 * @template S - Type of instance state
 * @template RH - Type of response headers
 *
 * @example
 * // Basic setup with error handling
 * const api = new FetchEngine({
 *     baseUrl: 'https://api.example.com',
 *     defaultType: 'json',
 *     headers: { 'Authorization': 'Bearer token' }
 * });
 *
 * const [user, err] = await attempt(() => api.get('/users/123'));
 * if (err) {
 *     console.error('Failed to fetch user:', err);
 *     return;
 * }
 *
 * @example
 * // Advanced setup with retry and validation
 * const api = new FetchEngine({
 *     baseUrl: 'https://api.example.com',
 *     retry: {
 *         maxAttempts: 3,
 *         baseDelay: 1000,
 *         shouldRetry: (error) => error.status >= 500
 *     },
 *     validate: {
 *         headers: (headers) => {
 *             if (!headers.Authorization) {
 *                 throw new Error('Authorization header required');
 *             }
 *         }
 *     }
 * });
 */
export class FetchEngine<
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    S = FetchEngine.InstanceState,
    RH = FetchEngine.InstanceResponseHeaders,
> extends ObserverEngine<FetchEngine.EventMap<S, H>> {

    /**
     * Symbol to use the default value or configuration
     * for a given option. For example, if you want to
     * handle the response type yourself, you can set the
     * `determineType` option to a function that returns
     * the type of the response, or you can return the
     * `FetchEngine.useDefault` to use the internal logic.
     *
     * Allows custom type determination logic to fall back to
     * the built-in content-type detection when needed.
     *
     * @example
     * const api = new FetchEngine({
     *     baseUrl: 'https://api.example.com',
     *     determineType: (response) => {
     *         // Custom logic for special endpoints
     *         if (response.url.includes('/download')) {
     *             return 'blob';
     *         }
     *         // Fall back to default detection
     *         return FetchEngine.useDefault;
     *     }
     * });
     */
    static useDefault = Symbol('useDefault');

    #baseUrl: URL;
    #options: Partial<FetchEngine.RequestOpts>;
    #headers: FetchEngine.Headers<H>;
    #methodHeaders: MethodHeaders<H>;
    #params: FetchEngine.Params<P>;
    #methodParams: HttpMethodOpts<P>;
    #type: FetchEngine.Type;

    #modifyOptions?: FetchEngine.Options<H, P, S>['modifyOptions'];
    #modifyMethodOptions?: HttpMethodOpts<FetchEngine.Options<H, P, S>['modifyOptions']>;

    #validate?: FetchEngine.Options<H, P, S>['validate'];

    #instanceAbortController = new AbortController();

    /**
     * For saving values that may be needed to craft requests as the
     * application progresses; for example: as you login, you get a
     * token of some sort which is used to generate an hmac.
     *
     * Maintains request context across multiple API calls, such as
     * authentication tokens, session data, or user preferences that
     * need to be included in subsequent requests.
     *
     * @example
     * const api = new FetchEngine({
     *     baseUrl: 'https://api.example.com'
     * });
     *
     * // Store auth token after login
     * api.setState('authToken', 'bearer-token-123');
     *
     * // Use token in subsequent requests
     * api.addHeader('Authorization', `Bearer ${api.getState().authToken}`);
     */
    #state: S = {} as S;

    #retry: Required<RetryConfig>;

    // Deduplication
    #flight = new SingleFlight<unknown>();

    #dedupe: DeduplicationInternalState<S, H, P> | null = null;

    // Caching
    #cache: CacheInternalState<S, H, P> | null = null;


    // Rate Limiting
    #rateLimit: RateLimitInternalState<S, H, P> | null = null;

    get #destroyed() {

        return this.#instanceAbortController.signal.aborted;
    }

    /**
     * Removes a header from the `FetchEngine` instance
     */
    removeHeader: FetchEngine<H, P, S>['rmHeader'];

    /**
     * Removes a param from the `FetchEngine` instance
     */
    removeParam: FetchEngine<H, P, S>['rmParams'];

    #validateHeaders(headers: FetchEngine.Headers<H>, method?: HttpMethods) {

        if (this.#validate?.headers) {

            this.#validate.headers(
                headers,
                method?.toUpperCase() as _InternalHttpMethods
            );
        }
    }

    /**
     * Validates parameters using the configured validation function.
     *
     * Ensures request parameters meet requirements before making requests,
     * allowing custom validation logic for data integrity.
     *
     * @param params - Parameters to validate
     * @param method - HTTP method for context-specific validation
     * @internal
     */
    #validateParams(params: FetchEngine.Params<P>, method?: HttpMethods) {

        if (this.#validate?.params) {

            this.#validate.params(
                params,
                method?.toUpperCase() as _InternalHttpMethods
            );
        }
    }

    /**
     * Validates state using the configured validation function.
     *
     * Ensures internal state meets requirements when updated,
     * allowing custom validation logic for state consistency.
     *
     * @param state - State to validate
     * @internal
     */
    #validateState(state: S) {

        if (this.#validate?.state) {

            this.#validate.state(state);
        }
    }

    /**
     * Determines the response type based on content-type header or custom logic.
     *
     * Analyzes the response content-type to determine how to parse the response.
     * Supports custom type determination through the determineType option,
     * with fallback to built-in content-type detection logic.
     *
     * @param response - Fetch Response object to analyze
     * @returns Object with type and isJson flag
     * @throws {FetchError} When content-type is unknown and no fallback is available
     * @internal
     *
     * @example
     * // Custom type determination
     * const api = new FetchEngine({
     *     baseUrl: 'https://api.example.com',
     *     determineType: (response) => {
     *         if (response.url.includes('/csv')) return 'text';
     *         if (response.url.includes('/download')) return 'blob';
     *         return FetchEngine.useDefault; // Use built-in detection
     *     }
     * });
     */
    #determineType(response: Response): {
        type: FetchEngine.Type,
        isJson: boolean
    } {

        if (this.#options.determineType) {

            const type = this.#options.determineType(response);

            if (FetchEngine.useDefault !== type) {

                if (!fetchTypes.includes(type as FetchEngine.Type)) {

                    console.warn(`Invalid type: '${type}'. Defaulting to '${this.#type}'`);

                    return {
                        type: this.#type,
                        isJson: this.#type === 'json'
                    }
                }

                return {
                    type: type as FetchEngine.Type,
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

                throw new FetchError(
                    'Unknown content type: ' +
                    contentType +
                    ' You may need to set the "determineType" option' +
                    ' to customize how the response is parsed.'
                );
            }
        }

        return { type: this.#type, isJson: this.#type === 'json' };
    }


    /**
     * Initializes a new FetchEngine instance with the provided configuration.
     *
     * Sets up the HTTP client with base URL, default settings, retry configuration,
     * and validation rules. Validates all options and establishes the initial state.
     *
     * @param _opts - Configuration options for the FetchEngine instance
     * @throws {Error} When validation fails for required options
     *
     * @example
     * const api = new FetchEngine({
     *     baseUrl: 'https://api.example.com',
     *     defaultType: 'json',
     *     headers: { 'Authorization': 'Bearer token' },
     *     retry: {
     *         maxAttempts: 3,
     *         baseDelay: 1000
     *     }
     * });
     */
    constructor(_opts: FetchEngine.Options<H, P, S>) {

        // Extract ObserverEngine options and pass to super
        super({
            name: _opts.name,
            spy: _opts.spy as any
        });

        validateOptions(_opts);

        const { baseUrl, defaultType, name: _name, spy: _spy, ...opts } = _opts;
        let { retry } = _opts;

        if (retry === true) {
            retry = {}
        }

        this.#baseUrl = new URL(baseUrl);
        this.#type = defaultType || 'json';
        this.#retry = {
            ...DEFAULT_RETRY_CONFIG,
            ...(
                retry ? retry : {
                    maxAttempts: 0
                }
            )
        };

        const {
            modifyOptions,
            modifyMethodOptions,
            validate,
            ...rest
        } = opts;

        this.#options = rest;
        this.#headers = opts.headers || {} as FetchEngine.Headers<H>;
        this.#methodHeaders = Object.fromEntries(
            Object.keys(opts.methodHeaders || {}).map(
                (method) => ([method.toUpperCase(), opts.methodHeaders![method as never]])
            )
        );
        this.#params = opts.params || {} as FetchEngine.Params<P>;
        this.#methodParams = opts.methodParams || {} as HttpMethodOpts<P>;

        this.#modifyOptions = modifyOptions;
        this.#modifyMethodOptions = modifyMethodOptions!;
        this.#validate = validate;

        this.removeHeader = this.rmHeader.bind(this) as FetchEngine<H, P, S>['rmHeader'];
        this.removeParam = this.rmParams.bind(this) as FetchEngine<H, P, S>['rmParams'];

        this.#validateHeaders(this.#headers);

        // Initialize deduplication
        this.#initDeduplication(opts.dedupePolicy);

        // Initialize caching
        this.#initCache(opts.cachePolicy);

        // Initialize rate limiting
        this.#initRateLimit(opts.rateLimitPolicy);
    }


    /**
     * Initialize deduplication configuration.
     *
     * @param config - Deduplication config from options
     */
    #initDeduplication(config?: boolean | DeduplicationConfig<S, H, P>): void {

        if (!config) return;

        if (config === true) {

            this.#dedupe = {
                enabled: true,
                methods: new Set(DEFAULT_INFLIGHT_METHODS),
                config: {},
                serializer: defaultRequestSerializer,
                rulesCache: new Map()
            }

            return;
        }

        // Full config object
        this.#dedupe = {
            enabled: config.enabled !== false,
            methods: new Set(config.methods ?? DEFAULT_INFLIGHT_METHODS),
            config,
            serializer: config.serializer ?? defaultRequestSerializer,
            rulesCache: new Map()
        }

        // Validate rules if provided
        if (config.rules) {

            validateMatchRules(config.rules);
        }
    }


    /**
     * Initialize cache configuration.
     *
     * @param config - Cache config from options
     */
    #initCache(config?: boolean | CacheConfig<S, H, P>): void {

        if (!config) return;

        if (config === true) {

            // Boolean true = enable with defaults
            this.#cache = {
                enabled: true,
                methods: new Set(DEFAULT_INFLIGHT_METHODS),
                config: {},
                ttl: 60000,
                staleIn: undefined,
                serializer: defaultRequestSerializer,
                rulesCache: new Map(),
                activeKeys: new Set(),
                revalidatingKeys: new Set()
            }

            return;
        }

        // Full config object

        this.#cache = {
            enabled: config.enabled !== false,
            methods: new Set(config.methods ?? DEFAULT_INFLIGHT_METHODS),
            config,
            ttl: config.ttl ?? 60000,
            staleIn: config.staleIn,
            serializer: config.serializer ?? defaultRequestSerializer,
            rulesCache: new Map(),
            activeKeys: new Set(),
            revalidatingKeys: new Set()
        }

        // Validate rules if provided
        if (config.rules) {

            validateMatchRules(config.rules);
        }

        // Initialize SingleFlight with adapter if provided
        this.#flight = new SingleFlight<unknown>({
            adapter: config.adapter,
            defaultTtl: this.#cache.ttl,
            defaultStaleIn: this.#cache.staleIn
        });
    }


    /**
     * Default methods for rate limiting (all methods by default).
     */
    static #DEFAULT_RATELIMIT_METHODS: _InternalHttpMethods[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];


    /**
     * Initialize rate limit configuration.
     *
     * @param config - Rate limit config from options
     */
    #initRateLimit(config?: boolean | RateLimitConfig<S, H, P>): void {

        if (!config) return;

        if (config === true) {

            // Boolean true = enable with defaults
            this.#rateLimit = {
                enabled: true,
                methods: new Set(FetchEngine.#DEFAULT_RATELIMIT_METHODS),
                config: {},
                maxCalls: 100,
                windowMs: 60000,
                waitForToken: true,
                serializer: defaultRateLimitSerializer,
                rulesCache: new Map(),
                rateLimiters: new Map()
            };
            return;
        }

        // Full config object
        this.#rateLimit = {
            enabled: config.enabled !== false,
            methods: new Set(config.methods ?? FetchEngine.#DEFAULT_RATELIMIT_METHODS),
            config,
            maxCalls: config.maxCalls ?? 100,
            windowMs: config.windowMs ?? 60000,
            waitForToken: config.waitForToken ?? true,
            serializer: config.serializer ?? defaultRateLimitSerializer,
            rulesCache: new Map(),
            rateLimiters: new Map()
        }

        // Validate rules if provided
        if (config.rules) {

            validateMatchRules(config.rules);
        }
    }


    /**
     * Resolve rate limit configuration for a specific request.
     *
     * Uses memoization for rule matching (O(n) only once per method+path).
     * The shouldRateLimit callback is always evaluated since it depends on request context.
     *
     * @returns Object with config or null if disabled
     */
    #resolveRateLimitConfig(
        method: string,
        path: string,
        keyContext: RequestKeyOptions<S, H, P>
    ): RateLimitRule<S, H, P> | null {

        // If globally disabled AND no rules defined, skip everything
        // But if rules are defined, allow them to enable rate limiting for specific routes
        if (
            !this.#rateLimit ||
            (

                !this.#rateLimit?.enabled &&
                !this.#rateLimit?.config?.rules?.length
            )
        ) {

            return null;
        }

        const upperMethod = method.toUpperCase();
        const cacheKey = `${upperMethod}:${path}`;

        // Check cache for rule resolution
        let cached = this.#rateLimit.rulesCache.get(cacheKey);

        if (cached === undefined) {

            // Not in cache - compute and store
            cached = this.#computeRateLimitRuleConfig(upperMethod, path);
            this.#rateLimit.rulesCache.set(cacheKey, cached);
        }

        // If rule resolution returned null, rate limiting is disabled for this route
        if (cached === null) return null;

        // Apply dynamic shouldRateLimit check (not cached)
        if (
            this.#rateLimit.config?.shouldRateLimit &&
            this.#rateLimit.config.shouldRateLimit(keyContext) === false
        ) {

            return null;
        }

        return cached;
    }


    /**
     * Compute rate limit rule configuration for a method+path combination.
     * This is the expensive O(n) operation that gets memoized.
     */
    #computeRateLimitRuleConfig(
        method: string,
        path: string
    ): RateLimitRule<S, H, P> | null {

        if (!this.#rateLimit) return null;

        // When globally disabled, start with enabled=false
        // Rules with explicit enabled:true can still enable rate limiting
        let enabled = this.#rateLimit.enabled && this.#rateLimit.methods.has(method);
        let serializer = this.#rateLimit.serializer;
        let maxCalls = this.#rateLimit.maxCalls;
        let windowMs = this.#rateLimit.windowMs;
        let waitForToken = this.#rateLimit.waitForToken;

        // Check for matching rule
        if (this.#rateLimit.config?.rules?.length) {

            const rule = findMatchingRule(
                this.#rateLimit.config.rules,
                method,
                path,
                [...this.#rateLimit.methods] as _InternalHttpMethods[]
            );

            if (rule) {

                // Rule can disable for this route
                if (rule.enabled === false) {

                    return null;
                }

                // Rule can override methods
                if (rule.methods) {

                    enabled = rule.methods.includes(method as _InternalHttpMethods);
                }
                else {

                    // Rule matched by path, so it's enabled for this method
                    enabled = true;
                }

                // Rule can override serializer
                if (rule.serializer) {

                    serializer = rule.serializer;
                }

                // Rule can override maxCalls
                if (rule.maxCalls !== undefined) {

                    maxCalls = rule.maxCalls;
                }

                // Rule can override windowMs
                if (rule.windowMs !== undefined) {

                    windowMs = rule.windowMs;
                }

                // Rule can override waitForToken
                if (rule.waitForToken !== undefined) {

                    waitForToken = rule.waitForToken;
                }
            }
        }

        if (!enabled) {

            return null;
        }

        return {
            enabled: true,
            serializer,
            maxCalls,
            windowMs,
            waitForToken
        };
    }


    /**
     * Get or create a rate limiter for the given key.
     *
     * Rate limiters are cached by key to ensure all requests to the same
     * endpoint share the same token bucket.
     */
    #getRateLimiter(key: string, maxCalls: number, windowMs: number): RateLimitTokenBucket {

        if (!this.#rateLimit) throw new Error('Rate limiting not initialized');

        let bucket = this.#rateLimit.rateLimiters.get(key);

        if (!bucket) {

            // Token bucket needs: capacity and time per token
            // If maxCalls=100 and windowMs=60000, we want 100 requests per minute
            // So refillIntervalMs = windowMs / maxCalls = 600ms per token
            const refillIntervalMs = windowMs / maxCalls;
            bucket = new RateLimitTokenBucket({ capacity: maxCalls, refillIntervalMs });

            this.#rateLimit.rateLimiters.set(key, bucket);
        }

        return bucket;
    }


    /**
     * Resolve cache configuration for a specific request.
     *
     * Uses memoization for rule matching (O(n) only once per method+path).
     * The skip callback is always evaluated since it depends on request context.
     *
     * @returns Object with config or null if disabled
     */
    #resolveCacheConfig(
        method: string,
        path: string,
        keyContext: RequestKeyOptions<S, H, P>
    ): CacheRule<S, H, P> | null {

        if (!this.#cache) return null;

        // If globally disabled AND no rules defined, skip everything
        // But if rules are defined, allow them to enable caching for specific routes
        if (
            !this.#cache.enabled &&
            !this.#cache.config?.rules?.length
        ) {

            return null;
        }

        const upperMethod = method.toUpperCase();
        const cacheKey = `${upperMethod}:${path}`;

        // Check cache for rule resolution
        let cached = this.#cache.rulesCache.get(cacheKey);

        if (cached === undefined) {

            // Not in cache - compute and store
            cached = this.#computeCacheRuleConfig(upperMethod, path);
            this.#cache.rulesCache.set(cacheKey, cached);
        }

        // If rule resolution returned null, caching is disabled for this route
        if (cached === null) return null;

        // Apply dynamic skip check (not cached)
        if (
            this.#cache.config?.skip &&
            this.#cache.config.skip(keyContext) === true
        ) {

            return null;
        }

        return cached;
    }


    /**
     * Compute cache rule configuration for a method+path combination.
     * This is the expensive O(n) operation that gets memoized.
     */
    #computeCacheRuleConfig(
        method: string,
        path: string
    ): CacheRule<S, H, P> | null {

        if (!this.#cache) return null;

        // When globally disabled, start with enabled=false
        // Rules with explicit enabled:true can still enable caching
        let enabled = this.#cache.enabled && this.#cache.methods.has(method);
        let serializer = this.#cache.serializer;
        let ttl = this.#cache.ttl;
        let staleIn = this.#cache.staleIn;

        // Check for matching rule
        if (this.#cache.config?.rules?.length) {

            const rule = findMatchingRule(
                this.#cache.config.rules,
                method,
                path,
                [...this.#cache.methods] as _InternalHttpMethods[]
            );

            if (rule) {

                // Rule can disable for this route
                if (rule.enabled === false) {

                    return null;
                }

                // Rule can override methods
                if (rule.methods) {

                    enabled = rule.methods.includes(method as _InternalHttpMethods);
                }
                else {

                    // Rule matched by path, so it's enabled for this method
                    enabled = true;
                }

                // Rule can override serializer
                if (rule.serializer) {

                    serializer = rule.serializer;
                }

                // Rule can override TTL
                if (rule.ttl !== undefined) {

                    ttl = rule.ttl;
                }

                // Rule can override staleIn
                if (rule.staleIn !== undefined) {

                    staleIn = rule.staleIn;
                }
            }
        }

        if (!enabled) {

            return null;
        }

        return { enabled: true, serializer, ttl, staleIn };
    }


    /**
     * Resolve deduplication configuration for a specific request.
     *
     * Uses memoization for rule matching (O(n) only once per method+path).
     * The shouldDedupe callback is always evaluated since it depends on request context.
     *
     * @returns Object with `enabled` flag and `serializer` to use, or null if disabled
     */
    #resolveDedupeConfig(
        method: string,
        path: string,
        keyContext: RequestKeyOptions<S, H, P>
    ): DedupeRule<S, H, P> | null {

        if (!this.#dedupe) return null;

        // If globally disabled AND no rules defined, skip everything
        // But if rules are defined, allow them to enable deduplication for specific routes
        if (!this.#dedupe.enabled && !this.#dedupe.config?.rules?.length) {

            return null;
        }

        const upperMethod = method.toUpperCase();
        const cacheKey = `${upperMethod}:${path}`;

        // Check cache for rule resolution
        let cached = this.#dedupe.rulesCache.get(cacheKey);

        if (cached === undefined) {

            // Not in cache - compute and store
            cached = this.#computeDedupeRuleConfig(upperMethod, path);
            this.#dedupe.rulesCache.set(cacheKey, cached);
        }

        // If rule resolution returned null, deduplication is disabled for this route
        if (cached === null) return null;

        // Apply dynamic shouldDedupe check (not cached)
        if (
            this.#dedupe.config?.shouldDedupe &&
            this.#dedupe.config.shouldDedupe(keyContext) === false
        ) {

            return null;
        }

        return cached;
    }


    /**
     * Compute deduplication rule configuration for a method+path combination.
     * This is the expensive O(n) operation that gets memoized.
     */
    #computeDedupeRuleConfig(
        method: string,
        path: string
    ): DedupeRule<S, H, P> | null {

        if (!this.#dedupe) return null;

        // When globally disabled, start with enabled=false
        // Rules with explicit enabled:true can still enable deduplication
        let enabled = this.#dedupe.enabled && this.#dedupe.methods.has(method);
        let serializer = this.#dedupe.serializer;

        // Check for matching rule
        if (this.#dedupe.config?.rules?.length) {
            const rule = findMatchingRule(
                this.#dedupe.config.rules,
                method,
                path,
                [...this.#dedupe.methods] as _InternalHttpMethods[]
            );

            if (rule) {

                // Rule can disable for this route
                if (rule.enabled === false) return null;

                // Rule can be overridden by methods
                enabled = rule.methods?.includes(method as _InternalHttpMethods) ?? true;

                // Rule can override serializer
                if (rule.serializer) {

                    serializer = rule.serializer;
                }
            }
        }

        if (!enabled) return null;

        return {
            enabled: true,
            serializer
        };
    }


    /**
     * Calculate delay for retry attempt using exponential backoff.
     *
     * Implements exponential backoff strategy to prevent overwhelming
     * servers during retry attempts. Supports both fixed and dynamic
     * delay calculations based on error conditions.
     *
     * @param attemptNo - Current attempt number (1-based)
     * @param retry - Retry configuration with delay settings
     * @param error - Optional error for dynamic delay calculation
     * @returns Delay in milliseconds before next retry attempt
     * @internal
     *
     * @example
     * // Exponential backoff: 1000ms, 2000ms, 4000ms, 8000ms...
     * const delay = this.#calculateRetryDelay(3, {
     *     baseDelay: 1000,
     *     maxDelay: 10000,
     *     useExponentialBackoff: true
     * });
     * // Returns 4000ms for 3rd attempt
     */
    #calculateRetryDelay(attemptNo: number, retry: Required<RetryConfig>): number {

        const { baseDelay, maxDelay, useExponentialBackoff } = retry;

        if (!useExponentialBackoff) return Math.min(baseDelay, maxDelay!);

        const delay = baseDelay * Math.pow(2, attemptNo - 1);

        return Math.min(delay, maxDelay!);
    }

    /**
     * Merges default headers with method-specific and override headers.
     *
     * Combines instance headers, method-specific headers, and request-specific
     * overrides to create the final header set for a request. Applies
     * formatting rules to ensure consistent header casing.
     *
     * @param override - Request-specific header overrides
     * @param method - HTTP method for method-specific headers
     * @returns Merged and formatted headers
     * @internal
     *
     * @example
     * // Merges: default headers + POST headers + request overrides
     * const headers = this.#makeHeaders(
     *     { 'X-Request-ID': '123' },
     *     'POST'
     * );
     */
    #makeHeaders(override: FetchEngine.Headers<H> = {}, method?: HttpMethods) {

        const methodHeaders = this.#methodHeaders;

        const key = method?.toUpperCase() as keyof typeof methodHeaders;

        return {
            ...this.#headers,
            ...(methodHeaders[key] || {}),
            ...override
        };
    }

    /**
     * Merges default parameters with method-specific and override parameters.
     *
     * Combines instance parameters, method-specific parameters, and request-specific
     * overrides to create the final parameter set for a request URL.
     *
     * @param override - Request-specific parameter overrides
     * @param method - HTTP method for method-specific parameters
     * @returns Merged parameters
     * @internal
     *
     * @example
     * // Merges: default params + GET params + request overrides
     * const params = this.#makeParams(
     *     { page: 2 },
     *     'GET'
     * );
     */
    #makeParams(override: FetchEngine.Params<P> = {}, method?: HttpMethods) {

        const methodParams = this.#methodParams;

        const key = method?.toUpperCase() as keyof typeof methodParams;

        return {
            ...(this.#params || {}),
            ...(methodParams[key] || {}),
            ...override
        };
    }

    /**
     * Constructs the full URL by combining base URL, path, and parameters.
     *
     * Builds the complete request URL by merging the base URL with the path
     * and appending merged parameters. Handles existing query parameters
     * in the path and merges them with instance and method-specific parameters.
     *
     * @param path - Request path (may include existing query parameters)
     * @param _params - Request-specific parameters to merge
     * @param method - HTTP method for method-specific parameters
     * @returns Complete URL with merged parameters
     * @internal
     *
     * @example
     * // Input: path='/users?page=1', params={limit: 10}
     * // Output: 'https://api.example.com/users?page=1&limit=10'
     * const url = this.#makeUrl('/users?page=1', { limit: 10 }, 'GET');
     */
    #makeUrl(path: string, _params?: P, method?: HttpMethods) {

        if (path.startsWith('http')) {

            const url = new URL(path);
            const params = this.#makeParams(_params!, method);

            Object.entries(params).forEach(([key, value]) => {

                url.searchParams.set(key, value as string);
            });

            return url;
        }

        path = path?.replace(/^\/{1,}/, '');
        if (path[0] !== '/') (path = `/${path}`);

        const fullPath = this.#baseUrl.toString().replace(/\/$/, '');
        const params = this.#makeParams(_params!, method);

        const url = new URL(fullPath + path);

        for (const [key, value] of Object.entries(params)) {

            url.searchParams.set(key, value as string);
        }

        if (this.#validate?.perRequest?.params) {

            this.#validateParams(
                Object.fromEntries(url.searchParams.entries()) as FetchEngine.Params<P>,
                method
            );
        }

        return url;
    }

    #makeRequestOptions (
        _method: HttpMethods,
        path: string,
        options: (
            FetchEngine.CallOptions<H, P> &
            {
                payload?: unknown,
                controller: AbortController,
                attempt?: number
            }
        )
    ): InternalReqOptions<H, P, S> {

        const {
            payload,
            controller,
            onAfterReq: onAfterRequest,
            onBeforeReq: onBeforeRequest,
            onError,
            timeout = this.#options.timeout,
            params,
            attempt: attemptNum,
            signal,
            determineType,
            retry,
            headers: requestHeaders,
            ...rest
        } = options;

        const type = this.#type;
        const state = this.#state;
        const modifyOptions = this.#modifyOptions;
        const modifyMethodOptions = this.#modifyMethodOptions;
        const method = _method.toUpperCase() as _InternalHttpMethods;
        const url = this.#makeUrl(path, params as P, method);

        // Merge headers (instance + method + request-level)
        let headers = this.#makeHeaders(requestHeaders, method);

        // Build body for mutating methods
        let body: BodyInit | undefined;

        if (/put|post|patch|delete/i.test(method)) {

            // Check if payload is already a valid BodyInit type that doesn't need serialization
            const isValidBodyInit = (
                payload === null ||
                payload === undefined ||
                typeof payload === 'string' ||
                payload instanceof Blob ||
                payload instanceof ArrayBuffer ||
                payload instanceof FormData ||
                payload instanceof URLSearchParams ||
                payload instanceof ReadableStream ||
                ArrayBuffer.isView(payload)
            );

            if (type === 'json' && !isValidBodyInit) {
                // JSON.stringify any object, array, or primitive that isn't already a valid BodyInit
                body = JSON.stringify(payload);
            }
            else if (payload !== null && payload !== undefined) {
                body = payload as BodyInit;
            }
        }

        // Build opts for modifyOptions compatibility (temporary structure)
        // Note: spread rest first, then explicit properties to ensure they aren't overwritten
        // Note: RequestOpts extends RequestInit which expects body: BodyInit | null
        let opts: FetchEngine.RequestOpts = {
            ...rest,
            method,
            signal: signal || controller.signal,
            controller,
            headers,
            body: body ?? null,
            timeout,
            retry,
            determineType,
        };

        // Apply global modifyOptions
        opts = modifyOptions
            ? modifyOptions(opts as never, state)
            : opts;

        // Apply method-specific modifyOptions
        const methodSpecificModify = modifyMethodOptions?.[method] as typeof modifyOptions;

        if (methodSpecificModify) {
            opts = methodSpecificModify(opts as never, state);
        }

        // Extract final values after modification
        headers = (opts.headers || {}) as FetchEngine.Headers<H>;
        body = opts.body ?? undefined;

        if (this.#validate?.perRequest?.headers) {

            this.#validateHeaders(headers, method);
        }

        // Return flat structure - the normalized options IS the context
        return {
            // Request identity (satisfies RequestKeyOptions)
            method,
            path,
            payload,
            headers,
            params: Object.fromEntries(url.searchParams.entries()) as FetchEngine.Params<P>,
            state,

            // URL
            url,

            // Execution plumbing
            signal: opts.signal || controller.signal,
            controller,
            body,
            timeout: opts.timeout,
            retry: opts.retry === true ? {} : opts.retry,
            determineType: opts.determineType || this.#options.determineType,

            // Callbacks
            onBeforeRequest,
            onAfterRequest,
            onError,

            // Runtime state
            attempt: attemptNum
        };
    }

    #extractRetry(opts: InternalReqOptions<H, P, S>) {

        // retry is already normalized (true converted to {} in #makeRequestOptions)
        return opts.retry;
    }

    #handleError(
        normalizedOpts: InternalReqOptions<H, P, S>,
        errorOpts: {
            error: FetchError | Error,
            step: 'fetch' | 'parse' | 'response',
            status?: number,
            data?: unknown
        }
    ) {

        const {
            method,
            path,
            headers,
            controller,
            onError,
            attempt: attemptNum
        } = normalizedOpts;

        const {
            error,
            step,
            status,
            data
        } = errorOpts;

        const aborted = controller.signal.aborted;

        let err = error as FetchError<{}, H>;

        if (step === 'fetch') {

            err = new FetchError(err.message);

            err.status = 499;
            err.message = err.message || 'Fetch error';
        }

        if (step === 'parse') {

            err = new FetchError(err.message);

            err.status = status || 999;
            err.message = err.message || 'Parse error';
        }

        if (step === 'response') {

            const asAgg = error as AggregateError;
            let errors = asAgg.errors as Error[];
            let errCode = '';

            // Handle undici errors
            if (
                !errors ||
                errors.length === 0 &&
                error.cause instanceof AggregateError
            ) {

                errors = (error.cause as AggregateError)?.errors as Error[];
            }

            if ((error as any)?.code) {
                errCode = (error as any).code;
            }

            if (errors && errors.length > 0) {

                const msgs = errors.map((e) => e.message).join('; ');

                err = new FetchError(`${errCode}: ${msgs}`);
            }
            else {

                err = new FetchError(error.message);
            }
        }

        err.attempt = attemptNum;
        err.status = err.status || status!;
        err.method = err.method || method!;
        err.path = err.path || path!;
        err.aborted = err.aborted || aborted;
        err.data = err.data || data as null;
        err.step = err.step || step;
        err.headers = (err.headers || headers) as H;

        // Emit error event with normalizedOpts as base
        // normalizedOpts already contains attempt, so just add error-specific fields
        const eventData = {
            ...normalizedOpts,
            error: err,
            step,
            status,
            aborted,
            data
        };

        if (aborted) {

            this.emit('fetch-abort', eventData as any);
        }
        else {

            this.emit('fetch-error', eventData as any);
        }

        onError && onError(err);

        throw err;
    }

    /**
     * Makes an API call using fetch with retry logic and returns enhanced response object.
     *
     * Performs the actual HTTP request and returns a comprehensive FetchResponse
     * object containing the parsed data, response headers, status code, request
     * details, and configuration used. This provides full context about the
     * request and response for better debugging and conditional logic.
     *
     * @param options - Flat normalized request options (InternalReqOptions)
     * @returns FetchResponse object with data, headers, status, request, and config
     * @internal
     */
    async #makeCall <Res, ResHdr = RH>(
        options: InternalReqOptions<H, P, S>
    ): Promise<FetchResponse<Res, H, P, ResHdr>> {

        const {
            // Request identity
            method,
            headers: reqHeaders,
            params,

            // URL
            url,

            // Execution plumbing
            signal,
            controller,
            body,
            timeout,
            retry,
            determineType,

            // Callbacks
            onBeforeRequest,
            onAfterRequest
        } = options;

        // Emit fetch-before with flat options (normalizedOpts already contains attempt)
        this.emit('fetch-before', {
            ...options
        } as any);

        // Build RequestOpts for callbacks (legacy compatibility)
        // Note: RequestOpts extends RequestInit which expects body: BodyInit | null
        const callbackOpts: FetchEngine.RequestOpts = {
            method,
            signal,
            controller,
            headers: reqHeaders,
            body: body ?? null,
            timeout,
            retry,
            determineType
        };

        onBeforeRequest && await onBeforeRequest(callbackOpts);

        // Build fetch options - only include what native fetch understands
        // Note: RequestInit expects body: BodyInit | null, we use undefined internally
        const fetchOpts: RequestInit = {
            method,
            signal,
            headers: reqHeaders,
            body: body ?? null
        };

        const [response, resErr] = await attempt(async () => {
            return await fetch(url, fetchOpts) as Response;
        });

        // Fetch will only throw if the request is aborted,
        // denied, timed out, reset, etc.
        if (resErr) {

            this.#handleError(options, {
                error: resErr,
                step: 'fetch'
            });

            // #handleError throws, so this should never be reached
            throw resErr;
        }

        this.emit('fetch-after', {
            ...options,
            response: response.clone(),
        } as any);

        onAfterRequest && await onAfterRequest(response.clone(), callbackOpts);

        const [data, parseErr] = await attempt(async () => {

            const { type, isJson } = this.#determineType(response);

            if (isJson) {

                const text = await response.text();

                if (text) {
                    return JSON.parse(text) as Res;
                }

                return null;
            }
            else {

                return await response[type]() as Res;
            }
        });

        if (parseErr) {

            this.#handleError(options, {
                error: parseErr,
                step: 'parse',
                status: response.status,
                data
            });

            // #handleError throws, so this should never be reached
            throw parseErr;
        }

        if (response.ok === false) {

            this.#handleError(options, {
                error: new FetchError(response.statusText),
                step: 'response',
                status: response.status,
                data
            });

            // #handleError throws, so this should never be reached
            throw new FetchError(response.statusText);
        }

        // Emit fetch-response (normalizedOpts already contains attempt)
        this.emit('fetch-response', {
            ...options,
            response,
            data
        } as any);

        const config: FetchConfig<H, P> = {
            baseUrl: this.#baseUrl.toString(),
            timeout,
            method,
            headers: reqHeaders as H,
            params: params as P,
            retry: this.#retry,
            determineType: determineType,
        };

        // Create the Request object for the response
        const request = new Request(url, fetchOpts);

        // Convert response headers to plain object for typed access
        const responseHeaders = {} as Partial<ResHdr>;

        response.headers.forEach((value, key) => {

            responseHeaders[key as keyof ResHdr] = value as ResHdr[keyof ResHdr];
        });

        // Return the enhanced response object
        return {
            data: data!,
            headers: responseHeaders,
            status: response.status,
            request,
            config
        }
    }

    async #attemptCall<Res, ResHdr = RH>(
        options: InternalReqOptions<H, P, S>
    ): Promise<FetchResponse<Res, H, P, ResHdr>> {

        const mergedRetry = {
            ...this.#retry,
            ...this.#extractRetry(options)
        };

        if (mergedRetry.maxAttempts === 0) {

            return this.#makeCall<Res, ResHdr>(options);
        }

        let _attempt = 1;

        while (_attempt <= mergedRetry.maxAttempts!) {

            const [result, err] = await attempt(
                async () => (
                    this.#makeCall<Res, ResHdr>({
                        ...options,
                        attempt: _attempt
                    })
                )
            );

            if (err === null) {
                return result;
            }

            const fetchError = err as FetchError;

            // Check if we should retry
            const shouldRetry = await mergedRetry.shouldRetry(fetchError, _attempt);

            if (shouldRetry && _attempt < mergedRetry.maxAttempts!) {

                // If shouldRetry is a number, use it as the delay
                // Otherwise, calculate the delay using the default logic
                const delay = (
                    typeof shouldRetry === 'number' ?
                    shouldRetry :
                    this.#calculateRetryDelay(_attempt, mergedRetry)
                );

                this.emit('fetch-retry', {
                    ...options,
                    error: fetchError,
                    attempt: _attempt,
                    nextAttempt: _attempt + 1,
                    delay
                } as any);

                await wait(delay);

                _attempt++;
                continue;
            }

            throw fetchError;
        }

        // This should never be reached - all paths should either return or throw
        throw new FetchError('Unexpected end of retry logic');
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
            readonly default: Readonly<FetchEngine.Headers<H>>,
            readonly get?: Readonly<FetchEngine.Headers<H>>,
            readonly post?: Readonly<FetchEngine.Headers<H>>,
            readonly put?: Readonly<FetchEngine.Headers<H>>,
            readonly delete?: Readonly<FetchEngine.Headers<H>>,
            readonly options?: Readonly<FetchEngine.Headers<H>>,
            readonly patch?: Readonly<FetchEngine.Headers<H>>,
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
            readonly default: Readonly<FetchEngine.Params<P>>,
            readonly get?: Readonly<FetchEngine.Params<P>>,
            readonly post?: Readonly<FetchEngine.Params<P>>,
            readonly put?: Readonly<FetchEngine.Params<P>>,
            readonly delete?: Readonly<FetchEngine.Params<P>>,
            readonly options?: Readonly<FetchEngine.Params<P>>,
            readonly patch?: Readonly<FetchEngine.Params<P>>,
        }
    }

    /**
     * Makes an HTTP request with comprehensive error handling and retry logic.
     *
     * Executes HTTP requests with automatic retry on failure, timeout handling,
     * and abort controller support. Returns an enhanced response object containing
     * parsed data, HTTP metadata, request details, and configuration used.
     *
     * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
     * @param path - Request path relative to base URL
     * @param options - Request options including payload, timeout, and callbacks
     * @returns AbortablePromise that resolves to FetchResponse object with data and metadata
     *
     * @example
     * // Access response data and metadata
     * const [response, err] = await attempt(() =>
     *     api.request('GET', '/users/123')
     * );
     * if (err) {
     *     console.error('Request failed:', err.status, err.message);
     *     return;
     * }
     *
     * console.log('User data:', response.data);
     * console.log('Status:', response.status);
     * console.log('Headers:', response.headers.get('content-type'));
     *
     * @example
     * // Destructure just the data for backward compatibility
     * const { data: user } = await api.request('GET', '/users/123');
     *
     * @example
     * // Request with payload and timeout
     * const request = api.request('POST', '/users', {
     *     payload: { name: 'John', email: 'john@example.com' },
     *     timeout: 5000,
     *     onBeforeReq: (opts) => console.log('Making request:', opts),
     *     onError: (err) => console.error('Request error:', err)
     * });
     *
     * // Abort request if needed
     * setTimeout(() => request.abort('User cancelled'), 2000);
     */
    request <Res = any, Data = any, ResHdr = RH>(
        method: HttpMethods,
        path: string,
        options: (
            FetchEngine.CallOptions<H, P> &
            ({ payload: Data | null } | {})
         ) = { payload: null }
    ): FetchEngine.AbortablePromise<FetchResponse<Res, H, P, ResHdr>> {

        // Prevent requests on destroyed instances (memory leak prevention)
        if (this.#destroyed) {

            throw new Error('Cannot make requests on destroyed FetchEngine instance');
        }

        const controller = options.abortController ?? new AbortController();
        const timeoutMs = options.timeout ?? this.#options.timeout;

        if (typeof timeoutMs === 'number') {

            assert(timeoutMs >= 0, 'timeout must be non-negative number');
        }

        const timeout = typeof timeoutMs === 'number' ? wait(timeoutMs) : undefined;

        timeout?.then(() => controller.abort());

        // Abort this request when the instance is destroyed
        const instanceSignal = this.#instanceAbortController.signal;

        if (!instanceSignal.aborted) {

            const onInstanceAbort = () => controller.abort();
            instanceSignal.addEventListener('abort', onInstanceAbort, { once: true });
        }

        // Execute async logic and wrap as AbortablePromise
        const promise = this.#executeRequest<Res, ResHdr>(
            method,
            path,
            options,
            controller,
            timeout
        );

        const call = this.#wrapAsAbortable<FetchResponse<Res, H, P, ResHdr>>(
            promise.then((res) => {

                call.isFinished = true;
                return res;
            }),
            controller
        );

        return call;
    }


    /**
     * Executes the request with cache checking, deduplication, and actual fetch.
     */
    async #executeRequest<Res, ResHdr>(
        method: HttpMethods,
        path: string,
        options: FetchEngine.CallOptions<H, P> & { payload?: unknown },
        controller: AbortController,
        timeout: ReturnType<typeof wait> | undefined
    ): Promise<FetchResponse<Res, H, P, ResHdr>> {

        const onAfterReq = (...args: any[]) => {

            timeout?.clear();
            options.onAfterReq?.apply(this, args as never);
        };

        const onError = (...args: any[]) => {

            timeout?.clear();
            options.onError?.apply(this, args as never);
        };

        // normalizedOpts IS the context - single source of truth
        const normalizedOpts = this.#makeRequestOptions(
            method,
            path,
            {
                ...options,
                onAfterReq,
                onError,
                controller
            }
        );

        // === Rate Limit Check ===
        // Rate limiting MUST come first - before any network activity or cache lookups
        // that might trigger background revalidation
        const rateLimitConfig = this.#resolveRateLimitConfig(method, path, normalizedOpts);

        if (rateLimitConfig !== null) {

            const rateLimitKey = rateLimitConfig.serializer!(normalizedOpts);
            const bucket = this.#getRateLimiter(
                rateLimitKey,
                rateLimitConfig.maxCalls!,
                rateLimitConfig.windowMs!
            );

            const snapshot = bucket.snapshot;
            const waitTimeMs = bucket.getWaitTimeMs(1);

            // Build event data once for reuse
            const rateLimitEventData = {
                ...normalizedOpts,
                key: rateLimitKey,
                currentTokens: snapshot.currentTokens,
                capacity: snapshot.capacity,
                waitTimeMs,
                nextAvailable: bucket.getNextAvailable(1),
            };

            if (waitTimeMs > 0) {

                // Rate limit exceeded - need to wait or reject
                if (!rateLimitConfig.waitForToken) {

                    // Reject immediately
                    this.emit('fetch-ratelimit-reject', rateLimitEventData as any);

                    timeout?.clear();

                    const err = new RateLimitError(
                        `Rate limit exceeded for ${rateLimitKey}. Try again in ${waitTimeMs}ms`,
                        rateLimitConfig.maxCalls!
                    );

                    throw err;
                }

                // Wait for token
                this.emit('fetch-ratelimit-wait', rateLimitEventData as any);

                // Call the onRateLimit callback if configured
                if (this.#rateLimit!.config?.onRateLimit) {

                    await this.#rateLimit!.config.onRateLimit(normalizedOpts, waitTimeMs);
                }

                // Wait and consume atomically, respecting abort signal
                const acquired = await bucket.waitAndConsume(1, {
                    abortController: controller,
                });

                if (!acquired) {

                    // Aborted while waiting
                    timeout?.clear();

                    const err = new FetchError('Request aborted while waiting for rate limit');
                    err.aborted = true;
                    err.method = method as HttpMethods;
                    err.path = path;
                    err.status = 0;
                    err.step = 'fetch';

                    throw err;
                }

                // Token acquired after waiting
                const postWaitSnapshot = bucket.snapshot;

                this.emit('fetch-ratelimit-acquire', {
                    ...normalizedOpts,
                    key: rateLimitKey,
                    currentTokens: postWaitSnapshot.currentTokens,
                    capacity: postWaitSnapshot.capacity,
                    waitTimeMs: 0,
                    nextAvailable: bucket.getNextAvailable(1),
                } as any);
            }
            else {

                // Token available immediately - consume it
                bucket.consume(1);

                // Get post-consumption snapshot for event data
                const postConsumeSnapshot = bucket.snapshot;

                this.emit('fetch-ratelimit-acquire', {
                    ...normalizedOpts,
                    key: rateLimitKey,
                    currentTokens: postConsumeSnapshot.currentTokens,
                    capacity: postConsumeSnapshot.capacity,
                    waitTimeMs: 0,
                    nextAvailable: bucket.getNextAvailable(1),
                } as any);
            }
        }

        // === Cache Check ===
        // normalizedOpts satisfies RequestKeyOptions - use it directly
        const cacheConfig = this.#resolveCacheConfig(method, path, normalizedOpts);
        let cacheKey: string | null = null;

        if (cacheConfig) {

            cacheKey = cacheConfig.serializer!(normalizedOpts);
            const cached = await this.#flight.getCache(cacheKey);

            if (cached) {

                const expiresIn = cached.expiresAt - Date.now();

                if (!cached.isStale) {

                    this.emit('fetch-cache-hit', {
                        ...normalizedOpts,
                        key: cacheKey,
                        isStale: false,
                        expiresIn,
                    } as any);

                    timeout?.clear();
                    return cached.value as FetchResponse<Res, H, P, ResHdr>;
                }

                // Stale - return immediately + background revalidation
                this.emit('fetch-cache-stale', {
                    ...normalizedOpts,
                    key: cacheKey,
                    isStale: true,
                    expiresIn,
                } as any);

                this.#triggerBackgroundRevalidation(method, path, options, cacheKey, cacheConfig);
                timeout?.clear();

                return cached.value as FetchResponse<Res, H, P, ResHdr>;
            }

            this.emit('fetch-cache-miss', {
                ...normalizedOpts,
                key: cacheKey,
            } as any);
        }

        // === Deduplication Check ===
        const dedupeConfig = this.#resolveDedupeConfig(method, path, normalizedOpts);
        let dedupeKey: string | null = null;
        let cleanup: (() => void) | null = null;

        if (dedupeConfig) {

            dedupeKey = dedupeConfig.serializer!(normalizedOpts);
            const inflight = this.#flight.getInflight(dedupeKey);

            if (inflight) {

                const waitingCount = this.#flight.joinInflight(dedupeKey);

                this.emit('fetch-dedupe-join', {
                    ...normalizedOpts,
                    key: dedupeKey,
                    waitingCount,
                } as any);

                return this.#awaitWithIndependentTimeout(
                    inflight.promise as Promise<FetchResponse<Res, H, P, ResHdr>>,
                    controller,
                    timeout,
                    normalizedOpts.method,
                    path
                );
            }

            this.emit('fetch-dedupe-start', {
                ...normalizedOpts,
                key: dedupeKey,
            } as any);
        }

        // === Execute Request ===
        // Use Deferred to register the promise BEFORE starting the request
        // This prevents race conditions where multiple concurrent requests
        // check getInflight() before any have called trackInflight()
        let deferred: Deferred<FetchResponse<Res, H, P, ResHdr>> | null = null;

        if (dedupeKey) {

            deferred = new Deferred<FetchResponse<Res, H, P, ResHdr>>();

            // Attach a no-op catch handler to prevent unhandled rejection warnings
            // when the promise is rejected but no one is listening (no joiners)
            deferred.promise.catch(() => { /* handled by the request flow */ });

            cleanup = this.#flight.trackInflight(dedupeKey, deferred.promise);
        }

        const requestPromise = this.#attemptCall<Res, ResHdr>(normalizedOpts);

        const [res, err] = await attempt(() => requestPromise);

        timeout?.clear();

        if (err) {

            deferred?.reject(err);
            cleanup?.();
            throw err;
        }

        deferred?.resolve(res);
        cleanup?.();

        if (cacheKey && cacheConfig) {

            await this.#flight.setCache(cacheKey, res, {
                ttl: cacheConfig.ttl,
                staleIn: cacheConfig.staleIn
            });

            this.#cache?.activeKeys.add(cacheKey);

            this.emit('fetch-cache-set', {
                ...normalizedOpts,
                key: cacheKey,
                expiresIn: cacheConfig.ttl,
            } as any);
        }

        return res;
    }


    /**
     * Awaits a shared promise with independent timeout/abort for the joiner.
     */
    #awaitWithIndependentTimeout<T>(
        sharedPromise: Promise<T>,
        controller: AbortController,
        timeout: ReturnType<typeof wait> | undefined,
        method: string,
        path: string
    ): Promise<T> {

        const deferred = new Deferred<T>();
        let isSettled = false;

        const settle = (fn: () => void) => {

            if (isSettled) return;
            isSettled = true;
            timeout?.clear();
            fn();
        };

        const createJoinerError = (message: string): FetchError => {

            const err = new FetchError(message);
            err.aborted = true;
            err.method = method as HttpMethods;
            err.path = path;
            err.status = 0;
            err.step = 'fetch';

            return err;
        };

        timeout?.then(() => {

            settle(() => deferred.reject(createJoinerError('Request timed out (joiner)')));
        });

        controller.signal.addEventListener('abort', () => {

            settle(() => deferred.reject(createJoinerError('Request aborted (joiner)')));
        }, { once: true });

        sharedPromise
            .then((value) => settle(() => deferred.resolve(value)))
            .catch((error) => settle(() => deferred.reject(error)));

        return deferred.promise;
    }


    /**
     * Triggers a background revalidation for stale-while-revalidate.
     * Fire and forget - errors are emitted as events, not propagated.
     */
    async #triggerBackgroundRevalidation<Res, ResHdr>(
        method: HttpMethods,
        path: string,
        options: FetchEngine.CallOptions<H, P> & { payload?: unknown },
        cacheKey: string,
        cacheConfig: CacheRule<S, H, P>
    ): Promise<void> {

        // Prevent multiple concurrent revalidations for the same key
        if (this.#cache?.revalidatingKeys.has(cacheKey)) {

            return;
        }

        this.#cache?.revalidatingKeys.add(cacheKey);

        // Build normalized options for the background request
        const controller = new AbortController();
        const normalizedOpts = this.#makeRequestOptions(method, path, {
            ...options,
            controller
        });

        this.emit('fetch-cache-revalidate', {
            ...normalizedOpts,
            key: cacheKey
        } as any);

        const [res, fetchErr] = await attempt(() =>
            this.#attemptCall<Res, ResHdr>(normalizedOpts)
        );

        this.#cache?.revalidatingKeys.delete(cacheKey);

        if (fetchErr) {

            this.emit('fetch-cache-revalidate-error', {
                ...normalizedOpts,
                key: cacheKey,
                error: fetchErr
            } as any);

            return;
        }

        const [, cacheErr] = await attempt(() => (

            this.#flight.setCache(cacheKey, res, {
                ttl: cacheConfig.ttl,
                staleIn: cacheConfig.staleIn
            })
        ));

        if (cacheErr) {

            this.emit('fetch-cache-revalidate-error', {
                ...normalizedOpts,
                key: cacheKey,
                error: cacheErr
            } as any);

            return;
        }

        this.#cache?.activeKeys.add(cacheKey);

        this.emit('fetch-cache-set', {
            ...normalizedOpts,
            key: cacheKey,
            expiresIn: cacheConfig.ttl
        } as any);
    }


    /**
     * Wraps a promise with AbortablePromise properties.
     */
    #wrapAsAbortable<T>(
        promise: Promise<unknown>,
        controller: AbortController
    ): FetchEngine.AbortablePromise<T> {

        const abortable = promise as FetchEngine.AbortablePromise<T>;

        Object.defineProperty(abortable, 'isAborted', {
            get: () => controller.signal.aborted,
        });

        abortable.isFinished = false;
        abortable.abort = (reason?: string) => controller.abort(reason);

        return abortable;
    }


    /**
     * Makes an OPTIONS request to check server capabilities.
     *
     * Convenience method for OPTIONS requests, commonly used for CORS
     * preflight checks and discovering server capabilities.
     *
     * @param path - Request path relative to base URL
     * @param options - Request options
     * @returns AbortablePromise that resolves to response data
     *
     * @example
     * const [capabilities, err] = await attempt(() =>
     *     api.options('/users')
     * );
     */
    options <Res = any, ResHdr = RH>(path: string, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, null, ResHdr>('options', path, options);
    }

    /**
     * Makes a GET request to retrieve data.
     *
     * Convenience method for GET requests, the most common HTTP method
     * for retrieving data from APIs. Returns an enhanced response object
     * containing parsed data, headers, status, and request context.
     *
     * @param path - Request path relative to base URL
     * @param options - Request options
     * @returns AbortablePromise that resolves to FetchResponse object
     *
     * @example
     * // Access full response details
     * const [response, err] = await attempt(() =>
     *     api.get('/users?page=1&limit=10')
     * );
     * if (err) return;
     *
     * console.log('Users:', response.data);
     * console.log('Status:', response.status);
     * console.log('Content-Type:', response.headers['content-type']);
     *
     * @example
     * // Destructure just the data
     * const { data: users } = await api.get('/users');
     */
    get <Res = any, ResHdr = RH>(path: string, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, null, ResHdr>('get', path, options);
    }

    /**
     * Makes a DELETE request to remove a resource.
     *
     * Convenience method for DELETE requests, typically used to remove
     * resources from the server.
     *
     * @param path - Request path relative to base URL
     * @param payload - Optional payload for the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to response data
     *
     * @example
     * const [result, err] = await attempt(() =>
     *     api.delete('/users/123')
     * );
     */
    delete <Res = any, Data = any, ResHdr = RH>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data, ResHdr>('delete', path, { ...options, payload });
    }

    /**
     * Makes a POST request to create a new resource.
     *
     * Convenience method for POST requests, typically used to create
     * new resources on the server. Returns an enhanced response object
     * containing parsed data, headers, status, and request context.
     *
     * @param path - Request path relative to base URL
     * @param payload - Data to send in the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to FetchResponse object
     *
     * @example
     * // Access full response details
     * const [response, err] = await attempt(() =>
     *     api.post('/users', {
     *         name: 'John Doe',
     *         email: 'john@example.com'
     *     })
     * );
     * if (err) return;
     *
     * console.log('Created user:', response.data);
     * console.log('Location header:', response.headers['location']);
     *
     * @example
     * // Destructure just the data
     * const { data: newUser } = await api.post('/users', userData);
     */
    post <Res = any, Data = any, ResHdr = RH>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data, ResHdr>('post', path, { ...options, payload });
    }

    /**
     * Makes a PUT request to replace a resource.
     *
     * Convenience method for PUT requests, typically used to completely
     * replace an existing resource on the server.
     *
     * @param path - Request path relative to base URL
     * @param payload - Data to send in the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to response data
     *
     * @example
     * const [updatedUser, err] = await attempt(() =>
     *     api.put('/users/123', {
     *         name: 'Jane Doe',
     *         email: 'jane@example.com'
     *     })
     * );
     */
    put <Res = any, Data = any, ResHdr = RH>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data, ResHdr>('put', path, { ...options, payload });
    }

    /**
     * Makes a PATCH request to partially update a resource.
     *
     * Convenience method for PATCH requests, typically used to partially
     * update an existing resource on the server.
     *
     * @param path - Request path relative to base URL
     * @param payload - Partial data to update in the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to response data
     *
     * @example
     * const [updatedUser, err] = await attempt(() =>
     *     api.patch('/users/123', {
     *         email: 'newemail@example.com'
     *     })
     * );
     */
    patch <Res = any, Data = any, ResHdr = RH>(path: string, payload: Data | null = null, options: FetchEngine.CallOptions<H, P> = {}) {

        return this.request <Res, Data, ResHdr>('patch', path, { ...options, payload });
    }

    /**
     * Adds headers to the FetchEngine instance for use in requests.
     *
     * Supports adding individual headers, multiple headers at once, and
     * method-specific headers. Headers can be added globally or for
     * specific HTTP methods to provide fine-grained control over
     * request headers.
     *
     * @param headers - Header name, object of headers, or header name with value
     * @param value - Header value (when adding single header)
     * @param method - Optional HTTP method for method-specific headers
     *
     * @example
     * // Add single header globally
     * api.addHeader('Authorization', 'Bearer token');
     *
     * // Add multiple headers globally
     * api.addHeader({
     *     'Content-Type': 'application/json',
     *     'X-API-Version': 'v1'
     * });
     *
     * // Add method-specific headers
     * api.addHeader('Content-Type', 'application/json', 'POST');
     * api.addHeader({
     *     'X-Request-ID': '123',
     *     'X-User-ID': '456'
     * }, 'GET');
     */
    addHeader<K extends keyof H>(name: K, value: H[K], method?: _InternalHttpMethods): void
    addHeader(name: string, value: string, method?: _InternalHttpMethods): void
    addHeader(headers: FetchEngine.Headers<H>, method?: _InternalHttpMethods): void
    addHeader(
        headers: (
            FetchEngine.Headers<H> |
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
        } as FetchEngine.Headers<H>;

        if (method) {

            if (this.#methodHeaders[method]) {
                updated = {
                    ...this.#methodHeaders[method]
                } as FetchEngine.Headers<H>;
            }
            else {
                this.#methodHeaders[method] = {};
            }
        }

        if (typeof headers === 'string') {

            updated[
                headers as keyof FetchEngine.Headers<H>
            ] = value as never;
        }
        else {

            Object
                .keys(headers)
                .forEach(
                    (name) => {

                        const key = name as keyof FetchEngine.Headers<H>;

                        updated[key] = headers[key as never]
                    }
                );
        }

        this.#validateHeaders(updated);

        if (method) {

            this.#methodHeaders[method] = updated;
        }
        else {

            this.#headers = updated;
        }

        this.emit('fetch-header-add', {
            state: this.#state,
            data: {
                headers,
                value,
                updated,
                method
            }
        });
    }

    /**
     * Removes headers from the FetchEngine instance.
     *
     * Supports removing individual headers, multiple headers at once, and
     * method-specific headers. Headers can be removed globally or for
     * specific HTTP methods to provide fine-grained control over
     * request headers.
     *
     * @param headers - Header name, array of header names, or object with header names
     * @param method - Optional HTTP method for method-specific header removal
     *
     * @example
     * // Remove single header globally
     * api.rmHeader('Authorization');
     *
     * // Remove multiple headers globally
     * api.rmHeader(['Content-Type', 'X-API-Version']);
     *
     * // Remove method-specific headers
     * api.rmHeader('Content-Type', 'POST');
     * api.rmHeader(['X-Request-ID', 'X-User-ID'], 'GET');
     *
     * // Remove headers by object reference
     * const headersToRemove = { 'Content-Type': true, 'Authorization': true };
     * api.rmHeader(headersToRemove);
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
                } as FetchEngine.Headers<H>;
            }
            else {
                this.#methodHeaders[method] = {};
            }
        }

        if (typeof headers === 'string') {

            delete updated[headers];
        }

        let _names = headers as (keyof FetchEngine.Headers<H>)[];

        if (!Array.isArray(headers)) {

            _names = Object.keys(headers);
        }

        for (const name of _names) {
            delete updated[name];
        }

        this.#validateHeaders(updated);

        if (method) {

            this.#methodHeaders[method] = updated;
        }
        else {

            this.#headers = updated;
        }

        this.emit('fetch-header-remove', {
            state: this.#state,
            data: {
                headers,
                updated,
                method,
            }
        });
    }

    /**
     * Checks if a header is configured for the FetchEngine instance.
     *
     * Determines whether a specific header exists in the global headers
     * or method-specific headers, allowing validation of header configuration.
     *
     * @param name - Header name to check
     * @param method - Optional HTTP method for method-specific header check
     * @returns True if the header exists, false otherwise
     *
     * @example
     * // Check global headers
     * if (api.hasHeader('Authorization')) {
     *     console.log('Auth header is configured');
     * }
     *
     * // Check method-specific headers
     * if (api.hasHeader('Content-Type', 'POST')) {
     *     console.log('POST requests have Content-Type header');
     * }
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
     * Adds parameters to the FetchEngine instance for use in request URLs.
     *
     * Supports adding individual parameters, multiple parameters at once, and
     * method-specific parameters. Parameters can be added globally or for
     * specific HTTP methods to provide fine-grained control over URL parameters.
     *
     * @param params - Parameter name, object of parameters, or parameter name with value
     * @param value - Parameter value (when adding single parameter)
     * @param method - Optional HTTP method for method-specific parameters
     *
     * @example
     * // Add single parameter globally
     * api.addParam('version', 'v1');
     *
     * // Add multiple parameters globally
     * api.addParam({
     *     'api_key': 'abc123',
     *     'format': 'json'
     * });
     *
     * // Add method-specific parameters
     * api.addParam('page', '1', 'GET');
     * api.addParam({
     *     'limit': '10',
     *     'sort': 'name'
     * }, 'GET');
     */
    addParam<K extends keyof P>(name: K, value: P[K], method?: _InternalHttpMethods): void
    addParam(name: string, value: string, method?: _InternalHttpMethods): void
    addParam(params: FetchEngine.Params<P>, method?: _InternalHttpMethods): void
    addParam(
        params: (
            FetchEngine.Params<P> |
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
        } as FetchEngine.Params<P>;

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
                params as keyof FetchEngine.Params<P>
            ] = value as never;
        }
        else {

            Object
                .keys(params)
                .forEach(
                    (name) => {

                        const key = name as keyof FetchEngine.Params<P>;

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

        this.emit('fetch-param-add', {
            state: this.#state,
            data: {
                params,
                value,
                updated,
                method
            }
        });
    }

    /**
     * Removes parameters from the FetchEngine instance.
     *
     * Supports removing individual parameters, multiple parameters at once, and
     * method-specific parameters. Parameters can be removed globally or for
     * specific HTTP methods to provide fine-grained control over URL parameters.
     *
     * @param params - Parameter name, array of parameter names, or object with parameter names
     * @param method - Optional HTTP method for method-specific parameter removal
     *
     * @example
     * // Remove single parameter globally
     * api.rmParams('version');
     *
     * // Remove multiple parameters globally
     * api.rmParams(['api_key', 'format']);
     *
     * // Remove method-specific parameters
     * api.rmParams('page', 'GET');
     * api.rmParams(['limit', 'sort'], 'GET');
     *
     * // Remove parameters by object reference
     * const paramsToRemove = { 'api_key': true, 'format': true };
     * api.rmParams(paramsToRemove);
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

        let _names = params as (keyof FetchEngine.Params<P>)[];

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

        this.emit('fetch-param-remove', {
            state: this.#state,
            data: {
                params,
                updated,
                method
            }
        });
    }

    /**
     * Checks if a parameter is configured for the FetchEngine instance.
     *
     * Determines whether a specific parameter exists in the global parameters
     * or method-specific parameters, allowing validation of parameter configuration.
     *
     * @param name - Parameter name to check
     * @param method - Optional HTTP method for method-specific parameter check
     * @returns True if the parameter exists, false otherwise
     *
     * @example
     * // Check global parameters
     * if (api.hasParam('version')) {
     *     console.log('Version parameter is configured');
     * }
     *
     * // Check method-specific parameters
     * if (api.hasParam('page', 'GET')) {
     *     console.log('GET requests have page parameter');
     * }
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
     * Updates the FetchEngine instance state with new values.
     *
     * Merges new state values into the existing state, supporting both
     * individual property updates and bulk object updates. State is used
     * to maintain request context across multiple API calls.
     *
     * @param conf - State property name or object with state updates
     * @param value - Value to set (when updating single property)
     *
     * @example
     * // Set single state property
     * api.setState('authToken', 'bearer-token-123');
     *
     * // Set multiple state properties
     * api.setState({
     *     userId: '123',
     *     sessionId: 'abc',
     *     preferences: { theme: 'dark' }
     * });
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

        this.emit('fetch-state-set', {
            state: updated,
            data: conf
        });
    }

    /**
     * Resets the FetchEngine instance state to an empty object.
     *
     * Clears all stored state values and dispatches a state reset event.
     * Useful for cleaning up state when switching between different
     * user sessions or contexts.
     *
     * @example
     * // Clear all state when user logs out
     * api.resetState();
     * console.log(api.getState()); // {}
     */
    resetState() {

        this.#state = {} as S;

        this.#validateState(this.#state);

        this.emit('fetch-state-reset', {
            state: this.#state,
        });
    }

    /**
     * Returns a deep clone of the FetchEngine instance state.
     *
     * Provides a safe copy of the current state that can be inspected
     * or modified without affecting the original state.
     *
     * @returns Deep clone of the current state object
     *
     * @example
     * const state = api.getState();
     * console.log('Current state:', state);
     * // { authToken: 'bearer-123', userId: '456' }
     */
    getState() {

        return clone(this.#state);
    }

    /**
     * Changes the base URL for this FetchEngine instance.
     *
     * Updates the base URL used for all subsequent requests and dispatches
     * a URL change event. Useful for switching between different API
     * environments (development, staging, production).
     *
     * @param url - New base URL for the FetchEngine instance
     *
     * @example
     * // Switch to production API
     * api.changeBaseUrl('https://api.production.com');
     *
     * // Switch to staging API
     * api.changeBaseUrl('https://api.staging.com');
     */
    changeBaseUrl(url: string) {

        this.#baseUrl = new URL(url);

        this.emit('fetch-url-change', {
            state: this.#state,
            data: url
        });
    }

    /**
     * Updates the modifyOptions function for this FetchEngine instance.
     *
     * Changes the global options modification function that is applied to all
     * requests before they are sent. Pass undefined to clear the function.
     * Dispatches a modify options change event when updated.
     *
     * @param fn - New modifyOptions function or undefined to clear
     *
     * @example
     * // Set a global request modifier
     * api.changeModifyOptions((opts, state) => {
     *     opts.headers = { ...opts.headers, 'X-Request-ID': crypto.randomUUID() };
     *     return opts;
     * });
     *
     * // Clear the modifier
     * api.changeModifyOptions(undefined);
     */
    changeModifyOptions(fn?: FetchEngine.ModifyOptionsFn<H, P, S>) {

        this.#modifyOptions = fn;

        this.emit('fetch-modify-options-change', {
            state: this.#state,
            data: fn
        });
    }

    /**
     * Updates the modifyOptions function for a specific HTTP method.
     *
     * Changes the method-specific options modification function that is applied
     * to requests of the specified HTTP method before they are sent. Pass undefined
     * to clear the function for that method. Dispatches a modify method options
     * change event when updated.
     *
     * @param method - HTTP method to modify options for
     * @param fn - New modifyOptions function or undefined to clear
     *
     * @example
     * // Set a POST-specific request modifier
     * api.changeModifyMethodOptions('POST', (opts, state) => {
     *     opts.headers = { ...opts.headers, 'Content-Type': 'application/json' };
     *     return opts;
     * });
     *
     * // Clear the POST modifier
     * api.changeModifyMethodOptions('POST', undefined);
     */
    changeModifyMethodOptions(method: HttpMethods, fn?: FetchEngine.ModifyOptionsFn<H, P, S>) {

        const normalizedMethod = method.toUpperCase() as _InternalHttpMethods;

        if (!this.#modifyMethodOptions) {

            this.#modifyMethodOptions = {};
        }

        if (fn === undefined) {

            delete this.#modifyMethodOptions[normalizedMethod];
        }
        else {

            this.#modifyMethodOptions[normalizedMethod] = fn;
        }

        this.emit('fetch-modify-method-options-change', {
            state: this.#state,
            data: {
                method: normalizedMethod,
                fn
            }
        });
    }

    // Note: on() and off() are inherited from ObserverEngine
    // Use this.on('fetch-error', handler) or this.on(/fetch-.*/, handler) for wildcard

    // === Cache Invalidation API ===

    /**
     * Clears all cached responses.
     *
     * Removes all entries from the response cache. Does not affect
     * in-flight requests tracked for deduplication.
     *
     * @example
     * // Clear cache after user logout
     * api.clearCache();
     */
    async clearCache(): Promise<void> {

        await this.#flight.clearCache();
        this.#cache?.activeKeys.clear();
    }

    /**
     * Deletes a specific cache entry by key.
     *
     * Use this when you know the exact cache key (e.g., from a cache event).
     *
     * @param key - The cache key to delete
     * @returns true if the entry existed and was deleted
     *
     * @example
     * // Delete specific cached response
     * await api.deleteCache('GET|/users/123|undefined|{}');
     */
    async deleteCache(key: string): Promise<boolean> {

        const deleted = await this.#flight.deleteCache(key);

        if (deleted) {

            this.#cache?.activeKeys.delete(key);
        }

        return deleted;
    }

    /**
     * Invalidates cache entries matching a predicate function.
     *
     * Iterates through all cache keys and deletes entries where the
     * predicate returns true. Useful for targeted invalidation based
     * on custom logic.
     *
     * @param predicate - Function that returns true for keys to invalidate
     * @returns Number of entries invalidated
     *
     * @example
     * // Invalidate all user-related cache entries
     * const count = await api.invalidateCache(key => key.includes('/users'));
     * console.log(`Invalidated ${count} entries`);
     */
    async invalidateCache(predicate: (key: string) => boolean): Promise<number> {

        let invalidated = 0;

        for (const key of this.#cache?.activeKeys ?? []) {

            if (predicate(key)) {

                const deleted = await this.#flight.deleteCache(key);

                if (deleted) {

                    this.#cache?.activeKeys.delete(key);
                    invalidated++;
                }
            }
        }

        return invalidated;
    }

    /**
     * Invalidates cache entries matching a path pattern.
     *
     * Convenience method for invalidating cache based on URL path patterns.
     * Supports both string prefix matching and RegExp patterns.
     *
     * @param pattern - String prefix or RegExp to match against paths in cache keys
     * @returns Number of entries invalidated
     *
     * @example
     * // Invalidate all entries for a specific endpoint
     * await api.invalidatePath('/users');
     *
     * @example
     * // Invalidate using regex pattern
     * await api.invalidatePath(/\/api\/v[12]\//);
     */
    async invalidatePath(pattern: string | RegExp): Promise<number> {

        const isRegex = pattern instanceof RegExp;

        return this.invalidateCache((key) => {

            // Cache keys are serialized as: METHOD|/path|payload|headers
            // Extract the path portion (second segment after first |)
            const pipeIndex = key.indexOf('|');

            if (pipeIndex === -1) return false;

            // Find the next pipe after the method
            const secondPipeIndex = key.indexOf('|', pipeIndex + 1);
            const path = secondPipeIndex === -1
                ? key.slice(pipeIndex + 1)
                : key.slice(pipeIndex + 1, secondPipeIndex);

            if (!path) return false;

            if (isRegex) {

                return pattern.test(path);
            }

            return path.startsWith(pattern);
        });
    }

    /**
     * Returns statistics about the cache state.
     *
     * Provides insight into cache usage and effectiveness.
     *
     * @returns Object with cache size and in-flight count
     *
     * @example
     * const stats = api.cacheStats();
     * console.log(`Cache entries: ${stats.cacheSize}`);
     * console.log(`In-flight requests: ${stats.inflightCount}`);
     */
    cacheStats(): { cacheSize: number; inflightCount: number } {

        return this.#flight.stats();
    }

    /**
     * Destroys the FetchEngine instance and cleans up all resources.
     *
     * Marks the instance as destroyed and clears internal state references.
     * After calling destroy(), the instance should not be used for new requests.
     *
     * **Memory Leak Prevention:**
     * - Prevents new requests from being made (throws error if attempted)
     * - Clears all event listeners via ObserverEngine's clear()
     * - Clears internal state references
     * - Marks instance as destroyed
     *
     * @example
     * const api = new FetchEngine({ baseUrl: 'https://api.example.com' });
     *
     * api.on('fetch-error', (data) => console.error(data.error));
     * api.on('fetch-response', (data) => console.log(data));
     *
     * // destroy() automatically clears all listeners
     * api.destroy();
     */
    destroy() {

        if (this.#destroyed) {

            console.warn('FetchEngine instance already destroyed');
            return;
        }

        // Abort any ongoing requests first (this sets #destroyed to true via the getter)
        this.#instanceAbortController.abort();

        // Clear all event listeners via ObserverEngine
        this.clear();

        // Reset the flight controller to clear cache and inflight tracking
        // This is synchronous and creates a new SingleFlight instance
        this.#flight = new SingleFlight();

        // Clear all internal references to allow garbage collection
        this.#state = {} as S;
        this.#headers = {} as FetchEngine.Headers<H>;
        this.#methodHeaders = {};
        this.#params = {} as FetchEngine.Params<P>;
        this.#methodParams = {};
        this.#options = {};
        this.#baseUrl = new URL('about:blank');

        // Clear function references (closures may capture large data)
        this.#modifyOptions = undefined;
        this.#modifyMethodOptions = undefined as never;
        this.#validate = undefined;

        // Clear retry config
        this.#retry = undefined as never;

        // Clear rate limiting state
        this.#rateLimit = null;
        this.#cache = null;
        this.#dedupe = null;
    }

    /**
     * Checks if the FetchEngine instance has been destroyed.
     *
     * @returns true if destroy() has been called
     *
     * @example
     * if (!api.isDestroyed()) {
     *     await api.get('/users');
     * }
     */
    isDestroyed(): boolean {

        return this.#destroyed;
    }
}
