import { AnyFunc } from './_helpers.ts';

/**
 * Delays the last call of a function for `delay`
 * milliseconds and ignores all subsequent calls
 * until the delay has passed.
 *
 * @param fn function to debounce
 * @param delay delay in milliseconds
 * @returns debounced function
 *
 * @example
 * const debouncedFn = debounce(fn, 1000);
 * debouncedFn(); // ignored
 * await wait(500);
 * debouncedFn(); // ignored
 * await wait(500);
 * debouncedFn(); // will call fn after 1000ms
 */
export const debounce = <T extends AnyFunc>(fn: T, delay: number) => {

    let timeout: ReturnType<typeof setTimeout>;

    if (typeof fn !== 'function') {
        throw new Error('fn must be a function');
    }

    if (typeof delay !== 'number' || delay <= 0) {
        throw new Error('delay must be a positive number');
    }

    return function (...args: Parameters<T>) {

        clearTimeout(timeout);

        timeout = setTimeout(() => fn(...args), delay);
    }
}
