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

/**
 * Enhanced key generation that handles object property ordering,
 * circular references, and non-serializable values.
 *
 * This function provides more reliable key generation than JSON.stringify
 * by handling edge cases like circular references, consistent object key ordering,
 * and various JavaScript types.
 *
 * **Limitations:**
 * - Functions serialize to `[Function]` (identity-based comparison not supported)
 * - Symbols serialize to `symbol:description` (not truly unique)
 * - WeakMap/WeakSet serialize to `[WeakMap/WeakSet]` (cannot iterate contents)
 * - Errors serialize to `error:name:message` (stack traces ignored)
 *
 * @template T - The function type being memoized
 * @param args - The arguments to generate a key from
 * @returns A string key suitable for caching
 *
 * @example
 * ```typescript
 * const key = serializer([{a: 1, b: 2}, "test", 123]);
 * // Returns: '{"a":1,"b":2}|"test"|123'
 *
 * const key2 = serializer([new Date(1000), /test/i]);
 * // Returns: 'date:1000|regex:/test/i'
 * ```
 */
export const serializer = (args: unknown[]): string => {

    const seen = new WeakSet();

    const stringify = (value: any): string => {

        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return `"${value}"`;
        if (typeof value === 'number') {

            if (Object.is(value, -0)) return '-0';
            return String(value);
        }
        if (typeof value === 'boolean') return String(value);
        if (typeof value === 'bigint') return `bigint:${value}`;
        if (typeof value === 'symbol') return `symbol:${String(value)}`;
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Date) return `date:${value.getTime()}`;
        if (value instanceof RegExp) return `regex:${value.toString()}`;
        if (value instanceof Error) return `error:${value.name}:${value.message}`;

        if (typeof value === 'object') {

            if (seen.has(value)) return '[Circular]';
            seen.add(value);

            if (value instanceof Map) {

                const pairs = Array.from(value.entries())
                    .map(([k, v]) => `${stringify(k)}:${stringify(v)}`)
                    .sort();
                const result = `map:${pairs.join(',')}`;
                seen.delete(value);
                return result;
            }

            if (value instanceof Set) {

                const values = Array.from(value).map(stringify).sort();
                const result = `set:${values.join(',')}`;
                seen.delete(value);
                return result;
            }

            if (value instanceof WeakMap || value instanceof WeakSet) {

                seen.delete(value);
                return '[WeakMap/WeakSet]';
            }

            if (Array.isArray(value)) {

                const result = `[${value.map(stringify).join(',')}]`;
                seen.delete(value);
                return result;
            }

            // Plain objects
            const keys = Object.keys(value).sort();
            const pairs = keys.map(key => `"${key}":${stringify(value[key])}`);
            const result = `{${pairs.join(',')}}`;
            seen.delete(value);
            return result;
        }

        return String(value);
    };

    const key = args.map(stringify).join('|');

    return key || '0'; // Use '0' for functions with no arguments
}
