import { AnyFunc } from './_helpers.ts';

/**
 * Error thrown when a throttled function is called too frequently
 */
export class ThrottleError extends Error {

    constructor(message: string) {

        super(message);
        this.name = 'ThrottleError';
    }
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
    if (typeof fn !== 'function') {

        throw new Error('fn must be a function');
    }

    if (typeof delay !== 'number' || delay <= 0) {

        throw new Error('delay must be a positive number');
    }

    if (onThrottle !== undefined && typeof onThrottle !== 'function') {

        throw new Error('onThrottle must be a function');
    }

    if (typeof throws !== 'boolean') {

        throw new Error('throws must be a boolean');
    }

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

    return callback as T;
};
