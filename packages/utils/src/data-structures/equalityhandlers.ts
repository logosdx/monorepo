import {
    isSameLength,
    forInEvery,
    forOfEvery,
    hasNoConstructor,
} from '../index.ts';

import type {
    AnyConstructor,
    deepEqual as DeepEqualFn,
} from './index.ts';

export interface HandleEquatingOf {
    (a: unknown, b: unknown, seen?: WeakMap<WeakKey, WeakKey>): boolean;
}

export const equalityHandlers: Map<AnyConstructor, HandleEquatingOf> = new Map();

export const prepareDeepEqualHandlers = (deepEqual: typeof DeepEqualFn) => {

    equalityHandlers.set(Array, (_a, _b, seen) => {

        const a = _a as unknown[];
        const b = _b as unknown[];

        // If length changed, they do not match
        if (!isSameLength(a, b)) return false;

        return forInEvery(a, (val, i) => deepEqual(val, b[i as any], seen))
    });

    equalityHandlers.set(Object, (_a, _b, seen) => {

        const a = _a as Record<string, unknown>;
        const b = _b as Record<string, unknown>;

        if (a === b) return true;
        if (hasNoConstructor(a) || hasNoConstructor(b)) return false;

        const aKeys = new Set(Object.keys(a));
        const bKeys = new Set(Object.keys(b));

        if (!isSameLength(aKeys, bKeys)) return false;

        const bHasAKeys = forOfEvery(aKeys, val => bKeys.has(val as string));
        const aHasBKeys = forOfEvery(bKeys, val => aKeys.has(val as string));

        if (!aHasBKeys || !bHasAKeys) return false;

        return forInEvery(a, (val, i) => deepEqual(val, b[i], seen));
    });

    equalityHandlers.set(Map, (_a, _b, seen) => {

        const a = _a as Map<unknown, unknown>;
        const b = _b as Map<unknown, unknown>;

        // If size changed, they do not match
        if (a.size !== b.size) return false;

        const aKeys = new Set(a.keys());
        const bKeys = new Set(b.keys());

        const bHasAKeys = forOfEvery(aKeys, val => bKeys.has(val));
        const aHasBKeys = forOfEvery(bKeys, val => aKeys.has(val));

        if (!aHasBKeys || !bHasAKeys) return false;

        return forOfEvery(
            a.keys(),
            (key) => deepEqual(
                a.get(key),
                b.get(key),
                seen
            )
        );
    });

    equalityHandlers.set(Set, (_a, _b) => {

        const a = _a as Set<unknown>;
        const b = _b as Set<unknown>;

        // If size changed, they do not match
        if (a.size !== b.size) return false;

        return forOfEvery(a, (val) => b.has(val));
    });

    equalityHandlers.set(Date, (a, b) => (

        +(a as Date) === +(b as Date)
    ));

    equalityHandlers.set(RegExp, (_a, _b) => {

        const a = _a as RegExp;
        const b = _b as RegExp;

        return (
            (a.source === b.source) &&
            (a.flags === b.flags)
        );
    });

    equalityHandlers.set(Function, (_a, _b) => {

        const a = _a as Function;
        const b = _b as Function;

        if (a === b) return true;

        return a.toString() === b.toString();

    });

    // Add support for TypedArrays
    const TYPED_ARRAYS = [
        Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
        Int32Array, Uint32Array, Float32Array, Float64Array,
        BigInt64Array, BigUint64Array
    ];

    TYPED_ARRAYS.forEach(TypedArrayConstructor => {

        equalityHandlers.set(TypedArrayConstructor, (_a, _b) => {

            const a = _a as any;
            const b = _b as any;

            if (a.length !== b.length) return false;

            for (let i = 0; i < a.length; i++) {

                if (a[i] !== b[i]) return false;
            }

            return true;
        });
    });

    equalityHandlers.set(ArrayBuffer, (_a, _b) => {

        const a = _a as ArrayBuffer;
        const b = _b as ArrayBuffer;

        if (a.byteLength !== b.byteLength) return false;

        const aView = new Uint8Array(a);
        const bView = new Uint8Array(b);

        for (let i = 0; i < aView.length; i++) {

            if (aView[i] !== bView[i]) return false;
        }

        return true;
    });

    equalityHandlers.set(DataView, (_a, _b, seen) => {

        const a = _a as DataView;
        const b = _b as DataView;

        if (
            a.byteLength !== b.byteLength ||
            a.byteOffset !== b.byteOffset
        ) {
            return false;
        }

        return equalityHandlers.get(ArrayBuffer)!(a.buffer, b.buffer, seen);
    });

    // Add support for Error objects
    const ERROR_TYPES = [
        Error, TypeError, ReferenceError, SyntaxError,
        RangeError, EvalError, URIError
    ];

    ERROR_TYPES.forEach(ErrorConstructor => {

        equalityHandlers.set(ErrorConstructor, (_a, _b, seen) => {

            const a = _a as Error;
            const b = _b as Error;

            // Compare basic error properties
            if (a.name !== b.name || a.message !== b.message) {
                return false;
            }

            // Don't compare stack traces as they include line numbers and are usually different
            // Get all enumerable properties including those that might not show up in Object.keys for Error objects
            const aKeys = new Set([...Object.keys(a), ...Object.getOwnPropertyNames(a)].filter(key => {
                const descriptor = Object.getOwnPropertyDescriptor(a, key);
                return descriptor && descriptor.enumerable;
            }));

            const bKeys = new Set([...Object.keys(b), ...Object.getOwnPropertyNames(b)].filter(key => {
                const descriptor = Object.getOwnPropertyDescriptor(b, key);
                return descriptor && descriptor.enumerable;
            }));

            // Remove built-in Error properties from comparison
            const builtInProps = new Set(['name', 'message', 'stack']);
            const aCustomKeys = [...aKeys].filter(key => !builtInProps.has(key));
            const bCustomKeys = [...bKeys].filter(key => !builtInProps.has(key));

            if (aCustomKeys.length !== bCustomKeys.length) {
                return false;
            }

            // Check that all custom properties exist in both objects
            for (const key of aCustomKeys) {
                if (!bKeys.has(key)) {
                    return false;
                }
            }

            // Deep compare all custom properties
            for (const key of aCustomKeys) {

                if (!deepEqual((a as any)[key], (b as any)[key], seen)) {
                    return false;
                }
            }

            return true;
        });
    });
}
