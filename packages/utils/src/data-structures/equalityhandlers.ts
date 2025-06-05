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
    (a: unknown, b: unknown): boolean;
}

export const equalityHandlers: Map<AnyConstructor, HandleEquatingOf> = new Map();

export const prepareDeepEqualHandlers = (deepEqual: typeof DeepEqualFn) => {

    equalityHandlers.set(Array, (_a, _b) => {

        const a = _a as unknown[];
        const b = _b as unknown[];

        // If length changed, they do not match
        if (!isSameLength(a, b)) return false;

        return forInEvery(a, (val, i) => deepEqual(val, b[i as any]))
    });

    equalityHandlers.set(Object, (_a, _b) => {

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

        return forInEvery(a, (val, i) => deepEqual(val, b[i]));
    });

    equalityHandlers.set(Map, (_a, _b) => {

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
                b.get(key)
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

    equalityHandlers.set(DataView, (_a, _b) => {

        const a = _a as DataView;
        const b = _b as DataView;

        if (
            a.byteLength !== b.byteLength ||
            a.byteOffset !== b.byteOffset
        ) {
            return false;
        }

        return equalityHandlers.get(ArrayBuffer)!(a.buffer, b.buffer);
    });

    // Add support for Error objects
    const ERROR_TYPES = [
        Error, TypeError, ReferenceError, SyntaxError,
        RangeError, EvalError, URIError
    ];

    ERROR_TYPES.forEach(ErrorConstructor => {

        equalityHandlers.set(ErrorConstructor, (_a, _b) => {

            const a = _a as Error;
            const b = _b as Error;

            if (
                a.name !== b.name ||
                a.message !== b.message ||
                a.stack !== b.stack
            ) {
                return false;
            }

            // Compare any additional enumerable properties
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);

            if (aKeys.length !== bKeys.length) {
                return false;
            }

            for (const key of aKeys) {

                if (key !== 'name' && key !== 'message' && key !== 'stack') {

                    if (!deepEqual((a as any)[key], (b as any)[key])) {
                        return false;
                    }
                }
            }

            return true;
        });
    });
}
