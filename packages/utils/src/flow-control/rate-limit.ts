import { AnyFunc } from './_helpers.ts';

export class RateLimitError extends Error {

    maxCalls: number;

    constructor(message: string, maxCalls: number) {
        super(message);
        this.name = 'RateLimitError';
        this.maxCalls = maxCalls;
    }
}

/**
 * Rate limiter that limits the number of calls to a function
 * to a specified number of calls per time window
 *
 * @param fn function to rate limit
 * @param opts options
 * @returns rate limited function
 *
 * @example
 * const rateLimitedFn = rateLimit(fn, {
 *     maxCalls: 10,
 *     windowMs: 1000,
 *     throws: true,
 *     onLimitReached: (error) => {
 *         console.error(error);
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
    opts: {
        maxCalls: number,
        windowMs: number,
        throws: false,
        onLimitReached?: (error: RateLimitError) => void
    }
): (...args: Parameters<T>) => ReturnType<T> | undefined;

export function rateLimit<T extends AnyFunc>(
    fn: T,
    opts: {
        maxCalls: number,
        windowMs: number,
        throws?: true,
        onLimitReached?: (error: RateLimitError) => void
    }
): (...args: Parameters<T>) => ReturnType<T>;

export function rateLimit<T extends AnyFunc>(
    fn: T,
    opts: {
        maxCalls: number,
        windowMs?: number,
        throws?: boolean,
        onLimitReached?: (error: RateLimitError, args: Parameters<T>) => void
    }
): (...args: Parameters<T>) => ReturnType<T> | undefined {

    // Declaration block
    const callTimestamps: number[] = [];
    const shouldThrow = opts.throws ?? true;

    // pull out the options and set defaults
    const {
        maxCalls,
        windowMs = 1000,
        onLimitReached,
        throws = true
    } = opts

    // Validation block
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

        // Declaration block
        const now = Date.now();
        const windowStart = now - windowMs;

        // BL block - remove timestamps outside current window
        while (callTimestamps.length > 0 && callTimestamps[0]! <= windowStart) {

            callTimestamps.shift();
        }

        // BL block - check if we've exceeded the rate limit
        if (callTimestamps.length >= maxCalls) {

            const rateLimitError = new RateLimitError(
                `Rate limit exceeded: ${maxCalls} calls per ${windowMs}ms`,
                maxCalls
            );

            if (onLimitReached) {

                onLimitReached(rateLimitError, args); // pass arguments to hook
            }

            if (shouldThrow) {

                throw rateLimitError;
            }

            return undefined;
        }

        // Commit block - record this call and execute function
        callTimestamps.push(now);

        return fn(...args);
    };
}
