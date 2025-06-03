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
 * Rate limiter that queues calls and executes them at specified intervals
 *
 * @param fn function to rate limit
 * @param opts options
 * @returns rate limited function
 *
 * @example
 * const rateLimitedFn = rateLimit(fn, {
 *     maxCalls: 10,
 *     windowMs: 1000
 * });
 *
 * for (let i = 0; i < 10; i++) {
 *     rateLimitedFn();
 * }
 *
 * rateLimitedFn(); // will return undefined
 *
 * await wait(1000);
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
 * rateLimitedWithoutThrowing(); // will return undefined
 *
 *
 */
export function rateLimit<T extends AnyFunc>(
    fn: T,
    opts: {
        maxCalls: number,
        windowMs: number,
        throws?: boolean,
        onLimitReached?: (error: RateLimitError) => void
    }
) {

    const {
        maxCalls,
        windowMs,
        throws = true,
        onLimitReached
    } = opts;

    const calls: number[] = [];

    const callback = function (...args: Parameters<T>) {
        const now = Date.now();

        // Remove calls outside the window
        while (calls.length && calls[0]! <= now - windowMs) {
            calls.shift();
        }

        if (calls.length < maxCalls) {
            calls.push(now);
            return fn(...args);
        }

        const error = new RateLimitError('Rate limit exceeded', maxCalls);

        onLimitReached?.(error);

        if (throws) {
            throw error;
        }

        return undefined;
    };

    return callback as ((...args: Parameters<T>) => ReturnType<T> | undefined);
}
