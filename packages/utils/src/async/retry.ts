import { wait } from '../flow-control/misc.ts';
import { markWrapped, assertNotWrapped } from '../_helpers.ts';
import { attempt } from './attempt.ts';
import {
    assert,
    isFunction,
    assertOptional,
    isPlainObject,
} from '../validation/index.ts';
import { Func } from '../types.ts';


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
    jitterFactor?: number,

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

    /**
     * Throw the last error encountered if all retries fail
     *
     * @default false
     */
    throwLastError?: boolean

    /**
     * Callback invoked before each retry attempt
     *
     * @param error last error encountered
     * @param attempt current attempt number
     */
    onRetry?: (error: Error, attempt: number) => void | Promise<void>;

    /**
     * Callback invoked after all retry attempts have been exhausted.
     * Use to take over error handling and return a fallback value.
     *
     * @param error last error encountered
     * @param args original function arguments
     * @returns fallback value
     */
    onRetryExhausted?: (error: Error) => ReturnType<Func> | Promise<ReturnType<Func>>;
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
export const retry = async <T extends Func>(
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
        jitterFactor = 0,
        shouldRetry = () => true,
        signal,
        throwLastError = false,
        onRetryExhausted,
        onRetry,
    } = opts;

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < retries) {

        signal?.throwIfAborted();

        if (attempts > 0 && onRetry && lastError) {
            await onRetry(lastError, attempts);
        }

        const [result, error] = await attempt(fn);

        signal?.throwIfAborted();

        if (error === null) {
            return result;
        }

        lastError = error;

        if (error && shouldRetry(error)) {

            await wait(delay * backoff * (1 + jitterFactor * Math.random()));
            attempts++;

            signal?.throwIfAborted();

            continue;
        }

        throw error;
    }

    if (onRetryExhausted) {
        return onRetryExhausted(lastError!);
    }

    if (throwLastError) {
        throw lastError!;
    }

    throw new RetryError('Max retries reached');
}

/**
 * Makes a function retryable.
 * @param fn function to make retryable
 * @param opts options
 * @returns retryable function
 */
export const makeRetryable = <T extends Func>(
    fn: T,
    opts: RetryOptions
) => {

    assert(isFunction(fn), 'fn must be a function');
    validateOpts(opts);

    const retryableFunction = function(...args: Parameters<T>) {

        return retry(fn.bind(fn, ...args), opts)
    } as T;

    markWrapped(fn, retryableFunction, 'retry');

    return retryableFunction;
}


