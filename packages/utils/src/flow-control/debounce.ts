import { assert, isFunction, isPlainObject } from '../index.ts';
import { AnyFunc, markWrapped, assertNotWrapped } from './_helpers.ts';

export interface DebounceOptions {
    delay: number;
}

/**
 * Delays the last call of a function for `delay`
 * milliseconds and ignores all subsequent calls
 * until the delay has passed.
 *
 * @param fn function to debounce
 * @param opts options for the debounce function
 * @returns debounced function
 *
 * @example
 * const debouncedFn = debounce(fn, { delay: 1000 });
 * debouncedFn(); // ignored
 * await wait(500);
 * debouncedFn(); // ignored
 * await wait(500);
 * debouncedFn(); // will call fn after 1000ms
 */
export const debounce = <T extends AnyFunc>(fn: T, opts: DebounceOptions) => {

    let timeout: ReturnType<typeof setTimeout>;

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'debounce');
    assert(isPlainObject(opts), 'opts must be an object');

    assert(
        typeof opts.delay === 'number' && opts.delay > 0,
        'opts.delay must be a positive number'
    );

    const debouncedFunction = function(...args: Parameters<T>) {

        clearTimeout(timeout);

        timeout = setTimeout(() => fn(...args), opts.delay);
    }

    markWrapped(debouncedFunction, 'debounce');

    return debouncedFunction;
}
