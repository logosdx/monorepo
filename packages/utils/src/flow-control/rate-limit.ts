import { AnyFunc } from './_helpers.ts';

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
    onLimitReached?: (error: RateLimitError, args: Parameters<T>) => void
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

    // === Declaration block ===
    const callTimestamps: number[] = [];
    const {
        maxCalls,
        windowMs = 1000,
        throws = true,
        onLimitReached
    } = opts;

    // === Validation block ===
    if (typeof fn !== 'function') {

        throw new Error('fn must be a function');
    }

    if (typeof maxCalls !== 'number' || maxCalls <= 0) {

        throw new Error('maxCalls must be a positive number');
    }

    if (typeof windowMs !== 'number' || windowMs <= 0) {

        throw new Error('windowMs must be a positive number representing time in milliseconds');
    }

    if (onLimitReached && typeof onLimitReached !== 'function') {

        throw new Error('onLimitReached must be a function');
    }

    if (typeof throws !== 'boolean') {

        throw new Error('throws must be a boolean');
    }

    return function rateLimitedFunction(...args: Parameters<T>): ReturnType<T> | undefined {

        // === Declaration block ===
        const now = Date.now();
        const windowStart = now - windowMs;

        // === Business logic block ===
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

            onLimitReached?.(rateLimitError, args);

            if (throws) {

                throw rateLimitError;
            }

            return undefined;
        }

        // === Commit block ===
        callTimestamps.push(now);

        return fn(...args);
    };
}
