import { AnyFunc } from './_helpers.ts';

export class ThrottleError extends Error {
    constructor(message: string) {
        super(message);
    }
}

/**
 * Throttle a function, calling it at most once
 * every `delay` milliseconds. The first call is
 * executed immediately.
 *
 * @param fn function to throttle
 * @param opts options
 * @returns throttled function
 *
 * @example
 * const throttledFn = throttle(fn, {
 *     delay: 1000,
 *     onThrottle: (args) => {
 *         console.log('throttled', args);
 *     },
 * });
 * throttledFn(); // will call fn immediately
 * throttledFn(); // returns the result of the first call
 * await wait(500);
 * throttledFn(); // returns the result of the first call
 * await wait(500);
 * throttledFn(); // will call fn again
 */
export const throttle = <T extends AnyFunc>(
    fn: T,
    opts: {
        delay: number,
        onThrottle?: (args: Parameters<T>) => void,
        throws?: boolean
    }
): T => {

    const {
        delay,
        onThrottle,
        throws = false
    } = opts;

    let lastCalled: number | null = null;
    let lastResult: ReturnType<T> | null = null;

    if (typeof fn !== 'function') {
        throw new Error('fn must be a function');
    }

    if (typeof delay !== 'number' || delay <= 0) {
        throw new Error('delay must be a positive number');
    }

    if (onThrottle && typeof onThrottle !== 'function') {
        throw new Error('onThrottle must be a function');
    }

    if (throws && typeof throws !== 'boolean') {
        throw new Error('throws must be a boolean');
    }

    const callback = function (...args: Parameters<T>): ReturnType<T> {

        const now = Date.now();

        const isThrottled = lastCalled && now - lastCalled < delay;

        if (!isThrottled) {

            lastResult = fn(...args);
            lastCalled = now;
        }

        if (isThrottled) {
            onThrottle?.(args);

            if (throws) {
                throw new ThrottleError('Throttled');
            }
        }

        return lastResult!;
    }

    return callback as T;
}
