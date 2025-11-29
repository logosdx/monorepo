import {
    rateLimit,
    circuitBreaker,
    withTimeout,
    type RateLimitOptions,
    type CircuitBreakerOptions,
    type WithTimeoutOptions,
} from './index.ts';

import {
    makeRetryable,
    withInflightDedup,
    type RetryOptions,
    type InflightOptions,
} from '../async/index.ts';

import { assert, isPlainObject } from '../validation/index.ts';
import { AsyncFunc, Func } from '../types.ts';

const flowFunctions = {
    rateLimit,
    circuitBreaker,
    retry: makeRetryable,
    withTimeout,
    inflight: withInflightDedup,
}

type FlowFunctionKey = keyof typeof flowFunctions;


type ComposeFlowOptions<T extends AsyncFunc> = {

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

    /**
     * Deduplicate in-flight requests with the same key.
     */
    inflight?: InflightOptions<Parameters<T>, string, Awaited<ReturnType<T>>>,
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
export const composeFlow = <T extends AsyncFunc>(
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

            const flowFunction = flowFunctions[key] as Func;

            const newFunction = flowFunction(
                finalFunction as T,
                options as never
            ) as T;

            finalFunction = newFunction;
        }
    }

    return finalFunction as T;
}