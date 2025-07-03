import { assert, assertOptional, isFunction, isPlainObject } from '../validation.ts';
import { AnyFunc, assertNotWrapped, markWrapped } from './_helpers.ts';

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
    return error instanceof RateLimitError;
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
    onLimitReached?: (error: RateLimitError, nextAvailable: Date, args: Parameters<T>) => void
}

/**
 * Rate limiter that restricts function calls to a specified number per time window.
 *
 * Implements a sliding window rate limiting algorithm that tracks call timestamps
 * and enforces limits by either throwing errors or returning undefined when exceeded.
 *
 * @template T - The function type being rate limited
 * @param fn - Function to apply rate limiting to
 * @param opts - Rate limiting configuration options
 * @returns Rate-limited version of the original function
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
 *     rateLimitedFn();
 * }
 *
 * // will throw an error
 * rateLimitedFn();
 *
 * await wait(1001);
 *
 * rateLimitedFn(); // will call fn
 *
 * const rateLimitedWithoutThrowing = rateLimit(fn, {
 *     maxCalls: 10,
 *     windowMs: 1000,
 *     throws: false
 * });
 *
 * for (let i = 0; i < 10; i++) {
 *     rateLimitedWithoutThrowing();
 * }
 *
 * // will return undefined
 * rateLimitedWithoutThrowing();
 *
 *
 */
export function rateLimit<T extends AnyFunc>(
    fn: T,
    opts: RateLimitOptions<T> & { throws: false }
): (...args: Parameters<T>) => ReturnType<T> | undefined;

export function rateLimit<T extends AnyFunc>(
    fn: T,
    opts: RateLimitOptions<T> & { throws?: true }
): (...args: Parameters<T>) => ReturnType<T>;

export function rateLimit<T extends AnyFunc>(
    fn: T,
    opts: RateLimitOptions<T>
): (...args: Parameters<T>) => ReturnType<T> | undefined {

    const callTimestamps: number[] = [];
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

    const rateLimitedFunction = function(...args: Parameters<T>): ReturnType<T> | undefined {

        const now = Date.now();
        const windowStart = now - windowMs;

        // Remove timestamps outside current window
        while (callTimestamps.length > 0 && callTimestamps[0]! <= windowStart) {

            callTimestamps.shift();
        }

        // Check if rate limit exceeded
        if (callTimestamps.length >= maxCalls) {

            const rateLimitError = new RateLimitError(
                `Rate limit exceeded: ${maxCalls} calls per ${windowMs}ms`,
                maxCalls
            );

            const lastCall = callTimestamps[0]!;
            const nextAvailable = new Date(lastCall + windowMs);

            onLimitReached?.(rateLimitError, nextAvailable, args);

            if (throws) {

                throw rateLimitError;
            }

            return undefined;
        }

        callTimestamps.push(now);

        return fn(...args);
    };

    markWrapped(rateLimitedFunction, 'rateLimit');

    return rateLimitedFunction;
}
