import {
    isPrimitive,
    hasNoConstructor,
    hasSameConstructor,
} from '../index.ts';

import {
    AnyConstructor,
    MergeTypes,
    isDangerousKey,
    getSafeKeys,
    mergeHandlers,
} from './helpers.ts';


export type MergeOptions = {
    mergeArrays?: boolean;
    mergeSets?: boolean;
};


const mergeArrays = <A extends unknown[], B extends unknown[]>(target: A, source: B) => {

    for (const value of source) {
        target.push(value);
    }

    return target as A & B;
};


const mergeSets = <T>(target: Set<T>, source: Set<T>) => {

    for (const value of source) {

        if (!target.has(value)) {

            target.add(value);
        }
    }

    return target;
};


const overwriteArrays = <T>(target: Array<T>, source: Array<T>) => {

    target.length = 0;

    for (const value of source) {
        target.push(value);
    }

    return target
};


const overwriteSets = <T>(target: Set<T>, source: Set<T>) => {

    target.clear();

    for (const value of source) {

        target.add(value);
    }

    return target;
};

export const prepareMergeHandlers = () => {

    mergeHandlers.set(Array, (target, source, options?: MergeOptions) => {

        if (options?.mergeArrays) {

            return mergeArrays!(target as [], source as []);
        }

        return overwriteArrays!(target as [], source as []);
    });

    mergeHandlers.set(Set, (target, source, options?: MergeOptions) => {

        if (options?.mergeSets) {

            return mergeSets!(target as Set<{}>, source as Set<{}>);
        }

        return overwriteSets!(target as Set<{}>, source as Set<{}>);
    });

    mergeHandlers.set(Object, (_target, _source, options?: MergeOptions) => {

        const target = _target as Record<string, unknown>;
        const source = _source as Record<string, unknown>;
        const sourceKeys = Object.keys(source);

        for (const key of sourceKeys) {

            // Skip dangerous prototype pollution keys
            if (isDangerousKey(key)) {
                continue;
            }

            if (
                target[key] === undefined ||
                hasNoConstructor(target[key]) ||
                hasNoConstructor(source[key])
            ) {

                target[key] = source[key];
                continue;
            }

            if (hasSameConstructor(target[key], source[key])) {

                target[key] = merge(target[key], source[key], options);
                continue;
            }

            target[key] = source[key];
        }

        return target;
    });

    mergeHandlers.set(Map, (_target, _source, options?: MergeOptions) => {

        const target = _target as Map<unknown, unknown>;
        const source = _source as Map<unknown, unknown>;

        for (const [key, bValue] of source.entries()) {

            if (!target.has(key)) {

                target.set(key, bValue);
                continue;
            }

            const aValue = target.get(key);

            if (hasNoConstructor(aValue) || hasNoConstructor(bValue)) {

                target.set(key, bValue);
                continue;
            }


            if (hasSameConstructor(bValue, aValue)) {

                target.set(key, merge(aValue, bValue, options));
                continue;
            }

            target.set(key, bValue);
        }

        return target;
    });

    mergeHandlers.set(Error, (_target, _source, options?: MergeOptions) => {

        const target = _target as Error;
        const source = _source as Error;

        // Get safe keys (excluding dangerous prototype pollution keys)
        const sourceKeys = getSafeKeys(source);

        for (const key of sourceKeys) {

            if (target[key] === undefined) {

                target[key] = source[key] as any;
                continue;
            }

            if (
                hasSameConstructor(target[key], source[key])
            ) {

                target[key] = merge(target[key], source[key], options) as any;
                continue;
            }

            target[key] = source[key] as any;
        }

        return target;
    });

    const TYPED_ARRAYS = [
        Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
        Int32Array, Uint32Array, Float32Array, Float64Array,
        BigInt64Array, BigUint64Array
    ];

    TYPED_ARRAYS.forEach(TypedArrayConstructor => {

        mergeHandlers.set(TypedArrayConstructor, (_target, source) => {

            // For binary data, merge typically means replace
            return new TypedArrayConstructor(source as any);
        });
    });

    mergeHandlers.set(ArrayBuffer, (_target, source) => {

        // Replace with source buffer
        return (source as ArrayBuffer).slice(0);
    });

    mergeHandlers.set(DataView, (_target, source) => {

        const sourceView = source as DataView;
        const clonedBuffer = sourceView.buffer.slice(0);
        return new DataView(clonedBuffer, sourceView.byteOffset, sourceView.byteLength);
    });

    // Add support for Error objects
    const ERROR_TYPES = [
        Error, TypeError, ReferenceError, SyntaxError,
        RangeError, EvalError, URIError
    ];

    ERROR_TYPES.forEach(ErrorConstructor => {

        mergeHandlers.set(ErrorConstructor, (_target, source) => {

            // For Error objects, merge typically means replace with source
            const sourceError = source as Error;
            const cloned = new (sourceError.constructor as ErrorConstructor)(sourceError.message);

            if (sourceError.name) {
                cloned.name = sourceError.name;
            }

            if (sourceError.stack) {
                cloned.stack = sourceError.stack;
            }

            // Copy any additional enumerable properties (protected against prototype pollution)
            const keys = Object.keys(sourceError);
            for (const key of keys) {

                if (
                    key !== 'name' &&
                    key !== 'message' &&
                    key !== 'stack' &&
                    !isDangerousKey(key)
                ) {

                    (cloned as any)[key] = (sourceError as any)[key];
                }
            }

            return cloned;
        });
    });
};


let mergeHandlersInitialized = false;

/**
 * overridable defaults for the merge function
 */
export const mergeDefaults: MergeOptions = {

    mergeArrays: true,
    mergeSets: true
};


/**
 * Deep merge Objects, Arrays, Maps and Sets
 * @param target
 * @param source
 */
export const merge = <
    Target = any,
    Source = any
>(
    target: Target,
    source: Source,
    options: MergeOptions = {}
): MergeTypes<Target, Source> => {

    if (!mergeHandlersInitialized) {
        prepareMergeHandlers();
        mergeHandlersInitialized = true;
    }

    options = {
        ...mergeDefaults,
        ...options
    };

    // Primatives do not have issues with hoisting
    if (isPrimitive(source) || (source instanceof Date)) {
        return source as MergeTypes<Target, Source>;
    }

    if (hasSameConstructor(source, target)) {

        // Get the actual constructor from the prototype chain to avoid prototype pollution
        const actualConstructor = Object.getPrototypeOf(target)?.constructor || target!.constructor;
        const mergeType = mergeHandlers.get(actualConstructor as AnyConstructor);

        // Warn about using specific types that are not supported
        if (!mergeType) {
            return target as MergeTypes<Target, Source>;
        }

        return mergeType(target, source, options) as MergeTypes<Target, Source>;
    }

    return source as MergeTypes<Target, Source>;
};
