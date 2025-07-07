import { wait } from '../misc.ts';
import { assert, assertOptional, isFunction, isPlainObject } from '../validation.ts';
import { AnyFunc, assertNotWrapped, markWrapped } from './_helpers.ts';

/**
 * Token bucket implementation of rate limiting
 */
export class RateLimitTokenBucket {
    #tokens: number;
    #lastRefill: number;

    constructor(
        private capacity: number,
        private refillIntervalMs: number // rateLimitWindow
    ) {

        this.#tokens = capacity;
        this.#lastRefill = Date.now();
    }

    #refill() {

        const now = Date.now();
        const elapsed = now - this.#lastRefill;
        const refillRate = this.capacity / this.refillIntervalMs;

        this.#tokens = Math.min(
            this.capacity,
            this.#tokens + refillRate * elapsed
        );

        this.#lastRefill = now;
    }

    consume(): boolean {

        this.#refill();

        if (this.#tokens >= 1) {

            this.#tokens -= 1;
            return true;
        }

        return false;
    }

    get waitTimeMs() {
        this.#refill();
        return Math.ceil(this.refillIntervalMs / this.capacity);
    }

    get nextAvailable() {
        return new Date(Date.now() + this.waitTimeMs);
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
     * console.log('Token acquired');
     */
    async waitForToken(onRateLimit?: (error: RateLimitError) => void | Promise<void>) {

        if (this.consume()) return;

        while (!this.consume()) {

            await onRateLimit?.(new RateLimitError('Rate limit exceeded', this.capacity));
            await wait(this.waitTimeMs);
        }
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
export type RateLimitOptions<T extends AnyFunc> = {
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
export function rateLimit<T extends AnyFunc>(
    fn: T,
    opts: RateLimitOptions<T> & { throws: false }
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

export function rateLimit<T extends AnyFunc>(
    fn: T,
    opts: RateLimitOptions<T> & { throws?: true }
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

export function rateLimit<T extends AnyFunc>(
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

    const tokenBucket = new RateLimitTokenBucket(maxCalls, windowMs);

    const rateLimitedFunction = async function(...args: Parameters<T>): Promise<ReturnType<T>> {

        await tokenBucket.waitForToken(
            async (limitErr) => {
                await onLimitReached?.(
                    limitErr,
                    tokenBucket.nextAvailable,
                    args
                );
                if (throws) throw limitErr;
            }
        );

        return fn(...args);
    };

    markWrapped(rateLimitedFunction, 'rateLimit');

    return rateLimitedFunction;
}
