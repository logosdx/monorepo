/**
 * Engine module for FetchEngine.
 *
 * Contains the core engine class, event definitions, and internal types.
 */

import { ObserverEngine } from '@logosdx/observer';

import type {
    EventMap,
    EventData as EventsEventData,
    DedupeEventData as EventsDedupeEventData,
    CacheEventData as EventsCacheEventData,
    RateLimitEventData as EventsRateLimitEventData,
    StateEventData as EventsStateEventData,
    PropertyEventData as EventsPropertyEventData,
    OptionsEventData as EventsOptionsEventData
} from './events.ts';
import type { FetchEngineCore } from './types.ts';
import { RequestExecutor } from './executor.ts';
import { FetchState } from '../state/index.ts';
import { ConfigStore } from '../options/index.ts';
import { HeadersManager } from '../properties/headers.ts';
import { ParamsManager } from '../properties/params.ts';
import { PropertyStore } from '../properties/store.ts';
import type {
    EngineConfig,
    EngineType,
    EngineRequestConfig,
    EngineLifecycle,
    ValidateConfig,
    CallConfig,
    ModifyConfigFn as OptionsModifyConfigFn,
    DetermineTypeFn as OptionsDetermineTypeFn,
    InstanceHeaders as OptionsInstanceHeaders,
    InstanceParams as OptionsInstanceParams,
    InstanceState as OptionsInstanceState
} from '../options/types.ts';
import type { HttpMethods, FetchResponse, DictAndT } from '../types.ts';


// Re-export types
export * from './events.ts';
export * from './types.ts';


// CallConfig is now imported from options/types.ts
export type { CallConfig } from '../options/types.ts';


/**
 * Promise that can be aborted.
 */
export interface AbortablePromise<T> extends Promise<T> {

    isFinished: boolean;
    isAborted: boolean;
    abort(reason?: string): void;
}


/**
 * Response headers type for type inference.
 */
export interface InstanceResponseHeaders extends Record<string, string> {}


/**
 * Creates a wrapper around `fetch` with configurable defaults, retry logic,
 * request deduplication, caching, and rate limiting.
 *
 * Provides resilient HTTP client for production applications that need
 * reliable API communication with comprehensive error handling.
 *
 * @template H - Type of request headers
 * @template P - Type of request params
 * @template S - Type of instance state
 * @template RH - Type of response headers
 *
 * @example
 * ```typescript
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
 * ```
 *
 * @example
 * ```typescript
 * // Advanced setup with retry and caching
 * const api = new FetchEngine({
 *     baseUrl: 'https://api.example.com',
 *     retry: { maxAttempts: 3, baseDelay: 1000 },
 *     cachePolicy: { enabled: true, ttl: 60000 },
 *     dedupePolicy: true
 * });
 * ```
 */
export class FetchEngine<
    H = FetchEngine.InstanceHeaders,
    P = FetchEngine.InstanceParams,
    S = FetchEngine.InstanceState,
    RH = FetchEngine.InstanceResponseHeaders,
> extends ObserverEngine<EventMap<S, H, P>> implements FetchEngineCore<H, P, S> {

    /**
     * Symbol to use the default value or configuration.
     *
     * When returned from `determineType`, uses built-in content-type detection.
     *
     * @example
     * ```typescript
     * const api = new FetchEngine({
     *     baseUrl: 'https://api.example.com',
     *     determineType: (response) => {
     *         if (response.url.includes('/download')) return 'blob';
     *         return FetchEngine.useDefault; // Use built-in detection
     *     }
     * });
     * ```
     */
    static useDefault = Symbol('useDefault');

    /**
     * State store for managing instance state.
     */
    readonly state: FetchState<S>;

    /**
     * Options store for accessing all configuration.
     */
    readonly config: ConfigStore<H, P, S>;

    /**
     * Headers manager for adding/removing/resolving headers.
     */
    readonly headers: HeadersManager<H>;

    /**
     * Params manager for adding/removing/resolving URL parameters.
     */
    readonly params: ParamsManager<P>;

    #executor: RequestExecutor<H, P, S>;
    #instanceAbortController = new AbortController();

    /**
     * Create a new FetchEngine instance.
     *
     * @param opts - Configuration options
     */
    constructor(opts: EngineConfig<H, P, S>) {

        super({ name: opts.name, spy: opts.spy as any });

        // OptionsStore is FIRST - single source of truth for all configuration
        // We cast to `any` because the stores aren't initialized yet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const engine = this as any;

        this.config = new ConfigStore(engine, opts);

        // State store - pulls validate from options
        this.state = new FetchState(engine);

        // Property managers - pull initial values from options
        this.headers = new HeadersManager(engine);
        this.params = new ParamsManager(engine);

        // Request executor - owns policies and request lifecycle
        this.#executor = new RequestExecutor(engine);

        // Initialize policies with options from store
        this.#executor.initPolicies();
    }

    /**
     * Property store for headers (FetchEngineCore compliance).
     *
     * Internal components access this for header resolution.
     */
    get headerStore(): PropertyStore<DictAndT<H>> {

        return this.headers.$store;
    }

    /**
     * Property store for params (FetchEngineCore compliance).
     *
     * Internal components access this for param resolution.
     */
    get paramStore(): PropertyStore<DictAndT<P>> {

        return this.params.$store;
    }

    /**
     * Check if the engine has been destroyed.
     */
    get #destroyed(): boolean {

        return this.#instanceAbortController.signal.aborted;
    }

    // ===== HTTP Methods =====

    /**
     * Makes a GET request to retrieve data.
     *
     * @param path - Request path relative to base URL
     * @param options - Request options
     * @returns AbortablePromise that resolves to FetchResponse
     *
     * @example
     * ```typescript
     * const { data: users } = await api.get('/users');
     * ```
     */
    get(
        path: string,
        options: CallConfig<H, P> & { stream: true }
    ): AbortablePromise<FetchResponse<Response, DictAndT<H>, DictAndT<P>, RH>>;

    get<Res = unknown, ResHdr = RH>(
        path: string,
        options?: CallConfig<H, P>
    ): AbortablePromise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>;

    get(path: string, options: CallConfig<H, P> = {}): any {

        return this.request('GET', path, options);
    }

    /**
     * Makes a POST request to create a new resource.
     *
     * @param path - Request path relative to base URL
     * @param payload - Data to send in the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to FetchResponse
     *
     * @example
     * ```typescript
     * const { data: user } = await api.post('/users', { name: 'John' });
     * ```
     */
    post<Data = unknown>(
        path: string,
        payload: Data | undefined,
        options: CallConfig<H, P> & { stream: true }
    ): AbortablePromise<FetchResponse<Response, DictAndT<H>, DictAndT<P>, RH>>;

    post<Res = unknown, Data = unknown, ResHdr = RH>(
        path: string,
        payload?: Data,
        options?: CallConfig<H, P>
    ): AbortablePromise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>;

    post(path: string, payload?: unknown, options: CallConfig<H, P> = {}): any {

        return this.#executor.execute('POST', path, payload, options);
    }

    /**
     * Makes a PUT request to replace a resource.
     *
     * @param path - Request path relative to base URL
     * @param payload - Data to send in the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to FetchResponse
     *
     * @example
     * ```typescript
     * const { data: user } = await api.put('/users/123', { name: 'Jane' });
     * ```
     */
    put<Data = unknown>(
        path: string,
        payload: Data | undefined,
        options: CallConfig<H, P> & { stream: true }
    ): AbortablePromise<FetchResponse<Response, DictAndT<H>, DictAndT<P>, RH>>;

    put<Res = unknown, Data = unknown, ResHdr = RH>(
        path: string,
        payload?: Data,
        options?: CallConfig<H, P>
    ): AbortablePromise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>;

    put(path: string, payload?: unknown, options: CallConfig<H, P> = {}): any {

        return this.#executor.execute('PUT', path, payload, options);
    }

    /**
     * Makes a PATCH request to partially update a resource.
     *
     * @param path - Request path relative to base URL
     * @param payload - Partial data to update
     * @param options - Request options
     * @returns AbortablePromise that resolves to FetchResponse
     *
     * @example
     * ```typescript
     * const { data } = await api.patch('/users/123', { email: 'new@example.com' });
     * ```
     */
    patch<Data = unknown>(
        path: string,
        payload: Data | undefined,
        options: CallConfig<H, P> & { stream: true }
    ): AbortablePromise<FetchResponse<Response, DictAndT<H>, DictAndT<P>, RH>>;

    patch<Res = unknown, Data = unknown, ResHdr = RH>(
        path: string,
        payload?: Data,
        options?: CallConfig<H, P>
    ): AbortablePromise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>;

    patch(path: string, payload?: unknown, options: CallConfig<H, P> = {}): any {

        return this.#executor.execute('PATCH', path, payload, options);
    }

    /**
     * Makes a DELETE request to remove a resource.
     *
     * @param path - Request path relative to base URL
     * @param payload - Optional payload for the request body
     * @param options - Request options
     * @returns AbortablePromise that resolves to FetchResponse
     *
     * @example
     * ```typescript
     * await api.delete('/users/123');
     * ```
     */
    delete<Data = unknown>(
        path: string,
        payload: Data | undefined,
        options: CallConfig<H, P> & { stream: true }
    ): AbortablePromise<FetchResponse<Response, DictAndT<H>, DictAndT<P>, RH>>;

    delete<Res = unknown, Data = unknown, ResHdr = RH>(
        path: string,
        payload?: Data,
        options?: CallConfig<H, P>
    ): AbortablePromise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>;

    delete(path: string, payload?: unknown, options: CallConfig<H, P> = {}): any {

        return this.#executor.execute('DELETE', path, payload, options);
    }

    /**
     * Makes an HTTP OPTIONS request to check server capabilities.
     *
     * You can also use `request('OPTIONS', path, opts)` directly.
     *
     * @param path - Request path relative to base URL
     * @param opts - Request options
     * @returns AbortablePromise that resolves to FetchResponse
     *
     * @example
     * ```typescript
     * const { headers } = await api.options('/users');
     * // Or use request() directly:
     * const { headers } = await api.request('OPTIONS', '/users');
     * ```
     */
    options(
        path: string,
        opts: CallConfig<H, P> & { stream: true }
    ): AbortablePromise<FetchResponse<Response, DictAndT<H>, DictAndT<P>, RH>>;

    options<Res = unknown, ResHdr = RH>(
        path: string,
        opts?: CallConfig<H, P>
    ): AbortablePromise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>;

    options(path: string, opts: CallConfig<H, P> = {}): any {

        return this.request('OPTIONS', path, opts);
    }

    /**
     * Makes an HTTP HEAD request to retrieve headers only.
     *
     * You can also use `request('HEAD', path, opts)` directly.
     *
     * @param path - Request path relative to base URL
     * @param opts - Request options
     * @returns AbortablePromise that resolves to FetchResponse
     *
     * @example
     * ```typescript
     * const { headers } = await api.head('/users/123');
     * // Or use request() directly:
     * const { headers } = await api.request('HEAD', '/users/123');
     * ```
     */
    head(
        path: string,
        opts: CallConfig<H, P> & { stream: true }
    ): AbortablePromise<FetchResponse<Response, DictAndT<H>, DictAndT<P>, RH>>;

    head<ResHdr = RH>(
        path: string,
        opts?: CallConfig<H, P>
    ): AbortablePromise<FetchResponse<null, DictAndT<H>, DictAndT<P>, ResHdr>>;

    head(path: string, opts: CallConfig<H, P> = {}): any {

        return this.request('HEAD', path, opts);
    }

    /**
     * Makes an HTTP request with the specified method.
     *
     * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE, OPTIONS)
     * @param path - Request path relative to base URL
     * @param options - Request options (may include payload)
     * @returns AbortablePromise that resolves to FetchResponse
     *
     * @example
     * ```typescript
     * const response = await api.request('GET', '/users');
     * ```
     */
    request<Data = unknown>(
        method: HttpMethods,
        path: string,
        options: CallConfig<H, P> & { payload?: Data; stream: true }
    ): AbortablePromise<FetchResponse<Response, DictAndT<H>, DictAndT<P>, RH>>;

    request<Res = unknown, Data = unknown, ResHdr = RH>(
        method: HttpMethods,
        path: string,
        options?: CallConfig<H, P> & { payload?: Data }
    ): AbortablePromise<FetchResponse<Res, DictAndT<H>, DictAndT<P>, ResHdr>>;

    request(
        method: HttpMethods,
        path: string,
        options: CallConfig<H, P> & { payload?: unknown } = {}
    ): any {

        if (this.#destroyed) {

            throw new Error('Cannot make requests on destroyed FetchEngine instance');
        }

        const { payload, ...rest } = options;

        // Create a controller that's linked to the instance abort signal
        // so destroy() can abort all in-flight requests
        const controller = rest.abortController ?? new AbortController();
        const instanceSignal = this.#instanceAbortController.signal;

        if (!instanceSignal.aborted) {

            instanceSignal.addEventListener('abort', () => controller.abort('FetchEngine destroyed'), { once: true });
        }

        return this.#executor.execute(
            method,
            path,
            payload,
            { ...rest, abortController: controller }
        );
    }

    // ===== Cache Methods =====

    /**
     * Clear all cached responses.
     *
     * @example
     * ```typescript
     * api.clearCache();
     * ```
     */
    clearCache(): void {

        this.#executor.flight.clearCache();
    }

    /**
     * Clear a specific cache entry.
     *
     * @param key - Cache key to clear
     */
    clearCacheKey(key: string): void {

        this.#executor.flight.deleteCache(key);
    }

    /**
     * Delete a specific cache entry.
     *
     * @param key - Cache key to delete
     * @returns true if entry existed and was deleted
     *
     * @example
     * ```typescript
     * const deleted = await api.deleteCache('cache-key');
     * if (deleted) {
     *     console.log('Cache entry removed');
     * }
     * ```
     */
    deleteCache(key: string): Promise<boolean> {

        return this.#executor.flight.deleteCache(key);
    }

    /**
     * Invalidate cache entries matching a predicate.
     *
     * @param predicate - Function that returns true for keys to delete
     * @returns Number of entries deleted
     *
     * @example
     * ```typescript
     * // Delete all entries containing 'user'
     * const count = await api.invalidateCache(key => key.includes('user'));
     * ```
     */
    invalidateCache(predicate: (key: string) => boolean): Promise<number> {

        return this.#executor.flight.invalidateCache(predicate);
    }

    /**
     * Invalidate cache entries by path pattern.
     *
     * Accepts a string (prefix match), RegExp, or predicate function.
     *
     * @param pattern - String prefix, RegExp, or predicate function
     * @returns Number of entries deleted
     *
     * @example
     * ```typescript
     * // By prefix - invalidates /users, /users/123, etc.
     * await api.invalidatePath('/users');
     *
     * // By RegExp
     * await api.invalidatePath(/\/users\/\d+/);
     *
     * // By predicate
     * await api.invalidatePath(key => key.includes('/api/v1'));
     * ```
     */
    invalidatePath(pattern: string | RegExp | ((key: string) => boolean)): Promise<number> {

        if (typeof pattern === 'function') {

            return this.#executor.flight.invalidateCache(pattern);
        }

        if (pattern instanceof RegExp) {

            return this.#executor.flight.invalidateCache(key => pattern.test(key));
        }

        // String - match as prefix
        return this.#executor.flight.invalidateCache(key => key.includes(pattern));
    }

    /**
     * Get cache statistics.
     *
     * @returns Object with `inflightCount` and `cacheSize` properties
     *
     * @example
     * ```typescript
     * const stats = api.cacheStats();
     * console.log('Inflight:', stats.inflightCount);
     * console.log('Cache size:', stats.cacheSize);
     * ```
     */
    cacheStats() {

        return this.#executor.cacheStats();
    }

    // ===== Lifecycle Methods =====

    /**
     * Destroy the FetchEngine instance.
     *
     * Aborts all pending requests and cleans up resources.
     * After calling destroy(), the instance cannot be used.
     *
     * @example
     * ```typescript
     * // In React effect cleanup
     * useEffect(() => {
     *     const api = new FetchEngine({ baseUrl: '/api' });
     *     return () => api.destroy();
     * }, []);
     * ```
     */
    destroy(): void {

        if (this.#destroyed) {

            console.warn('FetchEngine instance already destroyed');
            return;
        }

        // Abort all pending requests
        this.#instanceAbortController.abort('FetchEngine destroyed');

        // Clear cache
        this.clearCache();
    }

    /**
     * Check if the engine has been destroyed.
     *
     * @returns true if destroy() has been called
     */
    isDestroyed(): boolean {

        return this.#destroyed;
    }
}


// ===== FetchEngine Namespace Declaration =====
// Uses declaration merging - namespace must come AFTER the class

/**
 * Namespace for FetchEngine types.
 *
 * Contains all types associated with FetchEngine using declaration merging.
 * This allows users to reference types as `FetchEngine.Options`, `FetchEngine.EventData`, etc.
 *
 * **Augmentable Interfaces:**
 *
 * Users can extend these interfaces via module augmentation to add custom properties:
 *
 * @example
 * ```typescript
 * // In your app's type declaration file
 * declare module '@logosdx/fetch' {
 *     namespace FetchEngine {
 *         interface InstanceHeaders {
 *             'X-Custom-Header': string;
 *             Authorization: string;
 *         }
 *
 *         interface InstanceParams {
 *             apiKey: string;
 *         }
 *
 *         interface InstanceState {
 *             userId: string;
 *             token: string;
 *         }
 *
 *         interface InstanceResponseHeaders {
 *             'x-rate-limit': string;
 *             'x-request-id': string;
 *         }
 *     }
 * }
 * ```
 */
export namespace FetchEngine {

    // ===== Augmentable Interfaces =====
    // These are empty by default but can be extended via module augmentation

    /**
     * Override this interface with the headers you intend to use throughout your app.
     *
     * @example
     * ```typescript
     * declare module '@logosdx/fetch' {
     *     namespace FetchEngine {
     *         interface InstanceHeaders {
     *             Authorization: string;
     *             'X-API-Key': string;
     *         }
     *     }
     * }
     * ```
     */
    export interface InstanceHeaders extends OptionsInstanceHeaders {}

    /**
     * Override this interface with the URL params you intend to use throughout your app.
     */
    export interface InstanceParams extends OptionsInstanceParams {}

    /**
     * Override this interface with the state you intend to use throughout your app.
     */
    export interface InstanceState extends OptionsInstanceState {}

    /**
     * Override this interface with the response headers you expect from your API.
     */
    export interface InstanceResponseHeaders extends Record<string, string> {}


    // ===== Type Aliases =====
    // Forward types from modular implementations

    /** Response body type (json, text, blob, etc.) */
    export type Type = EngineType;

    /** Full configuration options for FetchEngine */
    export type Config<H = InstanceHeaders, P = InstanceParams, S = InstanceState> = EngineConfig<H, P, S>;

    /** Request options passed to modifyOptions callbacks */
    export type RequestOpts<H = InstanceHeaders, P = InstanceParams> = EngineRequestConfig<H, P>;

    /** Function type for modifying request options */
    export type ModifyConfigFn<H = InstanceHeaders, P = InstanceParams, S = InstanceState> = OptionsModifyConfigFn<H, P, S>;

    /** Function type for determining response body type */
    export type DetermineTypeFn = OptionsDetermineTypeFn;

    /** Per-request configuration options */
    export type CallConfig<H = InstanceHeaders, P = InstanceParams> = import('../options/types.ts').CallConfig<H, P>;

    /** Lifecycle hooks for requests */
    export type Lifecycle<H = InstanceHeaders, P = InstanceParams> = EngineLifecycle<H, P>;

    /** Validation configuration */
    export type Validate<H = InstanceHeaders, P = InstanceParams, S = InstanceState> = ValidateConfig<H, P, S>;


    // ===== Helper Types =====

    /** Headers type that combines a custom type with string dict */
    export type Headers<T = InstanceHeaders> = DictAndT<T>;

    /** Params type that combines a custom type with string dict */
    export type Params<T = InstanceParams> = DictAndT<T>;

    /** Response headers type */
    export type ResponseHeaders<T = InstanceResponseHeaders> = DictAndT<T>;

    /** Header key names */
    export type HeaderKeys<H = InstanceHeaders> = keyof Headers<H>;


    // ===== Event Types =====
    // Re-export event types for namespace access using type aliases

    /** Event data for FetchEngine events */
    export type EventData<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = EventsEventData<S, H, P>;

    /** Event data for deduplication events */
    export type DedupeEventData<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = EventsDedupeEventData<S, H, P>;

    /** Event data for cache events */
    export type CacheEventData<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = EventsCacheEventData<S, H, P>;

    /** Event data for rate limit events */
    export type RateLimitEventData<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = EventsRateLimitEventData<S, H, P>;

    /** Event data for state mutation events */
    export type StateEventData<S = InstanceState> = EventsStateEventData<S>;

    /** Event data for property (header/param) events */
    export type PropertyEventData<T = unknown> = EventsPropertyEventData<T>;

    /** Event data for options change events */
    export type OptionsEventData = EventsOptionsEventData;

    /** Event map for ObserverEngine */
    export type EventMap<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = import('./events.ts').EventMap<S, H, P>;


    // ===== Promise Type =====

    /** Promise that can be aborted */
    export type AbortPromise<T> = AbortablePromise<T>;
}
