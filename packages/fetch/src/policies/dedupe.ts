import type {
    _InternalHttpMethods,
    DedupeRule,
    DeduplicationConfig,
    RequestSerializer,
    RequestKeyOptions
} from '../types.ts';

import type { FetchEngine } from '../engine.ts';

import { ResiliencePolicy } from './base.ts';
import { requestSerializer } from '../serializers/index.ts';


/**
 * Result of dedupe inflight check.
 */
export type DedupeCheckResult<T, S, H, P> =
    | { joined: true; promise: Promise<T>; key: string }
    | { joined: false; key: string; config: DedupeRule<S, H, P> }
    | null;


/**
 * Execution context for dedupe check.
 */
export interface DedupeExecutionContext<S, H, P> {

    /** HTTP method */
    method: string;

    /** Request path */
    path: string;

    /** Full normalized request options */
    normalizedOpts: RequestKeyOptions<S, H, P>;
}


/**
 * Default HTTP methods for deduplication.
 * Only GET requests are deduplicated by default.
 */
const DEFAULT_DEDUPE_METHODS: _InternalHttpMethods[] = ['GET'];


/**
 * Deduplication policy for preventing duplicate concurrent requests.
 *
 * When multiple identical requests are made concurrently, deduplication
 * ensures only one actual network request is made. All callers share
 * the same in-flight promise.
 *
 * Uses request-scoped serialization by default (method + path + params + payload),
 * meaning requests are only considered duplicates if they have identical
 * method, path, parameters, and payload.
 *
 * @template S - Instance state type
 * @template H - Headers type
 * @template P - Params type
 *
 * @example
 * ```typescript
 * const dedupePolicy = new DedupePolicy<State, Headers, Params>();
 *
 * dedupePolicy.init({
 *     enabled: true,
 *     methods: ['GET', 'POST'],
 *     rules: [
 *         { startsWith: '/admin', enabled: false }
 *     ]
 * });
 *
 * const config = dedupePolicy.resolve('GET', '/users', ctx);
 * if (config) {
 *     const key = config.serializer(ctx);
 *     // Use key for deduplication lookup
 * }
 * ```
 */
export class DedupePolicy<
    S = unknown,
    H = unknown,
    P = unknown
> extends ResiliencePolicy<DeduplicationConfig<S, H, P>, DedupeRule<S, H, P>, S, H, P> {

    /** Reference to the FetchEngine instance */
    #engine: FetchEngine<H, P, S>;

    constructor(engine: FetchEngine<H, P, S>) {

        super();
        this.#engine = engine;
    }

    /**
     * Get the default serializer for deduplication.
     * Uses request-scoped serialization (method + path + params + payload).
     */
    protected getDefaultSerializer(): RequestSerializer<S, H, P> {

        return requestSerializer as RequestSerializer<S, H, P>;
    }

    /**
     * Get the default HTTP methods for deduplication.
     * Only GET requests are deduplicated by default.
     */
    protected getDefaultMethods(): _InternalHttpMethods[] {

        return DEFAULT_DEDUPE_METHODS;
    }

    /**
     * Merge a matched rule with policy defaults.
     * For deduplication, this just applies the serializer override.
     */
    protected mergeRuleWithDefaults(rule: DedupeRule<S, H, P> | null): DedupeRule<S, H, P> {

        const serializer = rule?.serializer ?? this.state!.serializer;

        return {
            enabled: true,
            serializer
        };
    }

    /**
     * Resolve deduplication configuration for a request.
     *
     * Convenience method that wraps the base `resolve()` with the
     * policy-specific skip callback.
     */
    resolveForRequest(
        method: string,
        path: string,
        ctx: RequestKeyOptions<S, H, P>
    ): DedupeRule<S, H, P> | null {

        const skipCallback = this.config?.shouldDedupe
            ? (c: RequestKeyOptions<S, H, P>) => this.config!.shouldDedupe!(c) === false
            : undefined;

        return this.resolve(method, path, ctx, skipCallback);
    }

    /**
     * Check for in-flight request and handle joining.
     *
     * If an in-flight request is found, this method:
     * 1. Joins the in-flight request
     * 2. Emits the fetch-dedupe-join event
     * 3. Returns the promise for the caller to await with timeout handling
     *
     * If no in-flight request, this method:
     * 1. Emits the fetch-dedupe-start event
     * 2. Returns config for the caller to track the new request
     *
     * @param ctx - Execution context with request info
     * @returns Check result or null if deduplication disabled
     */
    checkInflight<T>(ctx: DedupeExecutionContext<S, H, P>): DedupeCheckResult<T, S, H, P> {

        const { method, path, normalizedOpts } = ctx;

        const config = this.resolveForRequest(method, path, normalizedOpts);

        if (!config) {

            return null;
        }

        const key = config.serializer!(normalizedOpts);
        const inflight = this.#engine._flight.getInflight(key);

        if (inflight) {

            // Join existing in-flight request
            const waitingCount = this.#engine._flight.joinInflight(key);

            this.#engine.emit('fetch-dedupe-join' as any, {
                ...normalizedOpts,
                key,
                waitingCount,
            });

            return {
                joined: true,
                promise: inflight.promise as Promise<T>,
                key
            };
        }

        // No in-flight request - emit start event, caller will track
        this.#engine.emit('fetch-dedupe-start' as any, {
            ...normalizedOpts,
            key,
        });

        return {
            joined: false,
            key,
            config
        };
    }
}
