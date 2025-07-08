import {
    assert,
    wait,
    attempt,
    isFunction,
    assertOptional,
    isPlainObject,
} from '../index.ts';

import { AnyFunc, assertNotWrapped, markWrapped } from './_helpers.ts';

/**
 * Error thrown when the maximum number of retries is reached.
 */
export class RetryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RetryError';
    }
}

export const isRetryError = (error: unknown): error is RetryError => {
    return error?.constructor?.name === RetryError.name;
}

export interface RetryOptions {

    /**
     * Number of retries
     *
     * @default 3
     */
    retries?: number,

    /**
     * Delay between retries
     *
     * @default 0
     */
    delay?: number,

    /**
     * Multiplier for the delay between retries
     *
     * @default 1
     */
    backoff?: number,

    /**
     * Jitter factor for the delay between retries
     *
     * @default 0
     */
    jitter?: number,

    /**
     * Function to determine if the function should be retried
     *
     * @param error error to check
     * @returns true if the function should be retried
     */
    shouldRetry?: (error: Error) => boolean

    /**
     * Abort signal to cancel the retry
     */
    signal?: AbortSignal
}

const validateOpts = (opts: RetryOptions) => {

    assert(isPlainObject(opts), 'opts must be an object');

    assertOptional(
        opts.retries,
        typeof opts.retries === 'number' && opts.retries > 0,
        'retries must be a positive number'
    );

    assertOptional(
        opts.delay,
        typeof opts.delay === 'number' && opts.delay >= 0,
        'delay must be a positive number'
    );

    assertOptional(
        opts.backoff,
        typeof opts.backoff === 'number' && opts.backoff > 0,
        'backoff must be a positive number'
    );

    assertOptional(
        opts.shouldRetry,
        isFunction(opts.shouldRetry),
        'shouldRetry must be a function'
    );

    assertOptional(
        opts.signal,
        opts.signal instanceof AbortSignal,
        'signal must be an AbortSignal'
    );
}

/**
 * Retries a function until it succeeds or the number of retries is reached.
 * @param fn function to retry
 * @param opts options
 * @returns
 *
 * @example
 *
 * const fetchData = retry(
 *     async () => {
 *         const response = await fetch('https://api.example.com/data');
 *         return response.json();
 *     },
 *     {
 *         retries: 3,
 *         delay: 1000,
 *         backoff: 2,
 *         shouldRetry: (error) => error.message.includes('500')
 *     }
 * );
 *
 * const data = await fetchData();
 *
 */
export const retry = async <T extends AnyFunc>(
    fn: T,
    opts: RetryOptions
): Promise<ReturnType<T>> => {

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'retry');
    validateOpts(opts);

    const {
        delay = 0,
        retries = 3,
        backoff = 1,
        jitter = 0,
        shouldRetry = () => true,
        signal
    } = opts;

    let attempts = 0;

    while (attempts < retries) {

        signal?.throwIfAborted();

        const [result, error] = await attempt(fn);

        signal?.throwIfAborted();

        if (result) {
            return result;
        }

        if (error && shouldRetry(error)) {

            await wait(delay * backoff * (1 + jitter * Math.random()));
            attempts++;

            signal?.throwIfAborted();

            continue;
        }

        throw error;
    }

    throw new RetryError('Max retries reached');
}

/**
 * Makes a function retryable.
 * @param fn function to make retryable
 * @param opts options
 * @returns retryable function
 */
export const makeRetryable = <T extends AnyFunc>(
    fn: T,
    opts: RetryOptions
) => {

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'retry');
    validateOpts(opts);

    const retryableFunction = function(...args: Parameters<T>) {

        return retry(fn.bind(fn, ...args), opts)
    } as T;

    markWrapped(retryableFunction, 'retry');

    return retryableFunction;
}