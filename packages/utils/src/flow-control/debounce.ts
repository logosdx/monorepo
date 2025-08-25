import { assert, isFunction, isPlainObject } from '../index.ts';
import { type AnyFunc, markWrapped, assertNotWrapped } from './_helpers.ts';

export interface DebounceOptions {
    delay: number;
    maxWait?: number;
}

export interface DebouncedFunction<T extends AnyFunc> {
    (...args: Parameters<T>): void;
    flush(): ReturnType<T> | undefined;
    cancel(): void;
}

/**
 * Delays the last call of a function for `delay`
 * milliseconds and ignores all subsequent calls
 * until the delay has passed.
 *
 * @param fn function to debounce
 * @param opts options for the debounce function
 * @returns debounced function with flush and cancel methods
 *
 * @example
 * const debouncedFn = debounce(fn, { delay: 1000 });
 * debouncedFn(); // ignored
 * await wait(500);
 * debouncedFn(); // ignored
 * await wait(500);
 * debouncedFn(); // will call fn after 1000ms
 *
 * // Enhanced interface
 * const result = debouncedFn.flush(); // execute immediately
 * debouncedFn.cancel(); // prevent execution
 */
export const debounce = <T extends AnyFunc>(fn: T, opts: DebounceOptions): DebouncedFunction<T> => {

    let delayTimeout: ReturnType<typeof setTimeout> | undefined;
    let maxWaitTimeout: ReturnType<typeof setTimeout> | undefined;
    let lastArgs: Parameters<T> | undefined;
    let maxWaitStartTime: number | undefined;

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'debounce');
    assert(isPlainObject(opts), 'opts must be an object');

    assert(
        typeof opts.delay === 'number' && opts.delay > 0,
        'opts.delay must be a positive number'
    );

    if (opts.maxWait !== undefined) {
        assert(
            typeof opts.maxWait === 'number' && opts.maxWait > 0,
            'opts.maxWait must be a positive number'
        );
    }

    const clearAllTimers = () => {

        if (delayTimeout !== undefined) {
            clearTimeout(delayTimeout);
            delayTimeout = undefined;
        }

        if (maxWaitTimeout !== undefined) {
            clearTimeout(maxWaitTimeout);
            maxWaitTimeout = undefined;
        }

        maxWaitStartTime = undefined;
    };

    const executeFunction = (args: Parameters<T>) => {

        clearAllTimers();
        lastArgs = undefined;
        return fn(...args);
    };

    const debouncedFunction = function(...args: Parameters<T>) {

        lastArgs = args;

        if (delayTimeout !== undefined) {
            clearTimeout(delayTimeout);
        }

        if (opts.maxWait !== undefined && maxWaitTimeout === undefined) {
            maxWaitStartTime = Date.now();
            maxWaitTimeout = setTimeout(() => {
                if (lastArgs) {
                    executeFunction(lastArgs);
                }
            }, opts.maxWait);
        }

        delayTimeout = setTimeout(() => {
            if (lastArgs) {
                executeFunction(lastArgs);
            }
        }, opts.delay);
    };

    debouncedFunction.flush = function(): ReturnType<T> | undefined {

        if (lastArgs === undefined) {
            return undefined;
        }

        const args = lastArgs;
        return executeFunction(args);
    };

    debouncedFunction.cancel = function(): void {

        clearAllTimers();
        lastArgs = undefined;
    };

    markWrapped(debouncedFunction, 'debounce');

    return debouncedFunction as DebouncedFunction<T>;
}
