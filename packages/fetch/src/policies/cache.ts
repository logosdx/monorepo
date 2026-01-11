import type {
    _InternalHttpMethods,
    CacheRule,
    CacheConfig,
    RequestSerializer,
    CacheAdapter,
    RequestKeyOptions
} from '../types.ts';

import type { FetchEngine } from '../engine.ts';

import { ResiliencePolicy } from './base.ts';
import { requestSerializer } from '../serializers/index.ts';
import { validateMatchRules } from '../helpers.ts';


/**
 * Result of cache check operation.
 */
export type CacheCheckResult<T, S, H, P> =
    | { hit: true; value: T; key: string }
    | { hit: false; key: string; config: CacheRule<S, H, P> }
    | null;


/**
 * Execution context for cache check.
 */
export interface CacheExecutionContext<S, H, P> {

    /** HTTP method */
    method: string;

    /** Request path */
    path: string;

    /** Full normalized request options */
    normalizedOpts: RequestKeyOptions<S, H, P>;

    /** Original request options (for background revalidation) */
    options: unknown;

    /** Clear any pending timeout */
    clearTimeout: () => void;
}


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
 * Uses request-scoped serialization by default (method + path + params + payload),
 * meaning requests are only considered cache hits if they have identical
 * method, path, parameters, and payload.
 *
 * @template S - Instance state type
 * @template H - Headers type
 * @template P - Params type
 *
 * @example
 * ```typescript
 * const cachePolicy = new CachePolicy<State, Headers, Params>();
 *
 * cachePolicy.init({
 *     enabled: true,
 *     ttl: 300000,      // 5 minutes
 *     staleIn: 60000,   // Stale after 1 minute (triggers SWR)
 *     rules: [
 *         { startsWith: '/static', ttl: 3600000 },  // 1 hour for static
 *         { startsWith: '/admin', enabled: false }   // No caching for admin
 *     ]
 * });
 * ```
 */
export class CachePolicy<
    S = unknown,
    H = unknown,
    P = unknown
> extends ResiliencePolicy<CacheConfig<S, H, P>, CacheRule<S, H, P>, S, H, P> {

    /** Reference to the FetchEngine instance */
    #engine: FetchEngine<H, P, S>;

    /**
     * Extended state with cache-specific fields.
     * Note: We override the base state type to include cache-specific fields.
     */
    protected state: CachePolicyState<S, H, P> | null = null;

    /**
     * Cache adapter for external storage backends.
     */
    #adapter: CacheAdapter<unknown> | undefined;

    constructor(engine: FetchEngine<H, P, S>) {

        super();
        this.#engine = engine;
    }

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
     * Uses request-scoped serialization (method + path + params + payload).
     */
    protected getDefaultSerializer(): RequestSerializer<S, H, P> {

        return requestSerializer as RequestSerializer<S, H, P>;
    }

    /**
     * Get the default HTTP methods for caching.
     * Only GET requests are cached by default.
     */
    protected getDefaultMethods(): _InternalHttpMethods[] {

        return DEFAULT_CACHE_METHODS;
    }

    /**
     * Initialize the cache policy with configuration.
     *
     * Extends base init to handle cache-specific fields (ttl, staleIn, adapter).
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
     * Includes cache-specific fields (ttl, staleIn).
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
     *
     * Convenience method that wraps the base `resolve()` with the
     * policy-specific skip callback.
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

    /**
     * Check cache for a request.
     *
     * Handles cache hit/miss logic including stale-while-revalidate:
     * - Fresh hit: returns cached value, clears timeout
     * - Stale hit: returns cached value, triggers background revalidation, clears timeout
     * - Miss: returns null with config for the caller to proceed with fetch
     * - Disabled: returns null
     *
     * @param ctx - Execution context with request info
     * @returns Cache check result or null if caching disabled
     */
    async checkCache<T>(ctx: CacheExecutionContext<S, H, P>): Promise<CacheCheckResult<T, S, H, P>> {

        const { method, path, normalizedOpts, options, clearTimeout } = ctx;

        const config = this.resolveForRequest(method, path, normalizedOpts);

        if (!config) {

            return null;
        }

        const key = config.serializer!(normalizedOpts);
        const cached = await this.#engine._flight.getCache(key);

        if (cached) {

            const expiresIn = cached.expiresAt - Date.now();

            if (!cached.isStale) {

                // Fresh cache hit
                this.#engine.emit('fetch-cache-hit' as any, {
                    ...normalizedOpts,
                    key,
                    isStale: false,
                    expiresIn,
                });

                clearTimeout();

                return { hit: true, value: cached.value as T, key };
            }

            // Stale - return immediately + trigger background revalidation
            this.#engine.emit('fetch-cache-stale' as any, {
                ...normalizedOpts,
                key,
                isStale: true,
                expiresIn,
            });

            this.#engine._triggerBackgroundRevalidation(method, path, options as any, key, config);
            clearTimeout();

            return { hit: true, value: cached.value as T, key };
        }

        // Cache miss
        this.#engine.emit('fetch-cache-miss' as any, {
            ...normalizedOpts,
            key,
        });

        return { hit: false, key, config };
    }
}
