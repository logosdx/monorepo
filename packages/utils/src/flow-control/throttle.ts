import { assert, assertOptional, isFunction, isPlainObject } from '../validation.ts';
import { AnyFunc, assertNotWrapped, markWrapped } from './_helpers.ts';

/**
 * Error thrown when a throttled function is called too frequently
 */
export class ThrottleError extends Error {

    constructor(message: string) {

        super(message);
        this.name = 'ThrottleError';
    }
}

export const isThrottleError = (error: unknown): error is ThrottleError => {
    return error instanceof ThrottleError;
}

/**
 * Options for configuring throttle behavior
 */
export interface ThrottleOptions {

    /** Minimum delay in milliseconds between function calls */
    delay: number;
    /** Optional callback executed when throttling occurs */
    onThrottle?: (args: unknown[]) => void;
    /** Whether to throw an error when throttling occurs (default: false) */
    throws?: boolean;
}

/**
 * Throttle a function, calling it at most once every `delay` milliseconds.
 * The first call is executed immediately, subsequent calls within the delay
 * window return the cached result from the last execution.
 *
 * @param fn - The function to throttle
 * @param opts - Throttle configuration options
 * @returns A throttled version of the input function
 *
 * @throws {Error} When `fn` is not a function
 * @throws {Error} When `delay` is not a positive number
 * @throws {Error} When `onThrottle` is provided but not a function
 * @throws {Error} When `throws` is provided but not a boolean
 * @throws {ThrottleError} When throttling occurs and `throws` is true
 *
 * @example
 * ```typescript
 * const throttledFn = throttle(fn, {
 *     delay: 1000,
 *     onThrottle: (args) => {
 *         console.log('throttled', args);
 *     },
 * });
 *
 * throttledFn(); // calls fn immediately
 * throttledFn(); // returns cached result
 * await wait(500);
 * throttledFn(); // returns cached result
 * await wait(500);
 * throttledFn(); // calls fn again
 * ```
 */
export const throttle = <T extends AnyFunc>(
    fn: T,
    opts: ThrottleOptions
): T => {

    const {
        delay,
        onThrottle,
        throws = false
    } = opts;

    // State variables
    let lastCalled: number | null = null;
    let lastResult: ReturnType<T> | null = null;

    // Validate input parameters
    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'throttle');
    assert(isPlainObject(opts), 'opts must be an object');

    assert(
        typeof delay === 'number' && delay > 0,
        'delay must be a positive number'
    );

    assertOptional(onThrottle, isFunction(onThrottle), 'onThrottle must be a function');
    assertOptional(throws, typeof throws === 'boolean', 'throws must be a boolean');

    const callback = function (...args: Parameters<T>): ReturnType<T> {

        const now = Date.now();
        const isThrottled = lastCalled !== null && now - lastCalled < delay;

        if (!isThrottled) {

            // Execute the function and cache the result
            lastResult = fn(...args);
            lastCalled = now;
        }
        else {

            // Handle throttled call
            onThrottle?.(args);

            if (throws) {
                throw new ThrottleError('Throttled');
            }
        }

        return lastResult!;
    };

    markWrapped(callback, 'throttle');

    return callback as T;
};
