import { attempt, attemptSync } from './attempt.ts';
import { AnyAsyncFunc, AnyFunc } from './_helpers.ts';

export type MemoizeOptions<T extends AnyFunc> = {

    /**
     * Time to live in milliseconds.
     *
     * @default 1 * 60 * 1000
     */
    ttl: number,

    /**
     * Maximum number of items in the cache.
     *
     * @default 1000
     */
    maxSize: number,

    /**
     * Function to call when an error occurs.
     */
    onError: (error: Error, args: Parameters<T>) => void

    /**
     * Generates the cache key from the arguments.
     *
     * @default JSON.stringify
     */
    generateKey?: (args: Parameters<T>) => string
}

type MemoCache<T extends AnyFunc> = Map<string, {
    value: ReturnType<T>,
    expiresAt: number
}>;

/**
 * Runs the first part of the memoization function before
 * splitting between sync and async.
 */
const prepareMemo = <T extends AnyFunc>(
    opts: {
        fn: T,
        args: Parameters<T>,
        opts: MemoizeOptions<T>,
        cache: MemoCache<T>
    }
): {
    key: string | null,
    now: number,
    isCached: boolean,
    didExpire: boolean,
    value: ReturnType<T> | undefined
} => {

    const {
        args,
        opts: {
            onError,
            generateKey = JSON.stringify,
        },
        cache
    } = opts;

    const now = Date.now();

    const [key, keyError] = attemptSync(() => generateKey(args));

    if (keyError) {

        onError(keyError, args);

        return {
            key,
            now,
            isCached: false,
            didExpire: false,
            value: undefined
        }
    }

    const hasCache = cache.has(key);

    if (hasCache) {

        const item = cache.get(key)!;

        if (item && item.expiresAt > now) {

            return {
                key,
                now,
                isCached: true,
                didExpire: false,
                value: item.value
            }
        }

        cache.delete(key);
    }

    return {
        key,
        now,
        isCached: hasCache,
        didExpire: false,
        value: undefined
    }
};

/**
 * Runs the second part of the memoization function after
 * splitting between sync and async.
 */
const processMemo = <T extends AnyFunc>(
    opts: {
        value?: ReturnType<T> | null,
        error?: Error | null,
        key?: string | null,
        args: Parameters<T>,
        now: number,
        opts: MemoizeOptions<T>,
        cache: MemoCache<T>
    }
) => {

    const {
        value,
        error,
        args,
        key,
        now,
        opts: { onError, ttl, maxSize },
        cache
    } = opts;

    if (error) {
        onError(error, args);
    }

    if (key && value) {

        cache.set(key, {
            value,
            expiresAt: now + ttl
        });
    }

    if (
        maxSize &&
        cache.size >= maxSize
    ) {
        cache.delete(cache.keys().next().value!);
    }

    return value;
}

/**
 * Memoizes a function that is synchronous.
 *
 * @param fn function to memoize
 * @param opts options
 * @returns memoized function
 *
 * @example
 *
 * const fib = (n: number) => {
 *     if (n <= 1) return n;
 *     return fib(n - 1) + fib(n - 2);
 * }
 *
 * const memoizedFib = memoizeSync(fib, {
 *     ttl: 1000,
 *     maxSize: 1000,
 *     onError: (error, args) => {
 *         console.error(error);
 *     }
 * });
 *
 * const result = memoizedFib(10); // takes 10ms
 *
 * console.log(result); // 55
 *
 * const result2 = memoizedFib(10); // takes 0ms
 *
 * console.log(result2); // 55
 */
export const memoizeSync = <T extends AnyFunc>(
    fn: T,
    opts: MemoizeOptions<T>
) => {

    const cache: MemoCache<T> = new Map();

    return function (...args: Parameters<T>) {

        const {
            key,
            now,
            isCached,
            didExpire,
            value: memoValue
        } = prepareMemo({ fn, args, opts, cache });

        if (isCached && !didExpire) {

            return memoValue;
        }

        const [value, error] = attemptSync(() => fn(...args));

        return processMemo({
            value,
            error,
            args,
            key,
            now,
            opts,
            cache
        });
    }
}

/**
 * Memoizes a function that is asynchronous.
 *
 * @param fn function to memoize
 * @param opts options
 * @returns memoized function
 *
 * @example
 *
 * const getUser = async (id: string) => {
 *     return await fetch(`https://api.example.com/users/${id}`);
 * }
 *
 * const memoizedGetUser = memoize(getUser, {
 *     ttl: 1000,
 *     maxSize: 1000,
 *     onError: (error, args) => {
 *         console.error(error);
 *     }
 * });
 *
 * const user = await memoizedGetUser('123');
 *
 * console.log(user); // takes 250ms
 *
 * const user2 = await memoizedGetUser('123');
 *
 * console.log(user2); // takes 0ms
 */
export const memoize = <T extends AnyAsyncFunc>(
    fn: T,
    opts: MemoizeOptions<T>
) => {

    const cache = new Map<string, {
        value: ReturnType<T>,
        expiresAt: number
    }>();

    return async (...args: Parameters<T>) => {

        const {
            key,
            now,
            isCached,
            didExpire,
            value: memoValue
        } = prepareMemo({ fn, args, opts, cache });

        if (isCached && !didExpire) {

            return memoValue;
        }

        const [value, error] = await attempt(() => fn(...args));

        return processMemo({
            value,
            error,
            args,
            key,
            now,
            opts,
            cache
        });
    }
};
