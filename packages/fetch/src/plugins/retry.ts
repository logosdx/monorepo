import { attempt, wait } from '@logosdx/utils';

import type { RetryConfig } from '../types.ts';
import type { FetchPlugin, FetchEnginePublic, InternalReqOptions } from '../engine/types.ts';
import { FetchError } from '../helpers/fetch-error.ts';
import { DEFAULT_RETRY_CONFIG } from '../helpers/validations.ts';


/**
 * Factory function that creates a retry plugin for FetchEngine.
 *
 * The plugin installs an `execute` (pipe) hook at priority `-20` that
 * wraps the core request function in a retry loop with exponential backoff.
 *
 * @param defaultConfig - Default retry configuration for the engine
 * @returns FetchPlugin that can be installed via `engine.use()` or `plugins` config
 *
 * @example
 *     const api = new FetchEngine({
 *         baseUrl: 'https://api.example.com',
 *         plugins: [
 *             retryPlugin({ maxAttempts: 3, baseDelay: 1000 })
 *         ]
 *     });
 */
export function retryPlugin<H = unknown, P = unknown, S = unknown>(
    defaultConfig?: RetryConfig | false
): FetchPlugin<H, P, S> {

    const resolveRetryConfig = (opts: InternalReqOptions<H, P, S>): Required<RetryConfig> => {

        if (defaultConfig === false) {

            return { ...DEFAULT_RETRY_CONFIG, maxAttempts: 0 };
        }

        const base = defaultConfig
            ? { ...DEFAULT_RETRY_CONFIG, ...defaultConfig }
            : DEFAULT_RETRY_CONFIG;

        if (!opts.retry) return base as Required<RetryConfig>;

        return { ...base, ...opts.retry } as Required<RetryConfig>;
    };

    return {
        name: 'retry',

        install(engine: FetchEnginePublic<H, P, S>): () => void {

            const cleanup = engine.hooks.add('execute', (async (next: () => Promise<any>, opts: any, _ctx: any) => {

                const normalizedOpts = opts as InternalReqOptions<H, P, S>;
                const mergedRetry = resolveRetryConfig(normalizedOpts);

                if (mergedRetry.maxAttempts === 0) {

                    const [result, err] = await attempt(async () => next());

                    if (err) {

                        if ((err as FetchError).aborted && normalizedOpts.getTotalTimeoutFired?.()) {

                            (err as FetchError).timedOut = true;
                        }

                        throw err;
                    }

                    return result;
                }

                let attemptNum = 1;
                let lastError: FetchError | undefined;

                while (attemptNum <= mergedRetry.maxAttempts!) {

                    if (normalizedOpts.controller.signal.aborted) {

                        const err = lastError ?? new FetchError('Request aborted');
                        err.aborted = true;
                        err.method = err.method || normalizedOpts.method;
                        err.path = err.path || normalizedOpts.path;
                        err.status = err.status || 499;
                        err.step = err.step || 'fetch';
                        err.timedOut = normalizedOpts.getTotalTimeoutFired?.() ?? false;
                        throw err;
                    }

                    let attemptController: AbortController;
                    let attemptTimeoutPromise: ReturnType<typeof wait> | undefined;
                    let attemptTimeoutFired = false;

                    if (normalizedOpts.attemptTimeout !== undefined) {

                        attemptController = new AbortController();

                        normalizedOpts.controller.signal.addEventListener('abort', () => {

                            attemptTimeoutPromise?.clear();
                            attemptController.abort();
                        }, { once: true });

                        attemptTimeoutPromise = wait(normalizedOpts.attemptTimeout);
                        attemptTimeoutPromise.then(() => {

                            attemptTimeoutFired = true;
                            attemptController.abort();
                        });
                    }
                    else {

                        attemptController = normalizedOpts.controller;
                    }

                    // Temporarily swap the controller/signal for this attempt
                    const origController = normalizedOpts.controller;
                    const origSignal = normalizedOpts.signal;

                    if (normalizedOpts.attemptTimeout !== undefined) {

                        (normalizedOpts as any).controller = attemptController;
                        (normalizedOpts as any).signal = attemptController.signal;
                    }

                    normalizedOpts.attempt = attemptNum;

                    const [result, err] = await attempt(async () => next());

                    // Restore original controller/signal
                    if (normalizedOpts.attemptTimeout !== undefined) {

                        (normalizedOpts as any).controller = origController;
                        (normalizedOpts as any).signal = origSignal;
                    }

                    attemptTimeoutPromise?.clear();

                    if (err === null) return result;

                    lastError = err as FetchError;

                    if (lastError!.aborted) {

                        const totalTimeoutFired = normalizedOpts.getTotalTimeoutFired?.() ?? false;

                        if (attemptTimeoutFired || totalTimeoutFired) {

                            lastError!.timedOut = true;
                        }
                    }

                    if (normalizedOpts.controller.signal.aborted) {

                        throw lastError!;
                    }

                    const shouldRetry = await mergedRetry.shouldRetry(lastError!, attemptNum);

                    if (shouldRetry && attemptNum < mergedRetry.maxAttempts!) {

                        const delay = (
                            typeof shouldRetry === 'number'
                                ? shouldRetry
                                : calculateRetryDelay(attemptNum, mergedRetry)
                        );

                        engine.emit('retry' as any, {
                            ...normalizedOpts,
                            error: lastError,
                            attempt: attemptNum,
                            nextAttempt: attemptNum + 1,
                            delay
                        } as any);

                        await wait(delay);

                        if (normalizedOpts.controller.signal.aborted) {

                            if (normalizedOpts.getTotalTimeoutFired?.()) {

                                lastError!.timedOut = true;
                            }

                            throw lastError!;
                        }

                        attemptNum++;
                        continue;
                    }

                    throw lastError!;
                }

                throw new FetchError('Unexpected end of retry logic');

            }) as any, { priority: -20 });

            return cleanup;
        }
    };
}


/**
 * Calculate delay for retry attempt using exponential backoff.
 */
function calculateRetryDelay(attemptNo: number, retry: Required<RetryConfig>): number {

    const { baseDelay, maxDelay, useExponentialBackoff } = retry;

    if (!useExponentialBackoff) return Math.min(baseDelay, maxDelay!);

    const delay = baseDelay * Math.pow(2, attemptNo - 1);

    return Math.min(delay, maxDelay!);
}
