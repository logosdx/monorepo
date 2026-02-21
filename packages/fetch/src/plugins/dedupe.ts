import { Deferred } from '@logosdx/utils';

import type {
    _InternalHttpMethods,
    DedupeRule,
    DeduplicationConfig,
    RequestSerializer,
    RequestKeyOptions
} from '../types.ts';

import type { FetchPlugin, FetchEnginePublic, InternalReqOptions } from '../engine/types.ts';

import { ResiliencePolicy } from './base.ts';
import { requestSerializer } from '../serializers/index.ts';


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
 * @template S - Instance state type
 * @template H - Headers type
 * @template P - Params type
 */
export class DedupePolicy<
    S = unknown,
    H = unknown,
    P = unknown
> extends ResiliencePolicy<DeduplicationConfig<S, H, P>, DedupeRule<S, H, P>, S, H, P> {

    /**
     * Get the default serializer for deduplication.
     */
    protected getDefaultSerializer(): RequestSerializer<S, H, P> {

        return requestSerializer as RequestSerializer<S, H, P>;
    }

    /**
     * Get the default HTTP methods for deduplication.
     */
    protected getDefaultMethods(): _InternalHttpMethods[] {

        return DEFAULT_DEDUPE_METHODS;
    }

    /**
     * Merge a matched rule with policy defaults.
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
}


/**
 * Factory function that creates a dedupe plugin for FetchEngine.
 *
 * The plugin maintains a local `Map<string, Promise>` for in-flight tracking
 * and installs an `execute` (pipe) hook at priority `-30`.
 *
 * @param config - Deduplication configuration
 * @returns FetchPlugin that can be installed via `engine.use()` or `plugins` config
 *
 * @example
 *     const api = new FetchEngine({
 *         baseUrl: 'https://api.example.com',
 *         plugins: [dedupePlugin(true)]
 *     });
 */
export function dedupePlugin<H = unknown, P = unknown, S = unknown>(
    config: boolean | DeduplicationConfig<S, H, P>
): FetchPlugin<H, P, S> & { inflightCount(): number } {

    const policy = new DedupePolicy<S, H, P>();
    policy.init(config);

    const inflightMap = new Map<string, { promise: Promise<unknown>; waitingCount: number }>();

    return {
        name: 'dedupe',

        inflightCount(): number {

            return inflightMap.size;
        },

        install(engine: FetchEnginePublic<H, P, S>): () => void {

            const cleanup = engine.hooks.add('execute', (async (next: () => Promise<any>, opts: any) => {

                const normalizedOpts = opts as InternalReqOptions<H, P, S>;
                const { method, path } = normalizedOpts;

                const directive = normalizedOpts.getDirective?.();
                if (directive === 'stream' || directive === 'raw') return next();

                const ruleConfig = policy.resolveForRequest(
                    method,
                    path,
                    normalizedOpts as unknown as RequestKeyOptions<S, H, P>
                );

                if (!ruleConfig) return next();

                const key = ruleConfig.serializer!(normalizedOpts as unknown as RequestKeyOptions<S, H, P>);
                const inflight = inflightMap.get(key);

                if (inflight) {

                    inflight.waitingCount++;

                    engine.emit('dedupe-join' as any, {
                        ...normalizedOpts,
                        key,
                        waitingCount: inflight.waitingCount,
                    } as any);

                    // Race the shared promise against the joiner's own abort signal
                    const controller = normalizedOpts.controller;

                    if (controller?.signal?.aborted) {

                        const { FetchError } = await import('../helpers/fetch-error.ts');
                        const err = new FetchError('Request aborted');
                        err.aborted = true;
                        err.method = normalizedOpts.method;
                        err.path = normalizedOpts.path;
                        err.status = 0;
                        err.step = 'fetch';
                        throw err;
                    }

                    return new Promise((resolve, reject) => {

                        let settled = false;

                        const onAbort = async () => {

                            if (settled) return;
                            settled = true;

                            const { FetchError } = await import('../helpers/fetch-error.ts');
                            const err = new FetchError('Request aborted');
                            err.aborted = true;
                            err.method = normalizedOpts.method;
                            err.path = normalizedOpts.path;
                            err.status = 0;
                            err.step = 'fetch';
                            reject(err);
                        };

                        controller?.signal?.addEventListener('abort', onAbort, { once: true });

                        inflight.promise.then(
                            (result) => {

                                if (!settled) {

                                    settled = true;
                                    controller?.signal?.removeEventListener('abort', onAbort);
                                    resolve(result);
                                }
                            },
                            (err) => {

                                if (!settled) {

                                    settled = true;
                                    controller?.signal?.removeEventListener('abort', onAbort);
                                    reject(err);
                                }
                            }
                        );
                    });
                }

                // No in-flight request - we're the leader
                engine.emit('dedupe-start' as any, {
                    ...normalizedOpts,
                    key,
                } as any);

                const deferred = new Deferred<unknown>();
                deferred.promise.catch(() => { /* handled by the request flow */ });

                inflightMap.set(key, { promise: deferred.promise, waitingCount: 1 });

                try {

                    const result = await next();
                    deferred.resolve(result);
                    return result;
                }
                catch (err) {

                    deferred.reject(err as Error);
                    throw err;
                }
                finally {

                    inflightMap.delete(key);
                }
            }) as any, { priority: -30 });

            return cleanup;
        }
    };
}
