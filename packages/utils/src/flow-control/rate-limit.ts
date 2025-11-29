import { wait } from './misc.ts';
import { assert, assertOptional, isFunction, isPlainObject } from '../validation/index.ts';
import { assertNotWrapped, markWrapped } from '../_helpers.ts';
import { Func } from '../types.ts';

/**
 * Token bucket implementation of rate limiting
 *
 * @example
 * const bucket = new RateLimitTokenBucket(10, 1000);
 *
 * bucket.consume();
 * bucket.consume();
 *
 * const rateLimited = async () => {
 *
 *   // 0 ms if tokens are available
 *   // 1000 / 10 = 100 ms if tokens are not available
 *   await bucket.waitAndConsume();
 *   return 'success';
 * }
 */
export class RateLimitTokenBucket {
    #tokens: number;
    #lastRefill: number;
    #stats = {
        totalRequests: 0,
        rejectedRequests: 0,
        totalWaitTime: 0,
        waitCount: 0,
        createdAt: Date.now()
    };
    constructor(
        private capacity: number,
        private refillIntervalMs: number // time per token
    ) {

        this.#tokens = capacity;
        this.#lastRefill = Date.now();
    }

    #refill() {

        const now = Date.now();
        const elapsed = now - this.#lastRefill;
        const refillRate = 1 / this.refillIntervalMs;

        // Protect against clock adjustments or very long delays
        if (elapsed < 0 || elapsed > this.refillIntervalMs * this.capacity * 2) {


            this.#lastRefill = now;
            this.#tokens = this.capacity;
            return;
        }

        if (elapsed > 0) {


            // Calculate how many tokens to add based on elapsed time and refill rate
            const tokensToAdd = elapsed * refillRate;
            this.#tokens = Math.min(this.capacity, this.#tokens + tokensToAdd);
            this.#lastRefill = now;
        }
    }

    reset() {
        this.#tokens = this.capacity;
        this.#lastRefill = Date.now();
    }

    get tokens() {
        return Math.floor(this.#tokens);
    }

    consume(count: number = 1): boolean {

        this.#refill();
        this.#stats.totalRequests++;

        if (this.#tokens >= count) {

            this.#tokens -= count;
            return true;
        }

        this.#stats.rejectedRequests++;
        return false;
    }

    getWaitTimeMs(count: number = 1) {

        this.#refill();
        const deficit = count - this.#tokens;

        if (deficit <= 0) return 0;

        const refillRate = 1 / this.refillIntervalMs;
        // Add a small buffer to ensure enough tokens are available after waiting
        const waitTime = Math.ceil(deficit / refillRate) + 1;
        return waitTime;
    }

    getNextAvailable(count: number = 1) {
        return new Date(Date.now() + this.getWaitTimeMs(count));
    }

    /**
     * Get a snapshot of current statistics and state.
     *
     * @returns Object containing usage statistics and current state
     */
    get snapshot() {
        this.#refill();
        const now = Date.now();
        const uptime = now - this.#stats.createdAt;

        return {
            currentTokens: this.tokens,
            capacity: this.capacity,
            refillIntervalMs: this.refillIntervalMs,
            totalRequests: this.#stats.totalRequests,
            rejectedRequests: this.#stats.rejectedRequests,
            successfulRequests: this.#stats.totalRequests - this.#stats.rejectedRequests,
            rejectionRate: this.#stats.totalRequests > 0 ? this.#stats.rejectedRequests / this.#stats.totalRequests : 0,
            totalWaitTime: this.#stats.totalWaitTime,
            waitCount: this.#stats.waitCount,
            averageWaitTime: this.#stats.waitCount > 0 ? this.#stats.totalWaitTime / this.#stats.waitCount : 0,
            uptime,
            createdAt: this.#stats.createdAt
        };
    }


    /**
     * Waits for the next token to be available before
     * allowing the caller to proceed.
     *
     * @param onRateLimit - Callback to invoke when the rate limit is exceeded
     *
     * @example
     * const rateLimit = new RateLimitTokenBucket(10, 1000);
     *
     * await rateLimit.waitForToken(() => {
     *     console.log('Rate limit exceeded');
     * });
     * console.log('Token available');
     *
     * rateLimit.consume();
     * console.log('Token consumed');
     */
    async waitForToken(
        count: number = 1,
        opts: {
            onRateLimit?: ((error: RateLimitError, nextAvailable: Date) => void) | undefined,
            abortController?: AbortController | undefined,
            jitterFactor?: number | undefined
        } = {}
    ) {

        const {
            onRateLimit,
            abortController,
            jitterFactor = 0
        } = opts;

        // Check if tokens are already available without consuming them
        this.#refill();
        if (this.#tokens >= count) return;

        const waitStart = Date.now();
        this.#stats.waitCount++;

        while (this.#tokens < count) {

            if (abortController?.signal?.aborted) return;

            await onRateLimit?.(
                new RateLimitError('Rate limit exceeded', this.capacity),
                this.getNextAvailable(count)
            );

            await wait(this.getWaitTimeMs(count) + Math.random() * jitterFactor);
            this.#refill();
        }

        const waitEnd = Date.now();
        this.#stats.totalWaitTime += waitEnd - waitStart;
    }

    /**
     * Waits for tokens to be available and consumes them atomically.
     *
     * @param onRateLimit - Callback to invoke when the rate limit is exceeded
     *
     * @example
     * const rateLimit = new RateLimitTokenBucket(10, 1000);
     *
     * await rateLimit.waitAndConsume(() => {
     *     console.log('Rate limit exceeded');
     * });
     * console.log('Token acquired and consumed');
     */
    async waitAndConsume(
        count: number = 1,
        opts: {
            onRateLimit?: ((error: RateLimitError, nextAvailable: Date) => void) | undefined,
            abortController?: AbortController | undefined,
            jitterFactor?: number | undefined
        } = {}
    ): Promise<boolean> {

        const {
            onRateLimit,
            abortController,
            jitterFactor = 0
        } = opts;

        // Check if tokens are already available and consume them atomically
        this.#refill();
        this.#stats.totalRequests++;

        if (this.#tokens >= count) {

            this.#tokens -= count;
            return true;
        }

        const waitStart = Date.now();
        this.#stats.waitCount++;

        while (this.#tokens < count) {

            if (abortController?.signal?.aborted) {

                this.#stats.rejectedRequests++;
                return false;
            }

            await onRateLimit?.(
                new RateLimitError('Rate limit exceeded', this.capacity),
                this.getNextAvailable(count)
            );

            await wait(this.getWaitTimeMs(count) + Math.random() * jitterFactor);
            this.#refill();
        }

        // Consume tokens after wait
        this.#tokens -= count;

        const waitEnd = Date.now();
        this.#stats.totalWaitTime += waitEnd - waitStart;

        return true;
    }
}

/**
 * Error thrown when rate limit is exceeded.
 */
export class RateLimitError extends Error {

    maxCalls: number;

    constructor(message: string, maxCalls: number) {

        super(message);
        this.name = 'RateLimitError';
        this.maxCalls = maxCalls;
    }
}

export const isRateLimitError = (error: unknown): error is RateLimitError => {
    return error?.constructor?.name === RateLimitError.name;
}

/**
 * Configuration options for rate limiting behavior.
 *
 * @template T - The function type being rate limited
 */
export type RateLimitOptions<T extends Func> = {
    /** Maximum number of calls allowed within the time window */
    maxCalls: number,
    /** Time window in milliseconds for rate limiting (default: 1000) */
    windowMs?: number,
    /** Whether to throw an error when limit is exceeded (default: true) */
    throws?: boolean,
    /** Callback invoked when rate limit is exceeded */
    onLimitReached?: (error: RateLimitError, nextAvailable: Date, args: Parameters<T>) => void | Promise<void>
}

/**
 * Rate limiter that restricts function calls to a specified number per time window.
 *
 * Implements a token bucket rate limiting algorithm that enforces limits by either throwing errors or waiting for a token before proceeding.
 *
 * @template T - The function type being rate limited
 * @param fn - Function to apply rate limiting to
 * @param opts - Rate limiting configuration options
 * @returns Rate-limited version of the original function (async)
 *
 * @example
 * // Throwing rate limiter
 * const rateLimitedFn = rateLimit(fn, {
 *     maxCalls: 10,
 *     windowMs: 1000,
 *     throws: true,
 *     onLimitReached: (error) => {
 *         console.error('Rate limit exceeded:', error.message);
 *     }
 * });
 *
 * for (let i = 0; i < 10; i++) {
 *     await rateLimitedFn();
 * }
 *
 * // will throw an error
 * await rateLimitedFn();
 *
 * // Waits for token if throws: false
 * const rateLimitedWithoutThrowing = rateLimit(fn, {
 *     maxCalls: 10,
 *     windowMs: 1000,
 *     throws: false
 * });
 *
 * for (let i = 0; i < 10; i++) {
 *     await rateLimitedWithoutThrowing();
 * }
 *
 * // will wait for token, then call fn
 * await rateLimitedWithoutThrowing();
 *
 */
export function rateLimit<T extends Func>(
    fn: T,
    opts: RateLimitOptions<T> & { throws: false }
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

export function rateLimit<T extends Func>(
    fn: T,
    opts: RateLimitOptions<T> & { throws?: true }
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

export function rateLimit<T extends Func>(
    fn: T,
    opts: RateLimitOptions<T>
): (...args: Parameters<T>) => Promise<ReturnType<T>> {

    const {
        maxCalls,
        windowMs = 1000,
        throws = true,
        onLimitReached
    } = opts;

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'rateLimit');
    assert(isPlainObject(opts), 'opts must be an object');
    assertOptional(maxCalls, typeof maxCalls === 'number' && maxCalls > 0, 'maxCalls must be a positive number');
    assertOptional(windowMs, typeof windowMs === 'number' && windowMs > 0, 'windowMs must be a positive number representing time in milliseconds');
    assertOptional(onLimitReached, isFunction(onLimitReached), 'onLimitReached must be a function');
    assertOptional(throws, typeof throws === 'boolean', 'throws must be a boolean');

    const tokenBucket = new RateLimitTokenBucket(maxCalls, windowMs / maxCalls);

    const rateLimitedFunction = async function(...args: Parameters<T>): Promise<ReturnType<T>> {

        const onceReached = async (limitErr: RateLimitError) => {

            await onLimitReached?.(
                limitErr,
                tokenBucket.getNextAvailable(1),
                args
            );

            if (throws) throw limitErr;
        }

        await tokenBucket.waitAndConsume(1, {
            onRateLimit: onceReached
        });

        return fn(...args);
    };

    markWrapped(fn, rateLimitedFunction as T, 'rateLimit');

    return rateLimitedFunction;
}
