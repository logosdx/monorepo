import {
    assert,
    hasSameConstructor,
    isFunction,
    isNonIterable,
    oneIsNonIterable
} from '../index.ts';

import {
    cloneHandlers,
    prepareCloneHandlers,
} from './cloneHandlers.ts';

import {
    equalityHandlers,
    prepareDeepEqualHandlers,
} from './equalityhandlers.ts';

import {
    mergeHandlers,
    prepareMergeHandlers,
    addBinaryDataMergeHandlers,
    MergeOptions
} from './mergeHandlers.ts';

export * from './cloneHandlers.ts';
export * from './equalityhandlers.ts';
export * from './mergeHandlers.ts';

export type AnyConstructor = (
    { new(...args: any[]): any }
);

// ============================================================================
// TYPE INFERENCE HELPERS
// ============================================================================

/**
 * Deep readonly utility type
 */
export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends Function
        ? T[P]
        : T[P] extends object
            ? DeepReadonly<T[P]>
            : T[P];
};

/**
 * Deep partial utility type
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends Function
        ? T[P]
        : T[P] extends object
            ? DeepPartial<T[P]>
            : T[P];
};

/**
 * Deep required utility type
 */
export type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Infer exact cloned type structure
 */
export type InferCloneType<T> =
    T extends Array<infer U> ? Array<InferCloneType<U>>
    : T extends ReadonlyArray<infer U> ? Array<InferCloneType<U>>
    : T extends Map<infer K, infer V> ? Map<K, InferCloneType<V>>
    : T extends Set<infer U> ? Set<InferCloneType<U>>
    : T extends Date ? Date
    : T extends RegExp ? RegExp
    : T extends Function ? T
    : T extends Int8Array ? Int8Array
    : T extends Uint8Array ? Uint8Array
    : T extends Uint8ClampedArray ? Uint8ClampedArray
    : T extends Int16Array ? Int16Array
    : T extends Uint16Array ? Uint16Array
    : T extends Int32Array ? Int32Array
    : T extends Uint32Array ? Uint32Array
    : T extends Float32Array ? Float32Array
    : T extends Float64Array ? Float64Array
    : T extends BigInt64Array ? BigInt64Array
    : T extends BigUint64Array ? BigUint64Array
    : T extends ArrayBuffer ? ArrayBuffer
    : T extends DataView ? DataView
    : T extends Error ? T
    : T extends object ? { [K in keyof T]: InferCloneType<T[K]> }
    : T;

/**
 * Smart merge type that properly handles nested object merging
 */
export type DeepMergeTypes<Target, Source> = {
    [K in keyof Target | keyof Source]:
        K extends keyof Source
            ? K extends keyof Target
                ? Target[K] extends object
                    ? Source[K] extends object
                        ? Target[K] extends Array<any>
                            ? Source[K] extends Array<any>
                                ? Array<Target[K][0] | Source[K][0]>
                                : Source[K]
                            : Source[K] extends Array<any>
                            ? Source[K]
                            : DeepMergeTypes<Target[K], Source[K]>
                        : Source[K]
                    : Source[K]
                : Source[K]
            : K extends keyof Target
            ? Target[K]
            : never;
};

/**
 * Check if type is cloneable
 */
export type IsCloneable<T> =
    T extends null | undefined | string | number | boolean | symbol | bigint ? false
    : T extends Function ? false
    : T extends object ? true
    : false;

/**
 * Extract cloneable properties from an object type
 */
export type CloneableProperties<T> = {
    [K in keyof T]: IsCloneable<T[K]> extends true ? T[K] : never;
};

/**
 * Type guard to check if value is cloneable
 */
export function isCloneable<T>(value: T): value is T extends object ? T : never {
    return typeof value === 'object' && value !== null && typeof value !== 'function';
}

/**
 * Assert that a value is cloneable
 */
export function assertCloneable<T>(value: T): asserts value is T & object {
    if (!isCloneable(value)) {
        throw new Error(`Value of type ${typeof value} is not cloneable`);
    }
}

/**
 * Type guard for deep equality
 */
export function isDeepEqual<T>(a: T, b: unknown): b is T {
    return deepEqual(a, b);
}

/**
 * Type-safe property access for deeply nested objects
 */
export type DeepPropertyPath<T, K extends keyof T = keyof T> =
    K extends string | number
        ? T[K] extends object
            ? `${K}` | `${K}.${DeepPropertyPath<T[K]>}`
            : `${K}`
        : never;

/**
 * Get the type of a deeply nested property
 */
export type DeepPropertyType<T, Path extends string> =
    Path extends `${infer K}.${infer Rest}`
        ? K extends keyof T
            ? DeepPropertyType<T[K], Rest>
            : never
        : Path extends keyof T
        ? T[Path]
        : never;

/**
 * Deep clones Objects, Arrays, Maps and Sets with circular reference protection
 * @param original - The value to clone
 * @param seen - WeakMap to track circular references (internal use)
 * @returns {any} Cloned value
 * @example
 * const obj = { a: 1, b: { c: 2 } };
 * obj.circular = obj; // Create circular reference
 * const cloned = deepClone(obj); // Works without stack overflow
 */
export const deepClone = <T>(original: T, seen = new WeakMap()): T => {

    // Primatives do not have issues with hoisting
    if (
        isNonIterable(original) ||
        original instanceof Date ||
        original instanceof RegExp ||
        typeof original === 'function'
    ) {
        return original;
    }

    // Check for circular references
    if (seen.has(original as any)) {

        return seen.get(original as any);
    }

    const cloneType = cloneHandlers.get(original!.constructor as AnyConstructor);

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

/**
 * Recursively checks if there are changes in the current structure.
 * Returns immediately after detecting a single change.
 * @param change changed item
 * @param current current item
 * @param seen WeakMap to track circular references with comparison paths (internal use)
 */
export const deepEqual = (change: unknown, current: unknown, seen = new WeakMap<WeakKey, WeakKey>()): boolean => {

    // Non-iterables can be checked with basic js strict equality
    if (oneIsNonIterable(change, current)) return change === current;

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
    // Each contructor may have a special way of deepEqualing
    let typedeepEqualFunc = equalityHandlers.get(cur.constructor);

    // Handles GeneratorFunction and AsyncFunction
    if (
        !typedeepEqualFunc &&
        isFunction(change) &&
        isFunction(current)
    ) {

        typedeepEqualFunc = equalityHandlers.get(Function);
    }

    if (!typedeepEqualFunc) {

        return change === current;
    }

    const result = typedeepEqualFunc(change, current, seen);

    return result;
};

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
export const deepMerge = <
    Target = any,
    Source = any
>(
    target: Target,
    source: Source,
    options: MergeOptions = {}
): DeepMergeTypes<Target, Source> => {

    options = {
        ...mergeDefaults,
        ...options
    };

    // Primatives do not have issues with hoisting
    if (isNonIterable(source) || (source instanceof Date)) {
        return source as DeepMergeTypes<Target, Source>;
    }

    if (hasSameConstructor(source, target)) {

        const mergeType = mergeHandlers.get(target!.constructor as AnyConstructor);

        // Warn about using specific types that are not supported
        if (!mergeType) {
            return target as DeepMergeTypes<Target, Source>;
        }

        return mergeType(target, source, options) as DeepMergeTypes<Target, Source>;
    }

    return source as DeepMergeTypes<Target, Source>;
};

prepareCloneHandlers(deepClone);
prepareDeepEqualHandlers(deepEqual);
prepareMergeHandlers(deepMerge);
addBinaryDataMergeHandlers();


type AddHandleForClone<T extends AnyConstructor> = (target: InstanceType<T>) => InstanceType<T>;
type AddHandlerForMerge<T extends AnyConstructor> = (target: InstanceType<T>, source: InstanceType<T>, opts?: MergeOptions) => InstanceType<T>;
type AddHandlerForEquals<T extends AnyConstructor> = (target: InstanceType<T>, source: InstanceType<T>) => boolean

interface AddHandlerFor {
    <T extends AnyConstructor>(
        fn: 'deepClone',
        cnstr: T,
        handler: AddHandleForClone<T>
    ): void
    <T extends AnyConstructor>(
        fn: 'deepMerge',
        cnstr: T,
        handler: AddHandlerForMerge<T>
    ): void
    <T extends AnyConstructor>(
        fn: 'deepEqual',
        cnstr: T,
        handler: AddHandlerForEquals<T>
    ): void
}

export const addHandlerFor: AddHandlerFor = (fn, cnstr, handler) => {

    assert(/deep(Clone|Merge|Equal)/.test(fn), 'invalid function name');
    assert(isFunction(handler), 'handler is not a function');

    if (fn === 'deepClone') {
        cloneHandlers.set(
            cnstr,
            handler as never
        );
    }

    if (fn === 'deepEqual') {
        equalityHandlers.set(
            cnstr,
            handler as never
        );
    }

    if (fn === 'deepMerge') {
        mergeHandlers.set(
            cnstr,
            handler as never
        );
    }
}
