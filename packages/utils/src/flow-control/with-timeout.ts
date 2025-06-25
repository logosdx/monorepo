import { AnyFunc } from './_helpers.ts';
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

/**
 * Wraps an async function with a timeout mechanism. If the function doesn't complete
 * within the specified timeout, it will reject with a TimeoutError.
 *
 * @template T - The type of the function being wrapped
 * @param fn - The async function to wrap with timeout functionality
 * @param opts - Configuration options
 * @param opts.timeout - Timeout in milliseconds after which the function will be rejected
 * @returns A new async function with the same signature as the original, but with timeout behavior
 * @throws {TimeoutError} When the function execution exceeds the specified timeout
 *
 * @example
 * ```typescript
 * // Basic usage with a fetch request
 * const fetchWithTimeout = withTimeout(fetch, { timeout: 5000 });
 *
 * try {
 *   const response = await fetchWithTimeout('https://api.example.com/data');
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
 * const processWithTimeout = withTimeout(processData, { timeout: 2000 });
 *
 * const [result, error] = await attempt(() =>
 *   processWithTimeout(['a', 'b', 'c'])
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
 *   async (query: string) => database.execute(query),
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
    opts: {
        timeout: number
    }
) => {

    return async (...args: Parameters<T>) => {

        let timeoutId: NodeJS.Timeout | null = null;

        const timeoutPromise = new Promise((_, reject) => {

            timeoutId = setTimeout(

                () => reject(

                    new TimeoutError('Function timed out')
                ),
                opts.timeout
            );
        });

        const exec = async () => {

            const [result, error] = await attempt(() => fn(...args));

            clearTimeout(timeoutId!);

            if (error) {

                throw error;
            }

            return result;
        }

        const result = await Promise.race([
            exec(),
            timeoutPromise
        ]);

        return result;
    }
}
