import {
    attempt,
    wait,
    SingleFlight,
    Deferred,
    assert,
    generateId,
} from '@logosdx/utils';

import type {
    HttpMethods,
    _InternalHttpMethods,
    FetchResponse,
    RetryConfig,
    CacheRule,
    DictAndT,
    FetchConfig,
} from '../types.ts';

import type { EngineRequestConfig, CallConfig } from '../options/types.ts';

import { FetchError, DEFAULT_RETRY_CONFIG } from '../helpers/index.ts';

import { DedupePolicy } from '../policies/dedupe.ts';
import { CachePolicy } from '../policies/cache.ts';
import { RateLimitPolicy } from '../policies/rate-limit.ts';

import type { FetchEngineCore, InternalReqOptions } from './types.ts';


// CallOptions removed - using CallConfig from options/types.ts


/**
 * Promise that can be aborted.
 */
interface AbortablePromise<T> extends Promise<T> {
    isFinished: boolean;
    isAborted: boolean;
    abort(reason?: string): void;
}

/**
 * Handles request execution with retry logic, timeouts, and policy integration.
 *
 * The RequestExecutor is the core request processing engine, responsible for:
 * - Building normalized request options from method/path/options
 * - Executing requests with retry logic and timeout handling
 * - Coordinating with policies (dedupe, cache, rate-limit)
 * - Managing SingleFlight for deduplication and caching
 *
 * All policies receive this executor and access the engine through `executor.engine`.
 * This provides policies access to `engine.emit()` for type-safe event emission.
 *
 * @template S - Instance state type
 * @template H - Headers type
 * @template P - Params type
 *
 * @example
 * ```typescript
 * const executor = new RequestExecutor(engine);
 *
 * // Policies access engine through executor
 * executor.engine.emit('cache-hit', { key: '...', ... });
 *
 * // Execute a request
 * const response = await executor.execute('GET', '/users', options);
 * ```
 */
export class RequestExecutor<
    H = unknown,
    P = unknown,
    S = unknown
> {

    /** Reference to the FetchEngine instance (public for policy access) */
    engine: FetchEngineCore<H, P, S>;

    /** SingleFlight for deduplication and caching */
    flight: SingleFlight<unknown>;

    /** Deduplication policy */
    dedupePolicy: DedupePolicy<H, P, S>;

    /** Cache policy */
    cachePolicy: CachePolicy<H, P, S>;

    /** Rate limit policy */
    rateLimitPolicy: RateLimitPolicy<H, P, S>;

    constructor(engine: FetchEngineCore<H, P, S>) {

        this.engine = engine;
        this.flight = new SingleFlight<unknown>();

        // Policies receive this executor - they access engine through executor.engine
        this.dedupePolicy = new DedupePolicy(this);
        this.cachePolicy = new CachePolicy(this);
        this.rateLimitPolicy = new RateLimitPolicy();
    }

    /**
     * Get retry configuration from engine options.
     */
    get retryConfig(): Required<RetryConfig> {

        const config = this.engine.config.get('retry');

        // retry: false explicitly disables retry
        if (config === false) {

            return { ...DEFAULT_RETRY_CONFIG, maxAttempts: 0 };
        }

        // retry: undefined or true uses defaults
        if (!config || config === true) {

            return DEFAULT_RETRY_CONFIG;
        }

        return { ...DEFAULT_RETRY_CONFIG, ...(config as RetryConfig) } as Required<RetryConfig>;
    }

    /**
     * Get base URL from engine options.
     */
    get baseUrl(): string {

        return this.engine.config.get('baseUrl');
    }

    /**
     * Get default type from engine options.
     */
    get defaultType(): 'json' | 'text' | 'blob' | 'arrayBuffer' {

        return (this.engine.config.get('defaultType') as string || 'json') as 'json' | 'text' | 'blob' | 'arrayBuffer';
    }

    // =====================================================================
    // PUBLIC API - Entry points for FetchEngine HTTP methods
    // =====================================================================

    /**
     * Execute a request with the full lifecycle: timeout, options building, policies, fetch.
     *
     * This is the main entry point called by FetchEngine HTTP methods.
     *
     * @param method - HTTP method
     * @param path - Request path
     * @param payloadOrOptions - Payload (for POST/PUT/PATCH) or options
     * @param options - Call options
     * @returns AbortablePromise with FetchResponse
     */
    execute<Res = unknown, Data = unknown, ResHdr = unknown>(
        method: HttpMethods,
        path: string,
        payloadOrOptions?: Data | CallConfig<H, P>,
        options?: CallConfig<H, P>
    ): AbortablePromise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>> {

        // Normalize arguments: POST/PUT/PATCH/DELETE have payload, GET/OPTIONS don't
        let payload: Data | undefined;
        let opts: CallConfig<H, P>;

        if (options !== undefined) {

            payload = payloadOrOptions as Data;
            opts = options;
        }
        else if (payloadOrOptions && typeof payloadOrOptions === 'object' && !Array.isArray(payloadOrOptions)) {

            // Check if it's call options or payload
            const hasCallOptionKeys = 'headers' in payloadOrOptions ||
                'params' in payloadOrOptions ||
                'timeout' in payloadOrOptions ||
                'retry' in payloadOrOptions ||
                'abortController' in payloadOrOptions ||
                'stream' in payloadOrOptions ||
                'onError' in payloadOrOptions ||
                'onBeforeReq' in payloadOrOptions ||
                'onAfterReq' in payloadOrOptions;

            if (hasCallOptionKeys && !/POST|PUT|PATCH|DELETE/i.test(method)) {

                opts = payloadOrOptions as CallConfig<H, P>;
            }
            else {

                payload = payloadOrOptions as Data;
                opts = {};
            }
        }
        else {

            payload = payloadOrOptions as Data;
            opts = {};
        }

        const controller = opts.abortController ?? new AbortController();

        // Resolve timeout options
        const totalTimeoutMs = opts.totalTimeout ?? opts.timeout ?? this.engine.config.get('totalTimeout');
        const attemptTimeoutMs = opts.attemptTimeout ?? this.engine.config.get('attemptTimeout');

        if (typeof totalTimeoutMs === 'number') {

            assert(totalTimeoutMs >= 0, 'totalTimeout must be non-negative number');
        }

        if (typeof attemptTimeoutMs === 'number') {

            assert(attemptTimeoutMs >= 0, 'attemptTimeout must be non-negative number');
        }

        // Track if totalTimeout fires
        let totalTimeoutFired = false;

        // Set up totalTimeout
        const totalTimeout = typeof totalTimeoutMs === 'number' ? wait(totalTimeoutMs) : undefined;

        totalTimeout?.then(() => {

            totalTimeoutFired = true;
            controller.abort();
        });

        // Execute async logic
        const promise = this.#executeWithOptions<Res, ResHdr>(
            method,
            path,
            payload,
            opts,
            controller,
            totalTimeout,
            attemptTimeoutMs,
            () => totalTimeoutFired
        );

        // Wrap as AbortablePromise
        return this.#wrapAsAbortable<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>(
            promise,
            controller
        );
    }

    /**
     * Internal method that builds options and executes the request.
     */
    async #executeWithOptions<Res, ResHdr>(
        method: HttpMethods,
        path: string,
        payload: unknown,
        options: CallConfig<H, P>,
        controller: AbortController,
        totalTimeout: ReturnType<typeof wait> | undefined,
        attemptTimeoutMs: number | undefined,
        getTotalTimeoutFired: () => boolean
    ): Promise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>> {

        const onAfterReq = (...args: any[]) => {

            totalTimeout?.clear();
            options.onAfterReq?.apply(this, args as never);
        };

        const onError = (...args: any[]) => {

            totalTimeout?.clear();
            options.onError?.apply(this, args as never);
        };

        // Build normalized options
        const normalizedOpts = this.makeRequestOptions(
            method,
            path,
            {
                ...options,
                payload,
                controller,
                onAfterReq,
                onError,
                attemptTimeout: attemptTimeoutMs,
                getTotalTimeoutFired
            }
        );

        return this.executeRequest<Res, ResHdr>(normalizedOpts, totalTimeout);
    }

    /**
     * Build normalized request options from method/path/options.
     *
     * @param method - HTTP method
     * @param path - Request path
     * @param options - Call options with payload and controller
     * @returns Normalized InternalReqOptions
     */
    makeRequestOptions(
        _method: HttpMethods,
        path: string,
        options: CallConfig<H, P> & {
            payload?: unknown;
            controller: AbortController;
            attemptTimeout?: number | undefined;
            getTotalTimeoutFired?: (() => boolean) | undefined;
        }
    ): InternalReqOptions<H, P, S> {

        const {
            payload,
            controller,
            onAfterReq: onAfterRequest,
            onBeforeReq: onBeforeRequest,
            onError,
            timeout = this.engine.config.get('totalTimeout') as number | undefined,
            attemptTimeout,
            getTotalTimeoutFired,
            params: requestParams,
            signal,
            determineType,
            retry,
            stream,
            requestId: perRequestId,
            headers: requestHeaders,
            // RequestInit options (per-request overrides config defaults)
            ...perRequestInit
        } = options;

        const method = _method.toUpperCase() as _InternalHttpMethods;
        const state = this.engine.state.get();

        // Build URL with merged params
        const url = this.#makeUrl(path, requestParams, method);

        // Merge headers
        let headers = this.engine.headerStore.resolve(method, requestHeaders) as DictAndT<H>;

        // Build body for mutating methods
        let body: BodyInit | undefined;
        const type = this.defaultType;

        if (/put|post|patch|delete/i.test(method)) {

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

                body = JSON.stringify(payload);
            }
            else if (payload !== null && payload !== undefined) {

                body = payload as BodyInit;
            }
        }

        // Build opts for modifyConfig - include RequestInit options from config + per-request
        const config = this.engine.config.get();

        let opts: EngineRequestConfig<H, P> = {
            // RequestInit options from config (credentials, mode, cache, etc.)
            ...config,
            // Per-request RequestInit overrides
            ...perRequestInit,
            // Explicit values
            method,
            signal: signal || controller.signal,
            controller,
            headers,
            body: body ?? null,
            totalTimeout: timeout,
            retry,
        };

        // Apply global modifyConfig
        const modifyConfig = this.engine.config.get('modifyConfig');

        if (modifyConfig) {

            opts = modifyConfig(opts, state) as EngineRequestConfig<H, P>;
        }

        // Apply method-specific modifyConfig
        const modifyMethodConfig = this.engine.config.get('modifyMethodConfig');
        const methodSpecificModify = modifyMethodConfig?.[method];

        if (methodSpecificModify) {

            opts = methodSpecificModify(opts, state) as EngineRequestConfig<H, P>;
        }

        // Extract final values after modification
        headers = (opts.headers || {}) as DictAndT<H>;
        body = opts.body ?? undefined;

        // Per-request validation
        const validate = this.engine.config.get('validate');

        if (validate?.perRequest?.headers && validate.headers) {

            validate.headers(headers, method);
        }

        // Normalize retry (convert true to {}, false to maxAttempts: 0)
        const normalizedRetry = opts.retry === true
            ? {}
            : (opts.retry === false ? { maxAttempts: 0 } : opts.retry);

        // Generate request ID for tracing across all events
        const generateRequestId = this.engine.config.get('generateRequestId');
        const requestId = perRequestId || (generateRequestId ? generateRequestId() : generateId());

        const requestIdHeader = this.engine.config.get('requestIdHeader');

        if (requestIdHeader) {

            headers = { ...headers, [requestIdHeader]: requestId } as DictAndT<H>;
        }

        // Return normalized options
        // opts now contains all RequestInit options (config + per-request + modifyConfig)
        return {
            // Spread opts to get all RequestInit options after modifyConfig
            ...opts,
            // Explicit values (override anything from opts)
            stream,
            requestId,
            method,
            path,
            payload,
            headers,
            params: Object.fromEntries(url.searchParams.entries()) as DictAndT<P>,
            state,
            url,
            signal: opts.signal || controller.signal,
            controller,
            body,
            timeout: opts.totalTimeout,
            attemptTimeout,
            getTotalTimeoutFired,
            retry: normalizedRetry,
            determineType: determineType as InternalReqOptions<H, P, S>['determineType'],
            onBeforeRequest: onBeforeRequest as InternalReqOptions<H, P, S>['onBeforeRequest'],
            onAfterRequest: onAfterRequest as InternalReqOptions<H, P, S>['onAfterRequest'],
            onError: onError as InternalReqOptions<H, P, S>['onError'],
        };
    }

    /**
     * Build URL from path and params.
     */
    #makeUrl(path: string, requestParams?: DictAndT<P>, method?: HttpMethods): URL {

        const params = this.engine.paramStore.resolve(
            method || 'GET',
            requestParams
        ) as DictAndT<P>;

        if (path.startsWith('http')) {

            const url = new URL(path);

            Object.entries(params).forEach(([key, value]) => {

                url.searchParams.set(key, value as string);
            });

            return url;
        }

        path = path?.replace(/^\/{1,}/, '');

        if (path[0] !== '/') {

            path = `/${path}`;
        }

        const baseUrl = this.baseUrl.replace(/\/$/, '');
        const url = new URL(baseUrl + path);

        for (const [key, value] of Object.entries(params)) {

            url.searchParams.set(key, value as string);
        }

        // Per-request param validation
        const validate = this.engine.config.get('validate');

        if (validate?.perRequest?.params && validate.params) {

            validate.params(
                Object.fromEntries(url.searchParams.entries()) as DictAndT<P>,
                method as _InternalHttpMethods | undefined
            );
        }

        return url;
    }

    /**
     * Wrap a promise as an AbortablePromise.
     */
    #wrapAsAbortable<T>(promise: Promise<T>, controller: AbortController): AbortablePromise<T> {

        const abortable = promise as AbortablePromise<T>;

        abortable.isFinished = false;
        abortable.isAborted = false;

        // Listen to abort signal to update isAborted when aborted externally
        controller.signal.addEventListener('abort', () => {

            abortable.isAborted = true;
        }, { once: true });

        abortable.abort = (reason?: string) => {

            abortable.isAborted = true;
            controller.abort(reason);
        };

        promise.then(() => {

            abortable.isFinished = true;
        }).catch(() => {

            // Only set isFinished if not aborted
            if (!abortable.isAborted) {

                abortable.isFinished = true;
            }
        });

        return abortable;
    }

    // =====================================================================
    // INTERNAL METHODS
    // =====================================================================

    /**
     * Calculate delay for retry attempt using exponential backoff.
     *
     * @param attemptNo - Current attempt number (1-based)
     * @param retry - Retry configuration with delay settings
     * @returns Delay in milliseconds before next retry attempt
     */
    calculateRetryDelay(attemptNo: number, retry: Required<RetryConfig>): number {

        const { baseDelay, maxDelay, useExponentialBackoff } = retry;

        if (!useExponentialBackoff) return Math.min(baseDelay, maxDelay!);

        const delay = baseDelay * Math.pow(2, attemptNo - 1);

        return Math.min(delay, maxDelay!);
    }

    /**
     * Determine response type based on content-type header.
     *
     * @param response - Fetch response
     * @returns Type, isJson flag, and whether the content-type is recognized
     */
    determineType(response: Response): { type: 'json' | 'text' | 'blob' | 'arrayBuffer'; isJson: boolean; isRecognized: boolean } {

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {

            return { type: 'json', isJson: true, isRecognized: true };
        }

        if (contentType.includes('text/')) {

            return { type: 'text', isJson: false, isRecognized: true };
        }

        // Default to configured type for unknown content-types
        return { type: this.defaultType, isJson: false, isRecognized: false };
    }

    /**
     * Extract retry configuration from request options.
     */
    #extractRetry(opts: InternalReqOptions<H, P, S>): RetryConfig | undefined {

        // retry is already normalized (true converted to {} in makeRequestOptions)
        return opts.retry;
    }

    /**
     * Handle errors with proper event emission and error formatting.
     */
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

        let err = error as FetchError<{}, DictAndT<H>>;

        if (step === 'fetch') {

            err = new FetchError(err.message) as FetchError<{}, DictAndT<H>>;

            err.status = 499;
            err.message = err.message || 'Fetch error';
        }

        if (step === 'parse') {

            err = new FetchError(err.message) as FetchError<{}, DictAndT<H>>;

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

                err = new FetchError(`${errCode}: ${msgs}`) as FetchError<{}, DictAndT<H>>;
            }
            else {

                err = new FetchError(error.message) as FetchError<{}, DictAndT<H>>;
            }
        }

        err.requestId = normalizedOpts.requestId;
        err.attempt = attemptNum;
        err.status = err.status || status!;
        err.method = err.method || method!;
        err.path = err.path || path!;
        err.aborted = err.aborted || aborted;
        err.data = err.data || data as null;
        err.step = err.step || step;
        err.headers = err.headers || headers;

        // Emit error event with normalizedOpts as base
        const eventData = {
            ...normalizedOpts,
            error: err,
            step,
            status,
            aborted,
            data,
            requestEnd: Date.now()
        };

        if (aborted) {

            this.engine.emit('abort', eventData);
        }
        else {

            this.engine.emit('error', eventData);
        }

        onError && onError(err);

        throw err;
    }

    /**
     * Makes an API call using fetch and returns enhanced response object.
     *
     * @param options - Flat normalized request options (InternalReqOptions)
     * @returns FetchResponse object with data, headers, status, request, and config
     */
    async makeCall<Res, ResHdr = unknown>(
        options: InternalReqOptions<H, P, S>
    ): Promise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>> {

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
            onAfterRequest,

            // RequestInit options (rest spread)
            ...requestInit
        } = options;

        // Emit before event
        this.engine.emit('before-request', options);

        // Build RequestOpts for callbacks (legacy compatibility)
        const callbackOpts = {
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

        // Build fetch options - spread RequestInit options, then our explicit overrides
        const fetchOpts: RequestInit = {
            ...requestInit,
            method,
            signal,
            headers: reqHeaders as HeadersInit,
            body: body ?? null,
        };

        const [response, resErr] = await attempt(async () => {

            return await fetch(url, fetchOpts) as Response;
        });

        // Fetch will only throw if the request is aborted, denied, timed out, etc.
        if (resErr) {

            this.#handleError(options, {
                error: resErr,
                step: 'fetch'
            });

            throw resErr;
        }

        this.engine.emit('after-request', {
            ...options,
            // Clone response if after-request listeners exist
            // to prevent body stream locking issues, allow multiple
            // reads, and copying an entire body stream into memory.
            response: (
                this.engine.$has('after-request') ?
                response.clone() :
                response
            ),
        });

        onAfterRequest && await onAfterRequest(response.clone(), callbackOpts);

        // Stream mode: return raw Response without body parsing.
        // Non-ok statuses are returned as-is — the consumer checks status.
        if (options.stream) {

            const responseHeaders = {} as Partial<ResHdr>;

            response.headers.forEach((value, key) => {

                responseHeaders[key as keyof ResHdr] = value as ResHdr[keyof ResHdr];
            });

            this.engine.emit('response', {
                ...options,
                response,
                data: response,
                status: response.status,
                requestEnd: Date.now()
            });

            const config: FetchConfig<DictAndT<H>, DictAndT<P>> = {
                baseUrl: this.baseUrl.toString(),
                attemptTimeout: options.attemptTimeout,
                method,
                headers: reqHeaders,
                params,
                retry: this.retryConfig,
                determineType,
            };

            return {
                data: response as unknown as Res,
                headers: responseHeaders,
                status: response.status,
                request: new Request(url, fetchOpts),
                config
            };
        }

        const [data, parseErr] = await attempt(async () => {

            const typeResult = determineType
                ? determineType(response)
                : this.determineType(response);

            const { type, isJson } = typeResult;

            // Custom determineType may not return isRecognized, default to true if not provided
            const isRecognized = 'isRecognized' in typeResult ? (typeResult as any).isRecognized : true;

            // Handle 204 No Content - always return null regardless of content-type
            if (response.status === 204) {

                return null;
            }

            if (isJson) {

                const text = await response.text();

                if (text) {

                    return JSON.parse(text) as Res;
                }

                return null;
            }
            else if (isRecognized) {

                // Known non-JSON content-type (e.g., text/*)
                return await response[type]() as Res;
            }
            else {

                // Unknown content-type - try text first to check if body exists
                const text = await response.text();

                if (text) {

                    // Has content but unknown content-type - try default parsing
                    if (type === 'json') {

                        return JSON.parse(text) as Res;
                    }

                    return text as Res;
                }

                // Empty body with unknown content-type - throw parse error
                throw new Error(`Unknown content-type: ${response.headers.get('content-type')}`);
            }
        });

        if (parseErr) {

            this.#handleError(options, {
                error: parseErr,
                step: 'parse',
                status: response.status,
                data
            });

            throw parseErr;
        }

        if (response.ok === false) {

            this.#handleError(options, {
                error: new FetchError(response.statusText),
                step: 'response',
                status: response.status,
                data
            });

            throw new FetchError(response.statusText);
        }

        // Emit response event
        this.engine.emit('response', {
            ...options,
            response,
            data,
            requestEnd: Date.now()
        });

        const config: FetchConfig<DictAndT<H>, DictAndT<P>> = {
            baseUrl: this.baseUrl.toString(),
            attemptTimeout: options.attemptTimeout,
            method,
            headers: reqHeaders,
            params: params,
            retry: this.retryConfig,
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
        };
    }

    /**
     * Attempts a call with retry logic.
     *
     * @param options - Normalized request options
     * @returns Response from successful attempt
     */
    async attemptCall<Res, ResHdr = unknown>(
        options: InternalReqOptions<H, P, S>
    ): Promise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>> {

        const mergedRetry = {
            ...this.retryConfig,
            ...this.#extractRetry(options)
        };

        if (mergedRetry.maxAttempts === 0) {

            const [result, err] = await attempt(
                async () => this.makeCall<Res, ResHdr>(options)
            );

            if (err) {

                // Set timedOut flag if the abort was caused by totalTimeout
                if ((err as FetchError).aborted && options.getTotalTimeoutFired?.()) {

                    (err as FetchError).timedOut = true;
                }

                throw err;
            }

            return result;
        }

        let _attempt = 1;
        let lastError: FetchError<{}, DictAndT<H>> | undefined;

        while (_attempt <= mergedRetry.maxAttempts!) {

            // Check if parent (totalTimeout) already aborted - stop retrying
            if (options.controller.signal.aborted) {

                const err = lastError ?? new FetchError('Request aborted');
                err.aborted = true;
                err.method = err.method || options.method;
                err.path = err.path || options.path;
                err.status = err.status || 499;
                err.step = err.step || 'fetch';
                err.timedOut = options.getTotalTimeoutFired?.() ?? false;
                throw err;
            }

            // Create child controller for this attempt if using attemptTimeout
            let attemptController: AbortController;
            let attemptTimeoutPromise: ReturnType<typeof wait> | undefined;
            let attemptTimeoutFired = false;

            if (options.attemptTimeout !== undefined) {

                attemptController = new AbortController();

                // Link child to parent - if parent aborts, child aborts
                options.controller.signal.addEventListener('abort', () => {

                    attemptTimeoutPromise?.clear();
                    attemptController.abort();
                }, { once: true });

                // Set up per-attempt timeout
                attemptTimeoutPromise = wait(options.attemptTimeout);
                attemptTimeoutPromise.then(() => {

                    attemptTimeoutFired = true;
                    attemptController.abort();
                });
            }
            else {

                attemptController = options.controller;
            }

            const [result, err] = await attempt(
                async () => (
                    this.makeCall<Res, ResHdr>({
                        ...options,
                        controller: attemptController,
                        signal: attemptController.signal,
                        attempt: _attempt
                    })
                )
            );

            // Always cleanup attempt timeout (success or failure)
            attemptTimeoutPromise?.clear();

            if (err === null) {

                return result;
            }

            lastError = err as FetchError<{}, DictAndT<H>>;

            // Set timedOut flag only when a timeout actually fired
            if (lastError!.aborted) {

                const totalTimeoutFired = options.getTotalTimeoutFired?.() ?? false;

                if (attemptTimeoutFired || totalTimeoutFired) {

                    lastError!.timedOut = true;
                }
            }

            // If parent controller aborted (totalTimeout), don't retry
            if (options.controller.signal.aborted) {

                throw lastError!;
            }

            // Check if we should retry
            const shouldRetry = await mergedRetry.shouldRetry(lastError!, _attempt);

            if (shouldRetry && _attempt < mergedRetry.maxAttempts!) {

                // If shouldRetry is a number, use it as the delay
                const delay = (
                    typeof shouldRetry === 'number' ?
                    shouldRetry :
                    this.calculateRetryDelay(_attempt, mergedRetry)
                );

                this.engine.emit('retry', {
                    ...options,
                    error: lastError,
                    attempt: _attempt,
                    nextAttempt: _attempt + 1,
                    delay
                });

                await wait(delay);

                // Check if parent controller aborted during the delay
                if (options.controller.signal.aborted) {

                    // Update timedOut flag if totalTimeout fired during delay
                    if (options.getTotalTimeoutFired?.()) {

                        lastError!.timedOut = true;
                    }

                    throw lastError!;
                }

                _attempt++;
                continue;
            }

            throw lastError!;
        }

        // This should never be reached
        throw new FetchError('Unexpected end of retry logic');
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
     *
     * @param method - HTTP method
     * @param path - Request path
     * @param options - Original request options
     * @param normalizedOpts - Normalized options for makeRequestOptions
     * @param cacheKey - Cache key for the entry
     * @param cacheConfig - Cache configuration
     */
    async triggerBackgroundRevalidation<Res, ResHdr = unknown>(
        _method: HttpMethods,
        _path: string,
        normalizedOpts: InternalReqOptions<H, P, S>,
        cacheKey: string,
        cacheConfig: CacheRule<S, H, P>
    ): Promise<void> {

        // Prevent multiple concurrent revalidations for the same key
        if (this.cachePolicy.isRevalidating(cacheKey)) {

            return;
        }

        this.cachePolicy.markRevalidating(cacheKey);

        // Build normalized options for the background request
        // Disable retries for background revalidation to fail fast
        const controller = new AbortController();
        const bgOptions: InternalReqOptions<H, P, S> = {
            ...normalizedOpts,
            controller,
            signal: controller.signal,
            retry: { maxAttempts: 0 }
        };

        this.engine.emit('cache-revalidate', {
            ...bgOptions,
            key: cacheKey
        });

        const [res, fetchErr] = await attempt(() =>
            this.attemptCall<Res, ResHdr>(bgOptions)
        );

        this.cachePolicy.unmarkRevalidating(cacheKey);

        if (fetchErr) {

            this.engine.emit('cache-revalidate-error', {
                ...bgOptions,
                key: cacheKey,
                error: fetchErr
            });

            return;
        }

        const [, cacheErr] = await attempt(() => (

            this.flight.setCache(cacheKey, res, {
                ttl: cacheConfig.ttl,
                staleIn: cacheConfig.staleIn
            })
        ));

        if (cacheErr) {

            this.engine.emit('cache-revalidate-error', {
                ...bgOptions,
                key: cacheKey,
                error: cacheErr
            });

            return;
        }

        this.cachePolicy.markActive(cacheKey);

        this.engine.emit('cache-set', {
            ...bgOptions,
            key: cacheKey,
            expiresIn: cacheConfig.ttl
        });
    }

    /**
     * Executes a request with cache checking, deduplication, and rate limiting.
     *
     * This is the main entry point for request execution. It:
     * 1. Checks cache (returns cached value if hit)
     * 2. Checks rate limit (blocks if needed)
     * 3. Checks for in-flight request (joins if found)
     * 4. Executes the actual request
     * 5. Stores result in cache if applicable
     *
     * @param normalizedOpts - Normalized request options
     * @param options - Original options (for background revalidation)
     * @param totalTimeout - Total timeout promise
     * @returns Response from the request
     */
    async executeRequest<Res, ResHdr = unknown>(
        normalizedOpts: InternalReqOptions<H, P, S>,
        totalTimeout: ReturnType<typeof wait> | undefined
    ): Promise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>> {

        normalizedOpts.requestStart = Date.now();

        const { method, path, controller } = normalizedOpts;
        const isStream = normalizedOpts.stream === true;

        let cacheKey: string | null = null;
        let cacheConfig: CacheRule<H, P, S> | null = null;

        // === Cache Check ===
        // Cache runs first: cached responses return immediately without consuming rate limit tokens.
        // Stream requests skip cache — each caller needs their own Response body.
        if (!isStream) {

            const cacheResult = await this.cachePolicy.checkCache<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>({
                method,
                path,
                normalizedOpts: normalizedOpts as any,
                options: normalizedOpts as any,
                clearTimeout: () => totalTimeout?.clear()
            });

            if (cacheResult?.hit) {

                return cacheResult.value;
            }

            if (cacheResult && !cacheResult.hit) {

                cacheKey = cacheResult.key;
                cacheConfig = cacheResult.config as CacheRule<H, P, S>;
            }
        }

        // === Rate Limit Check ===
        // Rate limiting still gates stream requests (they're real outbound calls).
        await this.rateLimitPolicy.executeGuard({
            method,
            path,
            normalizedOpts: normalizedOpts as any,
            controller,
            emit: (event, data) => this.engine.emit(event as any, data as any),
            clearTimeout: () => totalTimeout?.clear(),
            createAbortError: (message) => {

                const err = new FetchError(message);
                err.aborted = true;
                err.method = normalizedOpts.method;
                err.path = path;
                err.status = 0;
                err.step = 'fetch';
                return err;
            }
        });

        let dedupeKey: string | null = null;
        let cleanup: (() => void) | null = null;

        // === Deduplication Check ===
        // Stream requests skip deduplication — each caller needs their own Response body.
        if (!isStream) {

            // Cast normalizedOpts for policy compatibility (internal type order mismatch)
            const dedupeResult = this.dedupePolicy.checkInflight<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>({
                method,
                path,
                normalizedOpts: normalizedOpts as any
            });

            if (dedupeResult?.joined) {

                return this.#awaitWithIndependentTimeout(
                    dedupeResult.promise,
                    controller,
                    totalTimeout,
                    normalizedOpts.method,
                    path
                );
            }

            if (dedupeResult && !dedupeResult.joined) {

                dedupeKey = dedupeResult.key;
            }
        }

        // === Execute Request ===
        let deferred: Deferred<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>> | null = null;

        if (dedupeKey) {

            deferred = new Deferred<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>();

            // Attach a no-op catch handler to prevent unhandled rejection warnings
            deferred.promise.catch(() => { /* handled by the request flow */ });

            cleanup = this.flight.trackInflight(dedupeKey, deferred.promise);
        }

        const requestPromise = this.attemptCall<Res, ResHdr>(normalizedOpts);

        const [res, err] = await attempt(() => requestPromise);

        totalTimeout?.clear();

        if (err) {

            deferred?.reject(err);
            cleanup?.();
            throw err;
        }

        deferred?.resolve(res);
        cleanup?.();

        if (cacheKey && cacheConfig) {

            await this.flight.setCache(cacheKey, res, {
                ttl: cacheConfig.ttl,
                staleIn: cacheConfig.staleIn
            });

            this.cachePolicy.markActive(cacheKey);

            this.engine.emit('cache-set', {
                ...normalizedOpts,
                key: cacheKey,
                expiresIn: cacheConfig.ttl,
            });
        }

        return res;
    }

    /**
     * Initialize policies with configuration from engine options.
     *
     * Called during engine construction after options are set.
     */
    initPolicies(): void {

        const dedupeConfig = this.engine.config.get('dedupePolicy');
        const cacheConfig = this.engine.config.get('cachePolicy');
        const rateLimitConfig = this.engine.config.get('rateLimitPolicy');

        this.dedupePolicy.init(dedupeConfig as any);
        this.cachePolicy.init(cacheConfig as any);
        this.rateLimitPolicy.init(rateLimitConfig as any);

        // Re-initialize SingleFlight with cache adapter if provided
        if (cacheConfig && cacheConfig !== true) {

            const config = cacheConfig as { adapter?: unknown; ttl?: number; staleIn?: number };

            this.flight = new SingleFlight<unknown>({
                adapter: config.adapter as any,
                defaultTtl: this.cachePolicy.defaultTtl,
                defaultStaleIn: this.cachePolicy.defaultStaleIn
            });
        }
    }

    /**
     * Clear the cache.
     */
    clearCache(): void {

        this.flight.clearCache();
    }

    /**
     * Get cache statistics.
     */
    cacheStats() {

        return this.flight.stats();
    }
}
