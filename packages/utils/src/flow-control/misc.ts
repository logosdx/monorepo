import { assert, isFunction } from '../validation/index.ts';
import { AnyAsyncFunc, AnyFunc } from './_helpers.ts';
import { attempt } from '../async/attempt.ts';

/**
 * Creates a deferred promise that can be resolved or rejected externally.
 *
 * Provides a promise with externally accessible resolve and reject methods.
 * Useful for creating promises that need to be controlled from outside
 * their creation context.
 *
 * @example
 * const deferred = new Deferred<string>();
 *
 * // Set up the promise consumer
 * deferred.promise.then(result => {
 *     console.log('Got result:', result);
 * });
 *
 * // Resolve from elsewhere
 * setTimeout(() => {
 *     deferred.resolve('Hello world!');
 * }, 1000);
 *
 * @example
 * class AsyncQueue<T> {
 *     private pending = new Map<string, Deferred<T>>();
 *
 *     async waitFor(id: string): Promise<T> {
 *         if (!this.pending.has(id)) {
 *             this.pending.set(id, new Deferred<T>());
 *         }
 *         return this.pending.get(id)!.promise;
 *     }
 *
 *     complete(id: string, result: T) {
 *         const deferred = this.pending.get(id);
 *         if (deferred) {
 *             deferred.resolve(result);
 *             this.pending.delete(id);
 *         }
 *     }
 * }
 *
 * @example
 * // Coordinate multiple async operations
 * const coordinateWork = () => {
 *     const coordinator = new Deferred<void>();
 *     let completed = 0;
 *
 *     const checkComplete = () => {
 *         if (++completed === 3) {
 *             coordinator.resolve();
 *         }
 *     };
 *
 *     doWork1().then(checkComplete);
 *     doWork2().then(checkComplete);
 *     doWork3().then(checkComplete);
 *
 *     return coordinator.promise;
 * };
 */
export class Deferred<T> {

    public promise: Promise<T>;
    public resolve!: (value: T | PromiseLike<T>) => void;
    public reject!: (reason?: Error | string) => void;

    constructor() {

        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

if (typeof Promise.withResolvers !== 'function') {

    Promise.withResolvers = <T>() => {

        return new Deferred<T>();
    }
}

/**
 * A promise that can be cleared.
 *
 * A promise that can be cleared using the `clear` method.
 */
class TimeoutPromise<T = void> extends Promise<T> {

    clear!: () => void;
}

/**
 * Waits for the specified number of milliseconds before
 * resolving with the optional value.
 *
 * Can be cleared using the `clear` method.
 *
 * @param ms milliseconds to wait
 * @param value value to resolve with
 * @returns TimeoutPromise that resolves after the delay
 *
 * @example
 * await wait(1000); // Wait 1 second
 * console.log('One second has passed');
 *
 * const timeout = wait(1000);
 * timeout.clear(); // Clears the timeout
 *
 * const someVal = await wait(100, 'some value');
 * console.log(someVal); // 'some value'
 *
 * // Add delay between operations
 * for (const item of items) {
 *     await processItem(item);
 *     await wait(100); // Throttle processing
 * }
 *
 * // Retry with backoff
 * async function retryOperation(fn: () => Promise<any>, attempts = 3) {
 *     for (let i = 0; i < attempts; i++) {
 *         try {
 *             return await fn();
 *         } catch (error) {
 *             if (i === attempts - 1) throw error;
 *             await wait(1000 * Math.pow(2, i)); // Exponential backoff
 *         }
 *     }
 * }
 */
export const wait = <T>(ms: number, value: T = true as T) => {

    let timeout: NodeJS.Timeout | number;

    const promise = new TimeoutPromise<T>(
        resolve => {

            timeout = setTimeout(
                () => {

                    timeout = null as never;
                    resolve(value);
                },
                ms
            );
        }
    );

    promise.clear = () => {

        if (!timeout) return;

        clearTimeout(timeout);
        timeout = null as never;
    };

    return promise;
};
type ExtractParameters<T> = T extends (...args: infer P) => any ? P : never;
type ExtractReturn<T> = T extends (...args: any[]) => infer R ? R : never;
type ParamsOfParams<T> = { [K in keyof T]: ExtractParameters<T[K]> };
type ReturnsOfReturns<T> = { [K in keyof T]: ExtractReturn<T[K]> };

interface MakeInSeriesFunc<T extends readonly ((...args: any[]) => any)[]> {
    (...args: ParamsOfParams<T>): ReturnsOfReturns<T>;
}

/**
 * Runs functions in series, waiting for each to complete before running the next.
 * This is a synchronous operation.
 *
 * @param fns functions to run in series
 * @returns array of results from each function execution
 *
 * @example
 * // Assumes observer will return a cleanup function
 * const cleanupStart = observer.on('start', someFunc);
 * const cleanupStop = observer.on('stop', someFunc);
 * const cleanupError = observer.on('error', someFunc);
 * const cleanupCleanup = observer.on('cleanup', someFunc);
 *
 * // ...
 *
 * runInSeries([cleanupStart, cleanupStop, cleanupError, cleanupCleanup]);
 */
export const runInSeries = <T extends Iterable<AnyFunc>>(fns: T) => Array.from(fns, fn => fn()) as ReturnsOfReturns<T>;


/**
 * Creates a function that runs functions in series. This is a synchronous operation.
 * Use `as const` to ensure the array is treated as a tuple if the functions have
 * different parameter types.
 *
 * @param fns functions to run in series
 * @returns function that runs functions in series
 *
 * @example
 * const logStep = (step: string) => console.log(`Step: ${step}`);
 * const saveData = (data: any) => database.save(data);
 * const sendNotification = (message: string) => emailService.send(message);
 *
 * const inSeries = makeInSeries([logStep, saveData, sendNotification] as const);
 * inSeries(['processing'], [userData], ['User created']);
 */
export const makeInSeries = <T extends readonly ((...args: any[]) => any)[]>(
    fns: T
): MakeInSeriesFunc<T> => {

    assert(Array.isArray(fns), 'fns must be an array');
    assert(fns.every(fn => isFunction(fn)), 'fns must be an array of functions');

    return (...args: ParamsOfParams<T>): ReturnsOfReturns<T> => {

        return fns.map(
            (fn, index) => fn(...(args[index] || []))
        ) as ReturnsOfReturns<T>;
    }
}

/**
 * A promise that resolves after the next loop.
 *
 * @returns Promise that resolves after the next loop
 *
 * @example
 *
 * Promise.all(someBatch);
 *
 * await nextLoop();
 *
 * // ...
 */
export const nextLoop = () => new Promise(setImmediate);

/**
 * A promise that resolves after the next tick.
 *
 * @returns Promise that resolves after the next tick
 */
export const nextTick = () => new Promise(typeof process !== 'undefined' ? process.nextTick : setImmediate);


/**
 * A polyfill for the `setImmediate` function that is not available in all browsers.
 */
if (typeof setImmediate !== 'function') {

    let nextHandle = 0;
    const tasks = new Map<number, AnyAsyncFunc>();
    const channel = new MessageChannel();

    // Use MessageChannel because it bypasses the timer queue and its potential delays
    channel.port1.onmessage = async (event) => {
        const handle = event.data;
        const fn = tasks.get(handle);

        if (!fn) return;

        const [, error] = await attempt(fn);
        if (error) console.error('Error in setImmediate', error);
    }

    globalThis.setImmediate = (
        (fn: AnyAsyncFunc, ...args: any[]) => {

            const handle = nextHandle++;
            tasks.set(handle, () => fn(...args));
            channel.port2.postMessage(handle);

            return handle;
        }
    ) as never;

    globalThis.clearImmediate = (
        (handle: number) => {

            tasks.delete(handle);
        }
    ) as never;
}