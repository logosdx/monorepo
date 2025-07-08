import {
    isSameLength,
    allKeysValid,
    allItemsValid,
    hasNoConstructor,
    isPrimitive,
    hasSameConstructor,
    isFunction,
} from '../index.ts';

import {
    AnyConstructor,
    isDangerousKey,
    getSafeKeys,
    equalityHandlers,
} from './helpers.ts';

export const prepareEqualsHandlers = () => {

    equalityHandlers.set(Array, (_a, _b, seen) => {

        const a = _a as unknown[];
        const b = _b as unknown[];

        // If length changed, they do not match
        if (!isSameLength(a, b)) return false;

        return allKeysValid(a, (val, i) => equals(val, b[i as any], seen))
    });

    equalityHandlers.set(Object, (_a, _b, seen) => {

        const a = _a as Record<string, unknown>;
        const b = _b as Record<string, unknown>;

        if (a === b) return true;
        if (hasNoConstructor(a) || hasNoConstructor(b)) return false;

        // Get safe keys (excluding dangerous prototype pollution keys)
        const aSafeKeys = getSafeKeys(a);
        const bSafeKeys = getSafeKeys(b);

        const aKeys = new Set(aSafeKeys);
        const bKeys = new Set(bSafeKeys);

        if (!isSameLength(aKeys, bKeys)) return false;

        const bHasAKeys = allItemsValid(aKeys, val => bKeys.has(val as string));
        const aHasBKeys = allItemsValid(bKeys, val => aKeys.has(val as string));

        if (!aHasBKeys || !bHasAKeys) return false;

        // Only compare safe keys
        return aSafeKeys.every(key => equals(a[key], b[key], seen));
    });

    equalityHandlers.set(Map, (_a, _b, seen) => {

        const a = _a as Map<unknown, unknown>;
        const b = _b as Map<unknown, unknown>;

        // If size changed, they do not match
        if (a.size !== b.size) return false;

        const aKeys = new Set(a.keys());
        const bKeys = new Set(b.keys());

        const bHasAKeys = allItemsValid(aKeys, val => bKeys.has(val));
        const aHasBKeys = allItemsValid(bKeys, val => aKeys.has(val));

        if (!aHasBKeys || !bHasAKeys) return false;

        return allItemsValid(
            a.keys(),
            (key) => equals(
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

        return allItemsValid(a, (val) => b.has(val));
    });

    equalityHandlers.set(Date, (a, b) => (

        (a as Date).getTime() === (b as Date).getTime()
    ));

    equalityHandlers.set(RegExp, (a, b) => {

        return (
            ((a as RegExp).source === (b as RegExp).source) &&
            ((a as RegExp).flags === (b as RegExp).flags)
        );
    });

    equalityHandlers.set(Function, (a, b) => (

        (a as Function).toString() === (b as Function).toString()
    ));

    equalityHandlers.set(Error, (a, b) => (

        (a as Error).toString() === (b as Error).toString()
    ));

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
            const aKeys = [...Object.keys(a), ...Object.getOwnPropertyNames(a)].filter(key => {
                const descriptor = Object.getOwnPropertyDescriptor(a, key);
                return descriptor && descriptor.enumerable && !isDangerousKey(key);
            });

            const bKeys = [...Object.keys(b), ...Object.getOwnPropertyNames(b)].filter(key => {
                const descriptor = Object.getOwnPropertyDescriptor(b, key);
                return descriptor && descriptor.enumerable && !isDangerousKey(key);
            });

            // Remove built-in Error properties from comparison
            const builtInProps = new Set(['name', 'message', 'stack']);
            const aCustomKeys = aKeys.filter(key => !builtInProps.has(key));
            const bCustomKeys = bKeys.filter(key => !builtInProps.has(key));

            if (aCustomKeys.length !== bCustomKeys.length) {
                return false;
            }

            // Check that all custom properties exist in both objects
            for (const key of aCustomKeys) {
                if (!bCustomKeys.includes(key)) {
                    return false;
                }
            }

            // Deep compare all custom properties
            for (const key of aCustomKeys) {

                if (!equals((a as any)[key], (b as any)[key], seen)) {
                    return false;
                }
            }

            return true;
        });
    });
}

let equalityHandlersInitialized = false;

/**
 * Recursively checks if there are changes in the current structure.
 * Returns immediately after detecting a single change.
 * @param change changed item
 * @param current current item
 * @param seen WeakMap to track circular references with comparison paths (internal use)
 */
export const equals = (change: unknown, current: unknown, seen = new WeakMap<WeakKey, WeakKey>()): boolean => {

    if (equalityHandlersInitialized === false) {
        prepareEqualsHandlers();
        equalityHandlersInitialized = true;
    }

    // Primatives can be checked with basic js strict equality
    if (isPrimitive(change) || isPrimitive(current)) return change === current;

    // Same reference check
    if (change === current) return true;

    // Check for circular references - use a WeakMap to track object pairs
    if (change && typeof change === 'object' && current && typeof current === 'object') {

        // Check if we've already compared this exact pair
        if (seen.has(change) && seen.get(change) === current) {
            return true; // We've already determined these are equal in a previous comparison
        }

        // Check for self-referential circular structures that would cause infinite recursion
        if (change === current) {
            return true;
        }

        // Add this comparison pair to prevent infinite recursion
        seen.set(change as WeakKey, current as WeakKey);
    }

    // A change in contructor means it changed
    if (
        !hasSameConstructor(change as AnyConstructor, current as AnyConstructor)
    )
        return false
    ;

    const cur = current as { constructor: AnyConstructor };

    // Check if these items are different from one another
    // Each contructor may have a special way of equalsing
    // Get the actual constructor from the prototype chain to avoid prototype pollution
    const actualConstructor = Object.getPrototypeOf(cur)?.constructor || cur.constructor;
    let typeequalsFunc = equalityHandlers.get(actualConstructor);

    // Handles GeneratorFunction and AsyncFunction
    if (
        !typeequalsFunc &&
        isFunction(change) &&
        isFunction(current)
    ) {

        typeequalsFunc = equalityHandlers.get(Function);
    }

    if (!typeequalsFunc) {

        return change === current;
    }

    const result = typeequalsFunc(change, current, seen);

    return result;
};
