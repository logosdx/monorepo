import type { Func } from './types.ts';

// Symbol to mark a function as wrapped by a flow control mechanism.
export const ORIGINAL_FUNCTION = Symbol('original-function');

// Type to track which flow control mechanisms have been applied to a function.
export type FlowControls = {
    retry?: boolean,
    circuitBreaker?: boolean,
    rateLimit?: boolean,
    throttle?: boolean,
    debounce?: boolean,
    memoize?: boolean,
    withTimeout?: boolean,
    inflight?: boolean,
}

const maps: Record<keyof FlowControls, WeakMap<Func, Func>> = {
    retry: new WeakMap(),
    circuitBreaker: new WeakMap(),
    rateLimit: new WeakMap(),
    throttle: new WeakMap(),
    debounce: new WeakMap(),
    memoize: new WeakMap(),
    withTimeout: new WeakMap(),
    inflight: new WeakMap(),
};

type WrappedFn<T extends Func = Func> = T & {
    [ORIGINAL_FUNCTION]?: WrappedFn<Func> | undefined;
}

// Mark a function as wrapped by a flow control mechanism.
export const markWrapped = <T extends WrappedFn>(fn: T, wrapped: T, name: keyof FlowControls) => {

    const original = fn[ORIGINAL_FUNCTION] || fn;

    assertNotWrapped(fn, name);

    wrapped[ORIGINAL_FUNCTION] = original;

    maps[name].set(wrapped, original);
}


// Assert that a function is not already wrapped by a specific flow control mechanism.
export const assertNotWrapped = <T extends WrappedFn>(fn: T, name: keyof FlowControls) => {

    if (maps[name].has(fn)) {

        throw new Error(`Function is already wrapped with ${name}`);
    }
}
