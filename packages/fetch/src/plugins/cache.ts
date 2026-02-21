import { attempt, SingleFlight } from '@logosdx/utils';

import type {
    _InternalHttpMethods,
    CacheRule,
    CacheConfig,
    RequestSerializer,
    CacheAdapter,
    RequestKeyOptions,
    FetchResponse
} from '../types.ts';

import type { FetchPlugin, FetchEnginePublic, InternalReqOptions } from '../engine/types.ts';

import { requestSerializer } from '../serializers/index.ts';
import { validateMatchRules } from './helpers.ts';

import { ResiliencePolicy } from './base.ts';


/**
 * Default HTTP methods for caching.
 * Only GET requests are cached by default.
 */
const DEFAULT_CACHE_METHODS: _InternalHttpMethods[] = ['GET'];

/**
 * Default TTL for cached responses (60 seconds).
 */
const DEFAULT_CACHE_TTL = 60000;


/**
 * Extended internal state for cache policy.
 * Includes SWR tracking sets for background revalidation.
 */
export interface CachePolicyState<S, H, P> {

    /** Whether the policy is globally enabled */
    enabled: boolean;

    /** Set of HTTP methods this policy applies to */
    methods: Set<string>;

    /** The serializer function for key generation */
    serializer: RequestSerializer<S, H, P>;

    /** Memoized rule cache: method:path -> resolved rule or null */
    rulesCache: Map<string, CacheRule<S, H, P> | null>;

    /** Default TTL in milliseconds */
    ttl: number;

    /** Default stale time for SWR in milliseconds */
    staleIn: number | undefined;

    /** Keys currently being fetched (for SWR deduplication) */
    activeKeys: Set<string>;

    /** Keys currently being revalidated in background */
    revalidatingKeys: Set<string>;
}


/**
 * Cache policy for storing and retrieving response data.
 *
 * Supports stale-while-revalidate (SWR) pattern where stale cached data
 * is returned immediately while fresh data is fetched in the background.
 *
 * @template S - Instance state type
 * @template H - Headers type
 * @template P - Params type
 */
export class CachePolicy<
    S = unknown,
    H = unknown,
    P = unknown
> extends ResiliencePolicy<CacheConfig<S, H, P>, CacheRule<S, H, P>, S, H, P> {

    /**
     * Extended state with cache-specific fields.
     */
    protected state: CachePolicyState<S, H, P> | null = null;

    /**
     * Cache adapter for external storage backends.
     */
    #adapter: CacheAdapter<unknown> | undefined;

    /**
     * Get the cache adapter (if configured).
     */
    get adapter(): CacheAdapter<unknown> | undefined {

        return this.#adapter;
    }

    /**
     * Get active keys set (for SWR tracking).
     */
    get activeKeys(): Set<string> {

        return this.state?.activeKeys ?? new Set();
    }

    /**
     * Get revalidating keys set (for SWR tracking).
     */
    get revalidatingKeys(): Set<string> {

        return this.state?.revalidatingKeys ?? new Set();
    }

    /**
     * Get the default TTL.
     */
    get defaultTtl(): number {

        return this.state?.ttl ?? DEFAULT_CACHE_TTL;
    }

    /**
     * Get the default stale time for SWR.
     */
    get defaultStaleIn(): number | undefined {

        return this.state?.staleIn;
    }

    /**
     * Get the default serializer for caching.
     */
    protected getDefaultSerializer(): RequestSerializer<S, H, P> {

        return requestSerializer as RequestSerializer<S, H, P>;
    }

    /**
     * Get the default HTTP methods for caching.
     */
    protected getDefaultMethods(): _InternalHttpMethods[] {

        return DEFAULT_CACHE_METHODS;
    }

    /**
     * Initialize the cache policy with configuration.
     */
    init(config?: boolean | CacheConfig<S, H, P>): void {

        if (!config) {

            this.state = null;
            this.config = null;
            this.#adapter = undefined;
            return;
        }

        if (config === true) {

            this.state = {
                enabled: true,
                methods: new Set(this.getDefaultMethods()),
                serializer: this.getDefaultSerializer(),
                rulesCache: new Map(),
                ttl: DEFAULT_CACHE_TTL,
                staleIn: undefined,
                activeKeys: new Set(),
                revalidatingKeys: new Set()
            };
            this.config = {} as CacheConfig<S, H, P>;
            this.#adapter = undefined;
            return;
        }

        this.config = config;
        this.#adapter = config.adapter;

        this.state = {
            enabled: config.enabled !== false,
            methods: new Set(config.methods ?? this.getDefaultMethods()),
            serializer: config.serializer ?? this.getDefaultSerializer(),
            rulesCache: new Map(),
            ttl: config.ttl ?? DEFAULT_CACHE_TTL,
            staleIn: config.staleIn,
            activeKeys: new Set(),
            revalidatingKeys: new Set()
        };

        if (config.rules) {

            validateMatchRules(config.rules);
        }
    }

    /**
     * Merge a matched rule with policy defaults.
     */
    protected mergeRuleWithDefaults(rule: CacheRule<S, H, P> | null): CacheRule<S, H, P> {

        if (!this.state) {

            return {
                enabled: true,
                serializer: this.getDefaultSerializer(),
                ttl: DEFAULT_CACHE_TTL,
                staleIn: undefined
            };
        }

        return {
            enabled: true,
            serializer: rule?.serializer ?? this.state.serializer,
            ttl: rule?.ttl ?? this.state.ttl,
            staleIn: rule?.staleIn ?? this.state.staleIn
        };
    }

    /**
     * Resolve cache configuration for a request.
     */
    resolveForRequest(
        method: string,
        path: string,
        ctx: RequestKeyOptions<S, H, P>
    ): CacheRule<S, H, P> | null {

        const skipCallback = this.config?.skip
            ? (c: RequestKeyOptions<S, H, P>) => this.config!.skip!(c) === true
            : undefined;

        return this.resolve(method, path, ctx, skipCallback);
    }

    /**
     * Mark a key as actively being fetched.
     */
    markActive(key: string): void {

        this.state?.activeKeys.add(key);
    }

    /**
     * Unmark a key as actively being fetched.
     */
    unmarkActive(key: string): void {

        this.state?.activeKeys.delete(key);
    }

    /**
     * Check if a key is currently being revalidated.
     */
    isRevalidating(key: string): boolean {

        return this.state?.revalidatingKeys.has(key) ?? false;
    }

    /**
     * Mark a key as being revalidated in background.
     */
    markRevalidating(key: string): void {

        this.state?.revalidatingKeys.add(key);
    }

    /**
     * Unmark a key as being revalidated.
     */
    unmarkRevalidating(key: string): void {

        this.state?.revalidatingKeys.delete(key);
    }

    /**
     * Clear all active keys.
     */
    clearActiveKeys(): void {

        this.state?.activeKeys.clear();
    }

    /**
     * Get all active cache keys.
     */
    getActiveKeys(): string[] {

        return [...(this.state?.activeKeys ?? [])];
    }
}


/** Scope key for storing cache key in request scope */
const CACHE_KEY = Symbol('cacheKey');

/** Scope key for storing cache rule in request scope */
const CACHE_RULE = Symbol('cacheRule');


/**
 * Factory function that creates a cache plugin for FetchEngine.
 *
 * The plugin creates its own `SingleFlight` for cache storage and installs
 * `beforeRequest` (priority -20) and `afterRequest` (priority -10) hooks.
 *
 * @param config - Cache configuration
 * @returns Object with FetchPlugin interface plus cache management methods
 *
 * @example
 *     const cache = cachePlugin({ ttl: 300000, staleIn: 60000 });
 *     const api = new FetchEngine({
 *         baseUrl: 'https://api.example.com',
 *         plugins: [cache]
 *     });
 *
 *     // Access cache methods directly on the plugin
 *     cache.clearCache();
 *     cache.stats();
 */
export function cachePlugin<H = unknown, P = unknown, S = unknown>(
    config: boolean | CacheConfig<S, H, P>
): FetchPlugin<H, P, S> & {
    policy: CachePolicy<S, H, P>;
    flight: SingleFlight<unknown>;
    clearCache(): void;
    clearCacheKey(key: string): Promise<boolean>;
    deleteCache(key: string): Promise<boolean>;
    invalidateCache(predicate: (key: string) => boolean): Promise<number>;
    invalidatePath(pattern: string | RegExp | ((key: string) => boolean)): Promise<number>;
    stats(): { cacheSize: number; inflightCount: number };
} {

    const policy = new CachePolicy<S, H, P>();
    policy.init(config);

    const adapterConfig = config && config !== true
        ? { adapter: (config as CacheConfig<S, H, P>).adapter as any, defaultTtl: policy.defaultTtl, defaultStaleIn: policy.defaultStaleIn }
        : {};

    const flight = new SingleFlight<unknown>(adapterConfig);

    const plugin = {
        name: 'cache',
        policy,
        flight,

        clearCache(): void {

            flight.clearCache();
        },

        clearCacheKey(key: string): Promise<boolean> {

            return flight.deleteCache(key);
        },

        deleteCache(key: string): Promise<boolean> {

            return flight.deleteCache(key);
        },

        invalidateCache(predicate: (key: string) => boolean): Promise<number> {

            return flight.invalidateCache(predicate);
        },

        invalidatePath(pattern: string | RegExp | ((key: string) => boolean)): Promise<number> {

            if (typeof pattern === 'function') {

                return flight.invalidateCache(pattern);
            }

            if (pattern instanceof RegExp) {

                return flight.invalidateCache(key => pattern.test(key));
            }

            return flight.invalidateCache(key => key.includes(pattern));
        },

        stats(): { cacheSize: number; inflightCount: number } {

            return flight.stats();
        },

        install(engine: FetchEnginePublic<H, P, S>): () => void {

            const cleanups: (() => void)[] = [];
            const pendingCacheWrites = new Set<string>();

            // beforeRequest at priority -20: check cache, short-circuit on hit
            cleanups.push(engine.hooks.add('beforeRequest', async (_url, opts, ctx) => {

                const normalizedOpts = opts as InternalReqOptions<H, P, S>;
                const { method, path } = normalizedOpts;

                const directive = normalizedOpts.getDirective?.();
                if (directive === 'stream' || directive === 'raw') return;
                if ((normalizedOpts as any).skipCache === true) return;

                const ruleConfig = policy.resolveForRequest(
                    method,
                    path,
                    normalizedOpts as unknown as RequestKeyOptions<S, H, P>
                );

                if (!ruleConfig) return;

                const key = ruleConfig.serializer!(normalizedOpts as unknown as RequestKeyOptions<S, H, P>);

                // Store in scope for afterRequest
                ctx.scope.set(CACHE_KEY, key);
                ctx.scope.set(CACHE_RULE, ruleConfig);

                const cached = await flight.getCache(key);

                if (cached) {

                    const expiresIn = cached.expiresAt - Date.now();

                    if (!cached.isStale) {

                        engine.emit('cache-hit' as any, {
                            ...normalizedOpts,
                            key,
                            isStale: false,
                            expiresIn,
                        } as any);

                        ctx.returns(cached.value as FetchResponse);
                        return;
                    }

                    // Stale - return immediately + trigger background revalidation
                    engine.emit('cache-stale' as any, {
                        ...normalizedOpts,
                        key,
                        isStale: true,
                        expiresIn,
                    } as any);

                    triggerBackgroundRevalidation(
                        engine, policy, flight, normalizedOpts, key, ruleConfig
                    );

                    ctx.returns(cached.value as FetchResponse);
                    return;
                }

                // Cache miss
                engine.emit('cache-miss' as any, {
                    ...normalizedOpts,
                    key,
                } as any);

            }, { priority: -30 }));

            // afterRequest at priority -10: store response in cache
            cleanups.push(engine.hooks.add('afterRequest', async (response, _url, opts, ctx) => {

                const normalizedOpts = opts as InternalReqOptions<H, P, S>;
                const key = ctx.scope.get<string>(CACHE_KEY);
                const ruleConfig = ctx.scope.get<CacheRule<S, H, P>>(CACHE_RULE);

                if (!key || !ruleConfig) return;

                // Skip if another concurrent request is already writing this key
                if (pendingCacheWrites.has(key)) return;

                pendingCacheWrites.add(key);

                await flight.setCache(key, response, {
                    ttl: ruleConfig.ttl,
                    staleIn: ruleConfig.staleIn
                });

                pendingCacheWrites.delete(key);

                policy.markActive(key);

                engine.emit('cache-set' as any, {
                    ...normalizedOpts,
                    key,
                    expiresIn: ruleConfig.ttl,
                } as any);

            }, { priority: -10 }));

            return () => {

                for (const cleanup of cleanups) {

                    cleanup();
                }
            };
        }
    };

    return plugin;
}


/**
 * Triggers a background revalidation for stale-while-revalidate.
 * Fire and forget - errors are emitted as events, not propagated.
 */
async function triggerBackgroundRevalidation<H, P, S>(
    engine: FetchEnginePublic<H, P, S>,
    policy: CachePolicy<S, H, P>,
    flight: SingleFlight<unknown>,
    normalizedOpts: InternalReqOptions<H, P, S>,
    cacheKey: string,
    cacheConfig: CacheRule<S, H, P>
): Promise<void> {

    if (policy.isRevalidating(cacheKey)) return;

    policy.markRevalidating(cacheKey);

    const controller = new AbortController();
    const bgOptions: InternalReqOptions<H, P, S> = {
        ...normalizedOpts,
        controller,
        signal: controller.signal,
        retry: { maxAttempts: 0 }
    };

    engine.emit('cache-revalidate' as any, {
        ...bgOptions,
        key: cacheKey
    } as any);

    // Use the engine's request method to re-execute the request.
    // The engine is a full FetchEngine but typed as FetchEnginePublic.
    // Cast to access the request method for background revalidation.
    const engineAny = engine as any;

    const [res, fetchErr] = await attempt(async () => {

        const result = await engineAny.request(
            bgOptions.method,
            bgOptions.path,
            {
                headers: bgOptions.headers,
                params: bgOptions.params,
                timeout: bgOptions.timeout,
                abortController: controller,
                skipCache: true,
                retry: { maxAttempts: 0 },
            }
        );

        return result as FetchResponse;
    });

    policy.unmarkRevalidating(cacheKey);

    if (fetchErr) {

        engine.emit('cache-revalidate-error' as any, {
            ...bgOptions,
            key: cacheKey,
            error: fetchErr
        } as any);

        return;
    }

    const [, cacheErr] = await attempt(() =>
        flight.setCache(cacheKey, res, {
            ttl: cacheConfig.ttl,
            staleIn: cacheConfig.staleIn
        })
    );

    if (cacheErr) {

        engine.emit('cache-revalidate-error' as any, {
            ...bgOptions,
            key: cacheKey,
            error: cacheErr
        } as any);

        return;
    }

    policy.markActive(cacheKey);

    engine.emit('cache-set' as any, {
        ...bgOptions,
        key: cacheKey,
        expiresIn: cacheConfig.ttl
    } as any);
}
