/**
 * Engine module for FetchEngine.
 *
 * Contains the core engine class, event definitions, and internal types.
 */

import { ObserverEngine } from '@logosdx/observer';
import { HookEngine } from '@logosdx/hooks';
import { assert, isObject } from '@logosdx/utils';

import type {
    EventMap,
    EventData as EventsEventData,
    DedupeEventData as EventsDedupeEventData,
    CacheEventData as EventsCacheEventData,
    RateLimitEventData as EventsRateLimitEventData,
    RetryEventData as EventsRetryEventData,
    StateEventData as EventsStateEventData,
    PropertyEventData as EventsPropertyEventData,
    OptionsEventData as EventsOptionsEventData
} from './events.ts';
import type { FetchEngineCore, FetchLifecycle, FetchPlugin } from './types.ts';
import { RequestExecutor } from './executor.ts';
import { FetchState } from '../state/index.ts';
import { ConfigStore } from '../options/index.ts';
import { HeadersManager } from '../properties/headers.ts';
import { ParamsManager } from '../properties/params.ts';
import { PropertyStore } from '../properties/store.ts';
import { retryPlugin } from '../plugins/retry.ts';
import { dedupePlugin } from '../plugins/dedupe.ts';
import { cachePlugin } from '../plugins/cache.ts';
import { rateLimitPlugin } from '../plugins/rate-limit.ts';
import { cookiePlugin } from '../plugins/cookies/plugin.ts';
import type {
    EngineConfig,
    EngineType,
    EngineRequestConfig,
    EngineLifecycle,
    ValidateConfig,
    CallConfig,
    DetermineTypeFn as OptionsDetermineTypeFn,
    InstanceHeaders as OptionsInstanceHeaders,
    InstanceParams as OptionsInstanceParams,
    InstanceState as OptionsInstanceState
} from '../options/types.ts';
import type { HttpMethods, DictAndT } from '../types.ts';
import { FetchPromise } from './fetch-promise.ts';
import type { FetchStreamPromise, ResponseDirective } from './fetch-promise.ts';


// Re-export types
export * from './events.ts';
export * from './types.ts';
export { FetchPromise } from './fetch-promise.ts';
export type { FetchStreamPromise, ResponseDirective } from './fetch-promise.ts';


// CallConfig is now imported from options/types.ts
export type { CallConfig } from '../options/types.ts';


/**
 * Response headers type for type inference.
 */
export interface InstanceResponseHeaders extends Record<string, string> { }


/**
 * Config keys that own a policy plugin, mapped to the plugin's `name`.
 *
 * Used to route a `config-change` event to the plugin that owns the changed
 * key, and to tell a `plugins:`-installed policy (runtime `set()` throws —
 * the user owns that instance) from a config-key-installed one (routes to
 * `reconfigure`).
 */
const POLICY_CONFIG_KEYS = {
    retry: 'retry',
    dedupePolicy: 'dedupe',
    cachePolicy: 'cache',
    rateLimitPolicy: 'rate-limit',
    cookies: 'cookies',
} as const;

type PolicyConfigKey = keyof typeof POLICY_CONFIG_KEYS;

function isPolicyConfigKey(key: string): key is PolicyConfigKey {

    return key in POLICY_CONFIG_KEYS;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {

    return isObject(value);
}

/**
 * Message thrown when a policy key's plugin conflicts with its config key.
 *
 * Shared between the construction-time check and the runtime `set()` check
 * so both surfaces report the same conflict the same way.
 */
function ownershipConflictMessage(policyName: string): string {

    return `FetchEngine: the '${policyName}' plugin conflicts with its config key — configure one or the other, not both`;
}


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
 * // Advanced setup with plugins
 * const api = new FetchEngine({
 *     baseUrl: 'https://api.example.com',
 *     plugins: [
 *         retryPlugin({ maxAttempts: 3, baseDelay: 1000 }),
 *         cachePlugin({ ttl: 60000 }),
 *         dedupePlugin(true)
 *     ]
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

    /**
     * Hook engine for the request lifecycle pipeline.
     *
     * Register hooks to intercept, modify, or short-circuit requests.
     * Plugins install their hooks here at negative priorities so user
     * hooks at priority 0 run after built-in policies.
     */
    readonly hooks: HookEngine<FetchLifecycle<H, P, S>>;

    #executor: RequestExecutor<H, P, S>;
    #instanceAbortController = new AbortController();
    #pluginCleanups: (() => void)[] = [];

    /** Canonical policy name → install path ('config' key vs `plugins:` array). */
    #policyOwnership = new Map<string, 'config' | 'user'>();

    /** Canonical policy name → installed plugin instance, for reconfigure routing. */
    #policyPlugins = new Map<string, FetchPlugin<H, P, S>>();

    /** Unsubscribe for the engine's own `config-change` listener. */
    #configChangeCleanup: () => void;

    /** Unsubscribe for the engine's pre-mutation ownership validator. */
    #configValidatorCleanup: () => void;

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

        // Hook engine for request lifecycle
        this.hooks = new HookEngine<FetchLifecycle<H, P, S>>();

        // Request executor - no longer owns policies
        this.#executor = new RequestExecutor(engine);

        // Install plugins: config keys always apply, opts.plugins adds custom
        // plugins, and reserved policy names collide loudly (see #resolvePlugins)
        const plugins = this.#resolvePlugins(opts);

        for (const plugin of plugins) {

            this.#pluginCleanups.push(this.use(plugin));
        }

        // Validate ownership BEFORE the store mutates — a rejected set() must
        // never leave the store or the plugins in a changed state.
        this.#configValidatorCleanup = this.config.onBeforeSet((data) => this.#validateConfigChange(data));
        this.#configChangeCleanup = this.on('config-change', (data) => this.#handleConfigChange(data));
    }

    /**
     * Resolve the final plugin set from config keys and the custom plugins array.
     *
     * Config-key policies (`retry`, `dedupePolicy`, `cachePolicy`,
     * `rateLimitPolicy`, `cookies`) always install; `opts.plugins` is additive
     * and never replaces them. A policy may only exist once — two instances
     * silently double-consume (two rate-limit tokens per request, two caches,
     * nested retries) — so passing both a policy's config key and its plugin,
     * or the same policy plugin twice, throws at construction. One exception:
     * a user-supplied `retry` plugin with no explicit `retry` key replaces the
     * auto-installed default rather than conflicting.
     */
    #resolvePlugins(opts: EngineConfig<H, P, S>): FetchPlugin<H, P, S>[] {

        const configPlugins = this.#buildPluginsFromOptions(opts);
        const customPlugins = opts.plugins ?? [];

        const explicitKeyByName: Record<string, boolean> = {
            'retry': opts.retry !== undefined,
            'dedupe': opts.dedupePolicy !== undefined,
            'cache': opts.cachePolicy !== undefined,
            'rate-limit': opts.rateLimitPolicy !== undefined,
            'cookies': opts.cookies !== undefined,
        };

        const seenPolicyPlugins = new Set<string>();

        for (const plugin of customPlugins) {

            if (!(plugin.name in explicitKeyByName)) continue;

            assert(
                explicitKeyByName[plugin.name] !== true,
                ownershipConflictMessage(plugin.name)
            );

            assert(
                !seenPolicyPlugins.has(plugin.name),
                `FetchEngine: duplicate '${plugin.name}' plugin — a policy may only be installed once`
            );

            seenPolicyPlugins.add(plugin.name);
        }

        const keptConfigPlugins = configPlugins.filter(
            (plugin) => !seenPolicyPlugins.has(plugin.name)
        );

        this.#capturePolicyOwnership(keptConfigPlugins, customPlugins, explicitKeyByName);

        return [...keptConfigPlugins, ...customPlugins];
    }

    /**
     * Record which install path owns each policy plugin.
     *
     * A `plugins:`-installed policy is user-owned — the engine has no
     * authority to reconfigure it, so a runtime `config.set()` on that key
     * throws. A config-key-installed policy routes to the plugin's
     * `reconfigure`.
     */
    #capturePolicyOwnership(
        keptConfigPlugins: FetchPlugin<H, P, S>[],
        customPlugins: FetchPlugin<H, P, S>[],
        policyNames: Record<string, boolean>
    ): void {

        for (const plugin of keptConfigPlugins) {

            if (!(plugin.name in policyNames)) continue;

            this.#policyOwnership.set(plugin.name, 'config');
            this.#policyPlugins.set(plugin.name, plugin);
        }

        for (const plugin of customPlugins) {

            if (!(plugin.name in policyNames)) continue;

            this.#policyOwnership.set(plugin.name, 'user');
            this.#policyPlugins.set(plugin.name, plugin);
        }
    }

    /**
     * Build plugins from the policy config keys
     * (retry, dedupePolicy, cachePolicy, rateLimitPolicy, cookies).
     */
    #buildPluginsFromOptions(opts: EngineConfig<H, P, S>): FetchPlugin<H, P, S>[] {

        const plugins: FetchPlugin<H, P, S>[] = [];

        // Retry plugin (always installed unless explicitly disabled)
        plugins.push(retryPlugin<H, P, S>(opts.retry === true ? undefined : opts.retry));

        // Dedupe plugin
        if (opts.dedupePolicy) {

            const dedupe = dedupePlugin<H, P, S>(opts.dedupePolicy);
            this.#dedupePlugin = dedupe;
            plugins.push(dedupe);
        }

        // Cache plugin
        if (opts.cachePolicy) {

            const cache = cachePlugin<H, P, S>(opts.cachePolicy);
            this.#cachePlugin = cache;
            plugins.push(cache);
        }

        // Rate limit plugin
        if (opts.rateLimitPolicy) {

            plugins.push(rateLimitPlugin<H, P, S>(opts.rateLimitPolicy));
        }

        // Cookie plugin
        if (opts.cookies) {

            plugins.push(cookiePlugin<H, P, S>(opts.cookies === true ? undefined : opts.cookies));
        }

        return plugins;
    }

    /** Reference to the cache plugin for backward compat methods */
    #cachePlugin: any = null;

    /** Reference to the dedupe plugin for inflight tracking */
    #dedupePlugin: any = null;

    /**
     * Install a plugin at runtime.
     *
     * The plugin's `install()` method is called with this engine instance.
     * Returns an unsubscribe function that removes the plugin's hooks.
     *
     * @param plugin - Plugin to install
     * @returns Cleanup function to uninstall the plugin
     */
    use(plugin: FetchPlugin<H, P, S>): () => void {

        return plugin.install(this);
    }

    /**
     * Validate a pending `config.set()` against policy ownership before the
     * store mutates.
     *
     * Registered on `ConfigStore`'s pre-set hook so a rejected set() never
     * partially applies: every changed policy key is checked here — before
     * any of them commit — mirroring the construction-time
     * all-asserts-then-install order. Throws when a changed key's plugin was
     * installed via `plugins:`; the engine has no authority to reconfigure a
     * user-owned instance.
     */
    #validateConfigChange(data: EventsOptionsEventData): void {

        const changedKeys = this.#changedPolicyKeys(data);

        for (const configKey of changedKeys) {

            const policyName = POLICY_CONFIG_KEYS[configKey];

            assert(
                this.#policyOwnership.get(policyName) !== 'user',
                ownershipConflictMessage(policyName)
            );
        }
    }

    /**
     * Route a `config-change` event to the plugin owning the changed policy key.
     *
     * By the time this fires, `#validateConfigChange` has already confirmed
     * every changed key is safe to apply, so this only routes to
     * `reconfigure`. Calls the owning plugin's optional `reconfigure` with
     * the key's current value; a plugin without `reconfigure` is left
     * untouched.
     */
    #handleConfigChange(data: EventsOptionsEventData): void {

        const changedKeys = this.#changedPolicyKeys(data);

        if (changedKeys.length === 0) return;

        const currentConfig = this.config.get();

        for (const configKey of changedKeys) {

            const policyName = POLICY_CONFIG_KEYS[configKey];

            this.#policyPlugins.get(policyName)?.reconfigure?.(currentConfig[configKey]);
        }
    }

    /**
     * Resolve which policy config keys a `config-change` event touched.
     *
     * A path-based `set('retry.maxAttempts', …)` carries only the root
     * segment as the policy key. A merge `set({ retry: {...} })` carries the
     * whole partial under `value` — every top-level policy key it touches.
     */
    #changedPolicyKeys(data: EventsOptionsEventData): PolicyConfigKey[] {

        if (data.path !== undefined) {

            const [rootKey] = data.path.split('.');
            return rootKey !== undefined && isPolicyConfigKey(rootKey) ? [rootKey] : [];
        }

        if (isPlainObject(data.value)) {

            return Object.keys(data.value).filter(isPolicyConfigKey);
        }

        return [];
    }

    /**
     * Property store for headers (FetchEngineCore compliance).
     */
    get headerStore(): PropertyStore<DictAndT<H>> {

        return this.headers.$store;
    }

    /**
     * Property store for params (FetchEngineCore compliance).
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
     */
    get<Res = unknown, ResHdr = RH>(
        path: string,
        options?: CallConfig<H, P>
    ): FetchPromise<Res, DictAndT<H>, DictAndT<P>, ResHdr>;

    get(path: string, options: CallConfig<H, P> = {}): any {

        return this.request('GET', path, options);
    }

    /**
     * Makes a POST request to create a new resource.
     */
    post<Res = unknown, Data = unknown, ResHdr = RH>(
        path: string,
        payload?: Data,
        options?: CallConfig<H, P>
    ): FetchPromise<Res, DictAndT<H>, DictAndT<P>, ResHdr>;

    post(path: string, payload?: unknown, options: CallConfig<H, P> = {}): any {

        return this.#executor.execute('POST', path, payload, options);
    }

    /**
     * Makes a PUT request to replace a resource.
     */
    put<Res = unknown, Data = unknown, ResHdr = RH>(
        path: string,
        payload?: Data,
        options?: CallConfig<H, P>
    ): FetchPromise<Res, DictAndT<H>, DictAndT<P>, ResHdr>;

    put(path: string, payload?: unknown, options: CallConfig<H, P> = {}): any {

        return this.#executor.execute('PUT', path, payload, options);
    }

    /**
     * Makes a PATCH request to partially update a resource.
     */
    patch<Res = unknown, Data = unknown, ResHdr = RH>(
        path: string,
        payload?: Data,
        options?: CallConfig<H, P>
    ): FetchPromise<Res, DictAndT<H>, DictAndT<P>, ResHdr>;

    patch(path: string, payload?: unknown, options: CallConfig<H, P> = {}): any {

        return this.#executor.execute('PATCH', path, payload, options);
    }

    /**
     * Makes a DELETE request to remove a resource.
     */
    delete<Res = unknown, Data = unknown, ResHdr = RH>(
        path: string,
        payload?: Data,
        options?: CallConfig<H, P>
    ): FetchPromise<Res, DictAndT<H>, DictAndT<P>, ResHdr>;

    delete(path: string, payload?: unknown, options: CallConfig<H, P> = {}): any {

        return this.#executor.execute('DELETE', path, payload, options);
    }

    /**
     * Makes an HTTP OPTIONS request to check server capabilities.
     */
    options<Res = unknown, ResHdr = RH>(
        path: string,
        opts?: CallConfig<H, P>
    ): FetchPromise<Res, DictAndT<H>, DictAndT<P>, ResHdr>;

    options(path: string, opts: CallConfig<H, P> = {}): any {

        return this.request('OPTIONS', path, opts);
    }

    /**
     * Makes an HTTP HEAD request to retrieve headers only.
     */
    head<ResHdr = RH>(
        path: string,
        opts?: CallConfig<H, P>
    ): FetchPromise<null, DictAndT<H>, DictAndT<P>, ResHdr>;

    head(path: string, opts: CallConfig<H, P> = {}): any {

        return this.request('HEAD', path, opts);
    }

    /**
     * Makes an HTTP request with the specified method.
     */
    request<Res = unknown, Data = unknown, ResHdr = RH>(
        method: HttpMethods,
        path: string,
        options?: CallConfig<H, P> & { payload?: Data }
    ): FetchPromise<Res, DictAndT<H>, DictAndT<P>, ResHdr>;

    request(
        method: HttpMethods,
        path: string,
        options: CallConfig<H, P> & { payload?: unknown } = {}
    ): any {

        if (this.#destroyed) {

            throw new Error('Cannot make requests on destroyed FetchEngine instance');
        }

        const { payload, ...rest } = options;

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

    // ===== Cache Methods (backward compat - delegate to cache plugin) =====

    /**
     * Clear all cached responses.
     */
    clearCache(): void {

        this.#cachePlugin?.clearCache();
    }

    /**
     * Clear a specific cache entry.
     */
    clearCacheKey(key: string): void {

        this.#cachePlugin?.clearCacheKey(key);
    }

    /**
     * Delete a specific cache entry.
     */
    deleteCache(key: string): Promise<boolean> {

        return this.#cachePlugin?.deleteCache(key) ?? Promise.resolve(false);
    }

    /**
     * Invalidate cache entries matching a predicate.
     */
    invalidateCache(predicate: (key: string) => boolean): Promise<number> {

        return this.#cachePlugin?.invalidateCache(predicate) ?? Promise.resolve(0);
    }

    /**
     * Invalidate cache entries by path pattern.
     */
    invalidatePath(pattern: string | RegExp | ((key: string) => boolean)): Promise<number> {

        return this.#cachePlugin?.invalidatePath(pattern) ?? Promise.resolve(0);
    }

    /**
     * Get cache statistics.
     */
    cacheStats() {

        const cacheStats = this.#cachePlugin?.stats() ?? { cacheSize: 0, inflightCount: 0 };
        const dedupeInflight = this.#dedupePlugin?.inflightCount() ?? 0;

        return {
            ...cacheStats,
            inflightCount: cacheStats.inflightCount + dedupeInflight
        };
    }

    // ===== Lifecycle Methods =====

    /**
     * Destroy the FetchEngine instance.
     *
     * Aborts all pending requests and cleans up resources.
     * After calling destroy(), the instance cannot be used.
     */
    destroy(): void {

        if (this.#destroyed) {

            console.warn('FetchEngine instance already destroyed');
            return;
        }

        // Abort all pending requests
        this.#instanceAbortController.abort('FetchEngine destroyed');

        // Stop validating and routing config-change events to plugins
        this.#configValidatorCleanup();
        this.#configChangeCleanup();

        // Clean up plugins
        for (const cleanup of this.#pluginCleanups) {

            cleanup();
        }

        this.#pluginCleanups.length = 0;

        // Clear hooks
        this.hooks.clear();

        // Clear cache
        this.clearCache();
    }

    /**
     * Check if the engine has been destroyed.
     */
    isDestroyed(): boolean {

        return this.#destroyed;
    }
}


// ===== FetchEngine Namespace Declaration =====

/**
 * Namespace for FetchEngine types.
 */
export namespace FetchEngine {

    // ===== Augmentable Interfaces =====

    export interface InstanceHeaders extends OptionsInstanceHeaders { }
    export interface InstanceParams extends OptionsInstanceParams { }
    export interface InstanceState extends OptionsInstanceState { }
    export interface InstanceResponseHeaders extends Record<string, string> { }


    // ===== Type Aliases =====

    /** Response body type (json, text, blob, etc.) */
    export type Type = EngineType;

    /** Full configuration options for FetchEngine */
    export type Config<H = InstanceHeaders, P = InstanceParams, S = InstanceState> = EngineConfig<H, P, S>;

    /** Request options passed to callbacks */
    export type RequestOpts<H = InstanceHeaders, P = InstanceParams> = EngineRequestConfig<H, P>;

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

    /** Event data for FetchEngine events */
    export type EventData<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = EventsEventData<S, H, P>;

    /** Event data for deduplication events */
    export type DedupeEventData<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = EventsDedupeEventData<S, H, P>;

    /** Event data for cache events */
    export type CacheEventData<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = EventsCacheEventData<S, H, P>;

    /** Event data for rate limit events */
    export type RateLimitEventData<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = EventsRateLimitEventData<S, H, P>;

    /** Event data for retry events */
    export type RetryEventData<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = EventsRetryEventData<S, H, P>;

    /** Event data for state mutation events */
    export type StateEventData<S = InstanceState> = EventsStateEventData<S>;

    /** Event data for property (header/param) events */
    export type PropertyEventData<T = unknown> = EventsPropertyEventData<T>;

    /** Event data for options change events */
    export type OptionsEventData = EventsOptionsEventData;

    /** Event map for ObserverEngine */
    export type EventMap<S = InstanceState, H = InstanceHeaders, P = InstanceParams> = import('./events.ts').EventMap<S, H, P>;


    // ===== Promise Type =====

    /** Promise that can be aborted and carries a response directive */
    export type Promise<T = unknown, H = InstanceHeaders, P = InstanceParams, RH = InstanceResponseHeaders> = FetchPromise<T, H, P, RH>;
    export type StreamPromise<H = InstanceHeaders, P = InstanceParams, RH = InstanceResponseHeaders> = FetchStreamPromise<DictAndT<H>, DictAndT<P>, DictAndT<RH>>;
    export type Directive = ResponseDirective;
}
