import {
    rateLimit,
    circuitBreaker,
    makeRetryable,
    withTimeout,
    type RateLimitOptions,
    type CircuitBreakerOptions,
    type RetryOptions,
    type WithTimeoutOptions,
} from './index.ts';

import { AnyAsyncFunc } from './_helpers.ts';
import { assert, isPlainObject } from '../validation.ts';

const flowFunctions = {
    rateLimit,
    circuitBreaker,
    retry: makeRetryable,
    withTimeout,
}

type FlowFunctionKey = keyof typeof flowFunctions;


type ComposeFlowOptions<T extends AnyAsyncFunc> = {

    /**
     * Rate limit the function.
     */
    rateLimit?: RateLimitOptions<T>,

    /**
     * Create a circuit breaker for the function.
     */
    circuitBreaker?: CircuitBreakerOptions<T>,

    /**
     * Retry the function.
     */
    retry?: RetryOptions,

    /**
     * Timeout the function.
     */
    withTimeout?: WithTimeoutOptions,
}

/**
 * Compose multiple flow control functions into a single function.
 * The order of the keys in the options you pass will determine
 * how the flow controls are applied to your function.
 *
 * @param fn - The function to compose
 * @param opts - The options for the flow control functions
 * @returns The composed function
 */
export const composeFlow = <T extends AnyAsyncFunc>(
    fn: T,
    opts: ComposeFlowOptions<T>
): T => {

    assert(isPlainObject(opts), 'Options must be an object');

    const keys = Object.keys(opts) as FlowFunctionKey[];
    assert(keys.length >= 2, 'Options must have at least two keys');

    // Validate that all keys are valid flow functions
    for (const key of keys) {

        assert(
            key in flowFunctions,
            `${key} is not a flow function`
        );
    }

    let finalFunction: any = fn;

    for (const key of keys) {

        const options = opts[key];

        if (key in flowFunctions && options) {

            const flowFunction = flowFunctions[key];

            const newFunction = flowFunction(
                finalFunction as T,
                options as never
            ) as T;

            finalFunction = newFunction;
        }
    }

    return finalFunction as T;
}