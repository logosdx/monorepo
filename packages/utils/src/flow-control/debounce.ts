import { assert, isFunction, isPlainObject } from '../index.ts';
import { markWrapped } from '../_helpers.ts';
import { Func } from '../types.ts';

export interface DebounceOptions {
    delay: number;
    maxWait?: number;
}

export interface DebouncedFunction<T extends Func> {
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
export const debounce = <T extends Func>(fn: T, opts: DebounceOptions): DebouncedFunction<T> => {

    const store: {
        delayTimeout: ReturnType<typeof setTimeout> | undefined;
        maxWaitTimeout: ReturnType<typeof setTimeout> | undefined;
        maxWaitStartTime: number | undefined;
        lastArgs: Parameters<T> | undefined;
    } = {
        delayTimeout: undefined,
        maxWaitTimeout: undefined,
        maxWaitStartTime: undefined,
        lastArgs: undefined
    };

    assert(isFunction(fn), 'fn must be a function');
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

        if (store.delayTimeout !== undefined) {
            clearTimeout(store.delayTimeout);
            store.delayTimeout = undefined;
        }

        if (store.maxWaitTimeout !== undefined) {
            clearTimeout(store.maxWaitTimeout);
            store.maxWaitTimeout = undefined;
        }

        store.maxWaitStartTime = undefined;
    };

    const executeFunction = (args: Parameters<T>) => {

        clearAllTimers();
        store.lastArgs = undefined;
        return fn(...args);
    };

    const debouncedFunction = function(...args: Parameters<T>) {

        store.lastArgs = args;

        if (store.delayTimeout !== undefined) {
            clearTimeout(store.delayTimeout);
        }

        if (opts.maxWait !== undefined && store.maxWaitTimeout === undefined) {
            store.maxWaitStartTime = Date.now();
            store.maxWaitTimeout = setTimeout(() => {
                if (store.lastArgs) {
                    executeFunction(store.lastArgs);
                }
            }, opts.maxWait);
        }

        store.delayTimeout = setTimeout(() => {
            if (store.lastArgs) {
                executeFunction(store.lastArgs);
            }
        }, opts.delay);
    };

    debouncedFunction.flush = function(): ReturnType<T> | undefined {

        if (store.lastArgs === undefined) {
            return undefined;
        }

        const args = store.lastArgs;
        return executeFunction(args);
    };

    debouncedFunction.cancel = function(): void {

        clearAllTimers();
        store.lastArgs = undefined;
    };

    markWrapped(fn, debouncedFunction as any, 'debounce');

    return debouncedFunction as DebouncedFunction<T>;
}
