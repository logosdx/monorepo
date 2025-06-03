type ResultTuple<T> = [T, null] | [null, Error];

/**
 * Error monad, go-style.
 *
 * @param fn async function to run
 *
 * @example
 *
 * const [result, error] = await attempt(async () => {
 *     return 'hello';
 * });
 *
 * if (error) {
 *     console.error(error);
 * }
 *
 * console.log(result);
 */
export const attempt = async <T extends () => Promise<any>>(fn: T): Promise<ResultTuple<Awaited<ReturnType<T>>>> => {

    try {
        return [await fn(), null]
    } catch (e) {
        return [null, e as Error]
    }
}

/**
 * Synchronous error monad, go-style.
 *
 * @example
 *
 * const [result, error] = attemptSync(() => {
 *     return 'hello';
 * });
 *
 * if (error) {
 *     console.error(error);
 * }
 *
 * console.log(result);
 */
export const attemptSync = <T extends () => any>(fn: T): ResultTuple<ReturnType<T>> => {

    try {
        return [fn(), null]
    } catch (e) {
        return [null, e as Error]
    }
}
