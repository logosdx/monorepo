import { assert, assertOptional, isFunction, isPlainObject } from '../validation.ts';
import { AnyFunc, assertNotWrapped, markWrapped } from './_helpers.ts';
import { attempt } from './attempt.ts';

/**
 * Error thrown when a function wrapped with withTimeout exceeds its specified timeout duration.
 *
 * @example
 * ```typescript
 * try {
 *   await someTimeoutWrappedFunction();
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     console.log('Function timed out:', error.message);
 *   }
 * }
 * ```
 */
export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export const isTimeoutError = (error: unknown): error is TimeoutError => {
    return error instanceof TimeoutError;
}

export interface WithTimeoutOptions {
    /**
     * Timeout in milliseconds after which the function will be rejected
     */
    timeout: number;

    /**
     * Abort controller to cancel the operation
     */
    abortController?: AbortController;

    /**
     * Capture errors
     */
    onError?: (error: Error, didTimeout: boolean) => void;

    /**
     * On timeout
     */
    onTimeout?: (error: TimeoutError, execPromise: Promise<any>) => void;

    /**
     * Rethrow errors
     */
    throws?: boolean;
}

/**
 * Wraps an async function with a timeout mechanism. If the function doesn't complete
 * within the specified timeout, it will reject with a TimeoutError.
 *
 * @template T - The type of the function being wrapped
 * @param fn - The async function to wrap with timeout functionality
 * @param opts - Configuration options
 * @param opts.timeout - Timeout in milliseconds after which the function will be rejected
 * @param opts.abortController - Abort controller to cancel the operation
 * @param opts.onError - Callback to handle errors
 * @param opts.onTimeout - Callback to handle timeout
 * @param opts.throws - Whether to throw an error when the function execution exceeds the specified timeout
 * @returns A new async function with the same signature as the original, but with timeout behavior
 * @throws {TimeoutError} When the function execution exceeds the specified timeout
 *
 * @example
 * ```typescript
 * // Basic usage with a fetch request
 * const abortController = new AbortController();
 * const fetchWithTimeout = withTimeout(fetch, { timeout: 5000, abortController });
 *
 * try {
 *   const response = await fetchWithTimeout('https://api.example.com/data', { signal: abortController.signal });
 *   console.log('Request completed within 5 seconds');
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     console.log('Request timed out after 5 seconds');
 *   } else {
 *     console.log('Request failed:', error.message);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Wrapping a custom async function
 * async function processData(data: string[]): Promise<string> {
 *   // Simulate slow processing
 *   await new Promise(resolve => setTimeout(resolve, 3000));
 *   return data.join(', ');
 * }
 *
 * const abortController = new AbortController();
 * const processWithTimeout = withTimeout(processData, { timeout: 2000, abortController });
 *
 * const [result, error] = await attempt(() =>
 *   processWithTimeout(['a', 'b', 'c'], { signal: abortController.signal })
 * );
 *
 * if (error) {
 *   console.log('Processing timed out or failed');
 * } else {
 *   console.log('Result:', result);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using with database operations
 * const queryWithTimeout = withTimeout(
 *   async (query: string) => database.execute(query)
 *   { timeout: 10000 }
 * );
 *
 * try {
 *   const users = await queryWithTimeout('SELECT * FROM users');
 *   return users;
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     throw new Error('Database query timed out after 10 seconds');
 *   }
 *   throw error;
 * }
 * ```
 */
export const withTimeout = <T extends AnyFunc>(
    fn: T,
    opts: WithTimeoutOptions
): T => {

    assert(isFunction(fn), 'fn must be a function');
    assertNotWrapped(fn, 'withTimeout');
    assert(isPlainObject(opts), 'opts must be an object');

    assert(
        typeof opts.timeout === 'number' && opts.timeout > 0,
        'opts.timeout must be a positive number'
    );

    assertOptional(opts.abortController, opts.abortController instanceof AbortController, 'opts.abortController must be an AbortController');
    assertOptional(opts.onError, isFunction(opts.onError), 'opts.onError must be a function');
    assertOptional(opts.onTimeout, isFunction(opts.onTimeout), 'opts.onTimeout must be a function');
    assertOptional(opts.throws, typeof opts.throws === 'boolean', 'opts.throws must be a boolean');

    const withTimeoutFunction = async function(...args: Parameters<T>) {

        let timeoutId: NodeJS.Timeout | null = null;

        const timeoutPromise = new Promise((_, reject) => {

            timeoutId = setTimeout(

                () => {

                    opts.abortController?.abort();

                    execPromise.catch((error) => opts.onError?.(error, true));

                    const error = new TimeoutError('Function timed out');

                    opts.onError?.(error, true);
                    opts.onTimeout?.(error, execPromise);

                    reject(error);
                },
                opts.timeout
            );
        });

        const exec = async () => {

            const [result, error] = await attempt(() => fn(...args));

            clearTimeout(timeoutId!);

            if (error) {

                opts.onError?.(error, false);

                if (opts.throws) {
                    throw error;
                }
            }

            return result;
        }

        const execPromise = exec();

        const result = await Promise.race([
            execPromise,
            timeoutPromise
        ]);

        return result;
    } as T;

    markWrapped(withTimeoutFunction, 'withTimeout');

    return withTimeoutFunction;
}
