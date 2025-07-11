import { assert, isFunction } from '../validation.ts';

import { type MergeOptions } from './merge.ts';


export type AnyConstructor = (
    { new(...args: any[]): any }
);


export interface HandleCloningOf<T extends AnyConstructor> {
    (original: T, seen: WeakMap<any, any>): T;
}

export const cloneHandlers: Map<AnyConstructor, HandleCloningOf<any>> = new Map();

export interface HandleEquatingOf {
    (a: unknown, b: unknown, seen?: WeakMap<WeakKey, WeakKey>): boolean;
}

export interface HandleMergeOf<T = unknown, U = unknown> {
    (a: T, b: U, opts?: MergeOptions): T & U;
}

export const mergeHandlers: Map<AnyConstructor, HandleMergeOf> = new Map();

export const equalityHandlers: Map<AnyConstructor, HandleEquatingOf> = new Map();


/**
 * Properties that are dangerous for prototype pollution
 */
const DANGEROUS_PROPS = new Set([
    '__proto__',
    'constructor',
    'prototype'
]);

/**
 * Checks if a property key is dangerous for prototype pollution
 *
 * @param key - The property key to check
 * @returns true if the key is dangerous and should be skipped
 *
 * @example
 * isDangerousKey('__proto__'); // true
 * isDangerousKey('constructor'); // true
 * isDangerousKey('normalProp'); // false
 */
export const isDangerousKey = (key: string | symbol | number): boolean => {

    return typeof key === 'string' && DANGEROUS_PROPS.has(key);
};

/**
 * Filters out dangerous properties from an object's keys to prevent prototype pollution
 *
 * @param obj - The object to get safe keys from
 * @returns Array of safe property keys
 *
 * @example
 * const obj = { a: 1, __proto__: {}, constructor: Function };
 * getSafeKeys(obj); // ['a']
 */
export const getSafeKeys = <T extends object>(obj: T): (keyof T)[] => {

    return Object.keys(obj).filter(key => !isDangerousKey(key)) as (keyof T)[];
};

/**
 * Filters out dangerous properties when iterating over object entries
 *
 * @param obj - The object to get safe entries from
 * @returns Array of safe [key, value] pairs
 *
 * @example
 * const obj = { a: 1, __proto__: {}, b: 2 };
 * getSafeEntries(obj); // [['a', 1], ['b', 2]]
 */
export const getSafeEntries = <T extends object>(obj: T): Array<[keyof T, T[keyof T]]> => {

    return Object.entries(obj).filter(([key]) => !isDangerousKey(key)) as Array<[keyof T, T[keyof T]]>;
};


/**
 * Helper type to detect if a type is a primitive value
 */
type IsPrimitive<T> = T extends string | number | boolean | symbol | null | undefined | bigint
    ? true
    : false;

/**
 * Helper type to detect if a type is an array
 */
type IsArray<T> = T extends Array<any> ? true : false;

/**
 * Helper type to detect if a type is a Map
 */
type IsMap<T> = T extends Map<any, any> ? true : false;

/**
 * Helper type to detect if a type is a Set
 */
type IsSet<T> = T extends Set<any> ? true : false;

/**
 * Helper type to detect if a type is a special collection (Array, Map, Set)
 */
type IsSpecialCollection<T> = IsArray<T> extends true
    ? true
    : IsMap<T> extends true
    ? true
    : IsSet<T> extends true
    ? true
    : false;

/**
 * Helper type to merge two array types
 */
type MergeArrays<Target, Source> =
    Target extends Array<infer TargetItem>
        ? Source extends Array<infer SourceItem>
            ? Array<TargetItem | SourceItem>
            : Source
        : Source;

/**
 * Helper type to merge two Map types
 */
type MergeMaps<Target, Source> =
    Target extends Map<infer TK, infer TV>
        ? Source extends Map<infer SK, infer SV>
            ? Map<TK | SK, TV | SV>
            : Source
        : Source;

/**
 * Helper type to merge two Set types
 */
type MergeSets<Target, Source> =
    Target extends Set<infer TargetItem>
        ? Source extends Set<infer SourceItem>
            ? Set<TargetItem | SourceItem>
            : Source
        : Source;

/**
 * Helper type to merge special collections (Arrays, Maps, Sets)
 */
type MergeSpecialCollections<Target, Source> =
    IsArray<Target> extends true
        ? MergeArrays<Target, Source>
        : IsMap<Target> extends true
        ? MergeMaps<Target, Source>
        : IsSet<Target> extends true
        ? MergeSets<Target, Source>
        : Source;

/**
 * Helper type to merge two property values based on their types
 */
type MergePropertyValues<Target, Source> =
    // If source is primitive, use source
    IsPrimitive<Source> extends true
        ? Source
        // If either is a special collection, handle specially
        : IsSpecialCollection<Target> extends true
        ? MergeSpecialCollections<Target, Source>
        : IsSpecialCollection<Source> extends true
        ? Source
        // If both are objects, recursively merge
        : Target extends object
        ? Source extends object
            ? MergeTypes<Target, Source>
            : Source
        : Source;

/**
 * Smart merge type that properly handles nested object merging with support for Arrays, Maps, and Sets
 *
 * @example
 * type Result = MergeTypes<
 *   { a: number; nested: { x: string } },
 *   { b: string; nested: { y: number } }
 * >;
 * // Result: { a: number; b: string; nested: { x: string; y: number } }
 */
export type MergeTypes<Target, Source> = {
    [K in keyof Target | keyof Source]:
        // If key exists in source
        K extends keyof Source
            ? K extends keyof Target
                // Key exists in both - merge the values
                ? MergePropertyValues<Target[K], Source[K]>
                // Key only exists in source
                : Source[K]
            // Key only exists in target
            : K extends keyof Target
            ? Target[K]
            : never;
};

type AddHandleForClone<T extends AnyConstructor> = (target: InstanceType<T>, seen?: WeakMap<any, any>) => InstanceType<T>;
type AddHandlerForMerge<T extends AnyConstructor> = (target: InstanceType<T>, source: InstanceType<T>, opts?: MergeOptions) => InstanceType<T>;
type AddHandlerForEquals<T extends AnyConstructor> = (target: InstanceType<T>, source: InstanceType<T>) => boolean

interface AddHandlerFor {
    <T extends AnyConstructor>(
        fn: 'clone',
        cnstr: T,
        handler: AddHandleForClone<T>
    ): void
    <T extends AnyConstructor>(
        fn: 'merge',
        cnstr: T,
        handler: AddHandlerForMerge<T>
    ): void
    <T extends AnyConstructor>(
        fn: 'equals',
        cnstr: T,
        handler: AddHandlerForEquals<T>
    ): void
}

/**
 * Add a handler for a specific function
 * @param fn - the function to add the handler for
 * @param cnstr - the constructor to add the handler for
 * @param handler - the handler to add

* @example
 * addHandlerFor('clone', FooClass, (original, seen) => new FooClass(original.bar, original.baz));
 * addHandlerFor('equals', FooClass, (a, b, seen) => equals(a.bar, b.bar, seen) && equals(a.baz, b.baz, seen));
 * addHandlerFor('merge', FooClass, (target, source, opts) => merge(target.bar, source.bar, opts));
 */
export const addHandlerFor: AddHandlerFor = (fn, cnstr, handler) => {

    assert(/(clone|merge|equals)/.test(fn), 'invalid function name');
    assert(isFunction(handler), 'handler is not a function');

    if (fn === 'clone') {
        cloneHandlers.set(
            cnstr,
            handler as never
        );
    }

    if (fn === 'equals') {
        equalityHandlers.set(
            cnstr,
            handler as never
        );
    }

    if (fn === 'merge') {
        mergeHandlers.set(
            cnstr,
            handler as never
        );
    }
}
