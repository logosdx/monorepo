import { assert, assertOptional, isFunction, isPlainObject } from '../validation.ts';
import { type AnyFunc, assertNotWrapped, markWrapped } from './_helpers.ts';

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
    return error?.constructor?.name === ThrottleError.name;
}

/**
 * Enhanced function interface with cancel capability
 */
export interface ThrottledFunction<T extends AnyFunc> {
    (...args: Parameters<T>): ReturnType<T>;
    cancel(): void;
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
 * @returns A throttled function with cancel capability
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
 *
 * // Cancel clears the throttle state
 * throttledFn.cancel();
 * throttledFn(); // calls fn immediately (state reset)
 * ```
 */
export const throttle = <T extends AnyFunc>(
    fn: T,
    opts: ThrottleOptions
): ThrottledFunction<T> => {

    const {
        delay,
        onThrottle,
        throws = false
    } = opts;

    let lastCalled: number | null = null;
    let lastResult: ReturnType<T> | null = null;
    let lastError: unknown = null;

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

            try {

                lastResult = fn(...args);
                lastError = null;
                lastCalled = now;
            }
            catch (error) {

                lastError = error;
                lastResult = null;
                lastCalled = now;
                throw error;
            }
        }
        else {

            onThrottle?.(args);

            if (throws) {
                throw new ThrottleError('Throttled');
            }

            if (lastError !== null) {
                throw lastError;
            }
        }

        return lastResult!;
    };

    // Add cancel method to clear throttle state
    const cancel = () => {

        lastCalled = null;
        lastResult = null;
        lastError = null;
    };

    // Create enhanced function with cancel method
    const throttledFunction = Object.assign(callback, { cancel });

    markWrapped(throttledFunction, 'throttle');

    return throttledFunction;
};
