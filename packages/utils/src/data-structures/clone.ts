import {
    isPrimitive,
} from '../index.ts';

import {
    type AnyConstructor,
    isDangerousKey,
    cloneHandlers,
} from './helpers.ts';

export const prepareCloneHandlers = () => {

    cloneHandlers.set(Array, (arr: unknown[], seen: WeakMap<any, any>) =>
        arr.map((v) => clone(v, seen))
    );

    cloneHandlers.set(Object, <T extends object>(obj: T, seen: WeakMap<any, any>) => {

        const copy: Partial<T> = {};
        const keys = Object.keys(obj) as Array<keyof T>;

        for (const key of keys) {

            // Skip dangerous prototype pollution keys
            if (isDangerousKey(key as string)) {
                continue;
            }

            copy[key] = clone(obj[key], seen);
        }

        return copy;
    });

    cloneHandlers.set(Map, (_map: Map<unknown, unknown>, seen: WeakMap<any, any>) => {

        const copy = new Map();

        for (const entry of _map.entries()) {

            const [key, val] = entry;
            copy.set(key, clone(val, seen));
        }

        return copy;
    });

    cloneHandlers.set(Set, (_set: Set<unknown>, seen: WeakMap<any, any>) => {

        const copy = new Set();

        for (const original of _set) {

            copy.add(clone(original, seen));
        }

        return copy;
    });

    // Add support for TypedArrays and ArrayBuffer
    const TYPED_ARRAYS = [
        Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
        Int32Array, Uint32Array, Float32Array, Float64Array,
        BigInt64Array, BigUint64Array
    ];

    TYPED_ARRAYS.forEach(TypedArrayConstructor => {

        cloneHandlers.set(TypedArrayConstructor, (arr: any) => {

            return new TypedArrayConstructor(arr);
        });
    });

    cloneHandlers.set(ArrayBuffer, (buffer: ArrayBuffer) => {

        return buffer.slice(0);
    });

    cloneHandlers.set(DataView, (view: DataView) => {

        const clonedBuffer = view.buffer.slice(0);
        return new DataView(clonedBuffer, view.byteOffset, view.byteLength);
    });

    // Add support for Error objects
    const ERROR_TYPES = [
        Error, TypeError, ReferenceError, SyntaxError,
        RangeError, EvalError, URIError
    ];

    ERROR_TYPES.forEach(ErrorConstructor => {

        cloneHandlers.set(ErrorConstructor, (error: Error, seen: WeakMap<any, any>) => {

            const cloned = new (error.constructor as ErrorConstructor)(error.message);

            if (error.name) {
                cloned.name = error.name;
            }

            if (error.stack) {
                cloned.stack = error.stack;
            }

            // Copy any additional enumerable own properties
            const keys = Object.keys(error);
            for (const key of keys) {

                if (
                    key !== 'name' &&
                    key !== 'message' &&
                    key !== 'stack' &&
                    !isDangerousKey(key)
                ) {

                    (cloned as any)[key] = clone((error as any)[key], seen);
                }
            }

            return cloned;
        });
    });

    cloneHandlers.set(Date, (date: Date) => {

        return new Date(date.getTime());
    });

    cloneHandlers.set(RegExp, (regex: RegExp) => {

        return new RegExp(regex.source, regex.flags);
    });

}

let cloneHandlersInitialized = false;


/**
 * Deep clones Objects, Arrays, Maps and Sets with circular reference protection
 * @param original - The value to clone
 * @param seen - WeakMap to track circular references (internal use)
 * @returns {any} Cloned value
 * @example
 * const obj = { a: 1, b: { c: 2 } };
 * obj.circular = obj; // Create circular reference
 * const cloned = clone(obj); // Works without stack overflow
 */
export const clone = <T>(original: T, seen = new WeakMap()): T => {

    if (!cloneHandlersInitialized) {
        prepareCloneHandlers();
        cloneHandlersInitialized = true;
    }

    // Primatives do not have issues with hoisting
    if (isPrimitive(original)) {
        return original;
    }

    // Check for circular references
    if (seen.has(original as any)) {

        return seen.get(original as any);
    }

    // Get the actual constructor from the prototype chain to avoid prototype pollution
    const actualConstructor = Object.getPrototypeOf(original)?.constructor || original!.constructor;
    const cloneType = cloneHandlers.get(actualConstructor as AnyConstructor);

    if (!cloneType) {
        return original;
    }

    // Create type-appropriate placeholder and add to seen map BEFORE cloning
    let placeholder: T;

    if (Array.isArray(original)) {

        placeholder = [] as any as T;
        seen.set(original as any, placeholder);

        const cloned = cloneType(original, seen);

        // Fill the placeholder array
        (placeholder as any).push(...cloned);

        return placeholder;

    } else if (original instanceof Map) {

        placeholder = new Map() as any as T;
        seen.set(original as any, placeholder);

        const cloned = cloneType(original, seen);

        // Fill the placeholder map
        for (const [key, value] of cloned) {

            (placeholder as any).set(key, value);
        }

        return placeholder;

    } else if (original instanceof Set) {

        placeholder = new Set() as any as T;
        seen.set(original as any, placeholder);

        const cloned = cloneType(original, seen);

        // Fill the placeholder set
        for (const value of cloned) {

            (placeholder as any).add(value);
        }

        return placeholder;

    } else if (original instanceof Error) {

        const ErrorConstructor = original.constructor as any;
        placeholder = new ErrorConstructor(original.message) as T;
        seen.set(original as any, placeholder);

        const cloned = cloneType(original, seen);

        // Copy all properties from cloned error to placeholder
        Object.assign(placeholder as any, cloned);

        return placeholder;

    } else if (
        original instanceof Int8Array ||
        original instanceof Uint8Array ||
        original instanceof Uint8ClampedArray ||
        original instanceof Int16Array ||
        original instanceof Uint16Array ||
        original instanceof Int32Array ||
        original instanceof Uint32Array ||
        original instanceof Float32Array ||
        original instanceof Float64Array ||
        original instanceof BigInt64Array ||
        original instanceof BigUint64Array
    ) {

        // For TypedArrays, we can't create empty placeholders
        // Just clone directly since they don't support circular references internally
        return cloneType(original, seen);

    } else if (original instanceof ArrayBuffer) {

        // ArrayBuffers can't have circular references internally
        return cloneType(original, seen);

    } else if (original instanceof DataView) {

        // DataViews can't have circular references internally
        return cloneType(original, seen);

    } else {

        // Handle regular objects and other types
        placeholder = {} as T;
        seen.set(original as any, placeholder);

        const cloned = cloneType(original, seen);

        // Copy all properties from cloned object to placeholder
        Object.assign(placeholder as any, cloned);

        return placeholder;
    }
};
