import type { ObserverEngine } from '@logosdx/observer';
import type { HookEngine } from '@logosdx/hooks';
import type { EventMap } from './events.ts';
import type { FetchState } from '../state/index.ts';
import type { ConfigStore } from '../options/index.ts';
import type { PropertyStore } from '../properties/store.ts';
import type { DictAndT, HttpMethods, FetchResponse, RetryConfig } from '../types.ts';


/**
 * Lifecycle hooks for the FetchEngine request pipeline.
 *
 * `beforeRequest` hooks run before the network request. They can modify the
 * URL/options via `ctx.args()`, short-circuit with a cached response via
 * `ctx.returns()`, or abort with `ctx.fail()`.
 *
 * `afterRequest` hooks run after a successful response. They can replace the
 * response via `ctx.returns()` or abort with `ctx.fail()`.
 *
 * @template H - Headers type
 * @template P - Params type
 * @template S - State type
 */
export interface FetchLifecycle<H = unknown, P = unknown, S = unknown> {

    beforeRequest(url: URL, opts: InternalReqOptions<H, P, S>): FetchResponse;
    execute(opts: InternalReqOptions<H, P, S>): Promise<FetchResponse>;
    afterRequest(response: FetchResponse, url: URL, opts: InternalReqOptions<H, P, S>): FetchResponse;
}


/**
 * Plugin contract for extending FetchEngine with hook-based behavior.
 *
 * Plugins wrap existing functionality (cache, dedupe, rate-limit) or add
 * new capabilities by registering hooks on the engine. Each plugin returns
 * an unsubscribe function from `install()` for cleanup.
 *
 * @example
 *     function authPlugin(getToken: () => Promise<string>) {
 *         return {
 *             name: 'auth',
 *             install(engine) {
 *                 return engine.hooks.add('beforeRequest', async (url, opts, ctx) => {
 *                     const token = await getToken();
 *                     ctx.args(url, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } });
 *                 });
 *             }
 *         } satisfies FetchPlugin;
 *     }
 *
 * @template H - Headers type
 * @template P - Params type
 * @template S - State type
 */
export interface FetchPlugin<H = unknown, P = unknown, S = unknown> {

    name: string;
    hooks?: HookEngine<any>;
    install(engine: FetchEnginePublic<H, P, S>): () => void;
}


/**
 * Public surface of FetchEngine that plugins receive.
 *
 * Provides access to hooks and the observer event system without
 * exposing internal executor details.
 */
export interface FetchEnginePublic<H = unknown, P = unknown, S = unknown>
    extends ObserverEngine<EventMap<S, H, P>> {

    readonly hooks: HookEngine<FetchLifecycle<H, P, S>>;
}


/**
 * Core interface that FetchEngine implements.
 *
 * This interface defines what internal components (RequestExecutor, policies,
 * stores) can access from the engine. All configuration is accessed through
 * stores, and events are emitted through the ObserverEngine base.
 *
 * FetchEngineCore extends ObserverEngine<EventMap> which provides type-safe
 * event emission. This is the ONLY way for internal components to emit events,
 * guaranteeing type safety at emit time.
 *
 * @template H - Headers type
 * @template P - Params type
 * @template S - State type
 *
 * @example
 * ```typescript
 * // Components receive FetchEngineCore and access everything through it
 * class RequestExecutor<H, P, S> {
 *     constructor(private engine: FetchEngineCore<H, P, S>) {}
 *
 *     execute() {
 *         // Type-safe event emission through engine
 *         this.engine.emit('before', { state: this.engine.state.get() });
 *
 *         // Access config through options store
 *         const timeout = this.engine.options.get('totalTimeout');
 *     }
 * }
 * ```
 */
export interface FetchEngineCore<
    H = unknown,
    P = unknown,
    S = unknown
> extends ObserverEngine<EventMap<S, H, P>> {

    /**
     * State store for managing instance state.
     *
     * Provides get/set/reset operations with event emission.
     */
    readonly state: FetchState<S>;

    /**
     * Options store for accessing all configuration.
     *
     * Single source of truth for ALL configuration. Supports deep
     * path access via `get('retry.maxAttempts')` and runtime updates
     * via `set('baseUrl', newUrl)`.
     *
     * Fully typed with FetchEngine.Options<H, P, S>.
     */
    readonly config: ConfigStore<H, P, S>;

    /**
     * Property store for headers.
     *
     * Manages default headers, method-specific headers, and resolution.
     */
    readonly headerStore: PropertyStore<DictAndT<H>>;

    /**
     * Property store for URL parameters.
     *
     * Manages default params, method-specific params, and resolution.
     */
    readonly paramStore: PropertyStore<DictAndT<P>>;

    /**
     * Hook engine for the request lifecycle pipeline.
     *
     * Plugins register beforeRequest/afterRequest hooks here.
     * The executor runs these hooks around each request.
     */
    readonly hooks: HookEngine<FetchLifecycle<H, P, S>>;
}


/**
 * Internal normalized request options - flat structure used throughout FetchEngine.
 *
 * This is the single source of truth for all request data, flowing to:
 * - Cache/dedupe serializers (satisfies RequestKeyOptions)
 * - Event data (spread directly into events)
 * - Request execution (attemptCall → makeCall)
 *
 * Extends native RequestInit (minus headers/signal/body/method which we handle)
 * to support instance-level defaults for credentials, mode, cache, etc.
 *
 * @template H - Headers type
 * @template P - Params type
 * @template S - State type
 */
export interface InternalReqOptions<H = unknown, P = unknown, S = unknown>
    extends Omit<RequestInit, 'headers' | 'signal' | 'body' | 'method'> {

    // === Request identity (satisfies RequestKeyOptions) ===

    /** HTTP method (uppercase) */
    method: HttpMethods;

    /** Original request path */
    path: string;

    /** Request payload/body */
    payload?: unknown | undefined;

    /** Merged headers (instance + method + request) */
    headers: DictAndT<H>;

    /** URL parameters as flat object (from url.searchParams) */
    params: DictAndT<P>;

    /** Instance state */
    state: S;

    // === URL ===

    /** Fully constructed URL */
    url: URL;

    // === Execution plumbing ===

    /** AbortSignal for cancellation */
    signal: AbortSignal;

    /** AbortController (for child signals in retry) */
    controller: AbortController;

    /** Serialized request body */
    body?: BodyInit | undefined;

    /** Request timeout (ms) - deprecated, use totalTimeout */
    timeout?: number | undefined;

    /** Per-attempt timeout (ms) */
    attemptTimeout?: number | undefined;

    /** Function to check if total timeout has fired */
    getTotalTimeoutFired?: (() => boolean) | undefined;

    /** Retry configuration (true normalized to {}) */
    retry?: RetryConfig | undefined;

    /** Response type determination function */
    determineType?: ((response: Response) => { type: 'json' | 'text' | 'blob' | 'arrayBuffer'; isJson: boolean }) | undefined;

    // === Callbacks ===

    /** Called before request */
    onBeforeRequest?: ((opts: unknown) => void | Promise<void>) | undefined;

    /** Called after request (before parse) */
    onAfterRequest?: ((response: Response, opts: unknown) => void | Promise<void>) | undefined;

    /** Called on error */
    onError?: ((error: Error) => void) | undefined;

    // === Runtime state ===

    /** When true, returns raw Response without body parsing */
    stream?: boolean | undefined;

    /** Returns the active response directive from FetchPromise */
    getDirective?: (() => import('./fetch-promise.ts').ResponseDirective | undefined) | undefined;

    /** Unique ID for this request, flows through all events */
    requestId?: string | undefined;

    /** Current attempt number (1-based) */
    attempt?: number | undefined;

    /** Timestamp (ms) when the request entered the execution pipeline */
    requestStart?: number | undefined;
}


/**
 * Result of a request execution.
 *
 * @template T - Response data type
 * @template H - Headers type
 * @template P - Params type
 * @template RH - Response headers type
 */
export interface ExecuteResult<
    T = unknown,
    H = unknown,
    P = unknown,
    RH = unknown
> {

    response: FetchResponse<T, H, P, RH>;
    fromCache: boolean;
    cacheKey?: string;
}
