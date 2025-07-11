import type { AsyncFunc, Func } from '../types.ts';

export type AnyFunc = Func<any[], any>;
export type AnyAsyncFunc = AsyncFunc<any[], any>;

// Symbol to mark a function as wrapped by a flow control mechanism.
export const FLOW_CONTROL = Symbol('flow-control');

// Type to track which flow control mechanisms have been applied to a function.
export type FlowControls = {
    retry?: boolean,
    circuitBreaker?: boolean,
    rateLimit?: boolean,
    throttle?: boolean,
    debounce?: boolean,
    memoize?: boolean,
    withTimeout?: boolean,
}

// Mark a function as wrapped by a flow control mechanism.
export const markWrapped = <T extends AnyFunc>(fn: T, name: keyof FlowControls) => {

    (fn as any)[FLOW_CONTROL] = (fn as any)[FLOW_CONTROL] || {};
    (fn as any)[FLOW_CONTROL][name] = true;
}

export const assertNotWrapped = <T extends AnyFunc>(fn: T, name: keyof FlowControls) => {

    if ((fn as any)[FLOW_CONTROL]?.[name]) {
        throw new Error(`Function is already wrapped by ${name}`);
    }
}