import {
    _nextTick,
    assert,
    hasSameConstructor,
    isFunction,
    isNonIterable,
    oneIsNonIterable
} from '..';

import {
    cloneHandlers,
    prepareCloneHandlers,
    HandleCloningOf
} from './cloneHandlers';

import {
    equalityHandlers,
    prepareDeepEqualHandlers,
    HandleEquatingOf
} from './equalityhandlers';

import {
    mergeHandlers,
    prepareMergeHandlers,
    HandleMergeOf,
    MergeOptions
} from './mergeHandlers';

export * from './cloneHandlers';
export * from './equalityhandlers';
export * from './mergeHandlers';

export type AnyConstructor = (
    { new(...args: any[]): any }
);

/**
 * Deep clones Objects, Arrays, Maps and Sets
 * @param original
 * @returns {any} Cloned value
 */
export const deepClone = <T>(original: T): T => {

    // Primatives do not have issues with hoisting
    if (isNonIterable(original) || (original instanceof Date)) {
        return original;
    }

    const cloneType = cloneHandlers.get(original!.constructor as AnyConstructor);

    // Warn about using specific types that are not supported
    if (!cloneType) {
        _nextTick(() => console.warn(`Cannot clone ${original!.constructor.name} type.`));
        return original;
    }

    return cloneType(original);
};


/**
 * Recursively checks if there are changes in the current structure.
 * Returns immediately after detecting a single change.
 * @param change changed item
 * @param current current item
 */
export const deepEqual = (change: any, current: any): boolean => {

    // Non-iterables can be checked with basic js strict equality
    if (oneIsNonIterable(change, current)) return change === current;

    // A change in contructor means it changed
    if (!hasSameConstructor(change, current)) return false;

    // Check if these items are different from one another
    // Each contructor may have a special way of deepEqualing
    let typedeepEqualFunc = equalityHandlers.get(current.constructor);

    // Handles GeneratorFunction and AsyncFunction
    if (
        !typedeepEqualFunc &&
        isFunction(change) &&
        isFunction(current)
    ) {

        typedeepEqualFunc = equalityHandlers.get(Function);
    }

    if (!typedeepEqualFunc) {

        // Warn later
        _nextTick(() => console.warn(
            `deepEquals does not support ${current.constructor.name} type. `
            + `Strict equality will be used instead.`
        ));

        return change === current;
    }

    return typedeepEqualFunc(change, current);
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
>(target: Target, source: Source, options: MergeOptions = {}) => {

    options = {
        ...mergeDefaults,
        ...options
    };

    // Primatives do not have issues with hoisting
    if (isNonIterable(source) || (source instanceof Date)) {
        return source;
    }

    if (hasSameConstructor(source, target)) {

        const mergeType = mergeHandlers.get(target!.constructor as AnyConstructor);

        // Warn about using specific types that are not supported
        if (!mergeType) {
            _nextTick(() => console.warn(`Cannot merge ${target!.constructor.name} type.`));
            return target;
        }

        return mergeType(target, source, options);
    }

    return source;
};

prepareCloneHandlers(deepClone);
prepareDeepEqualHandlers(deepEqual);
prepareMergeHandlers(deepMerge);


type AddHandleForClone<T extends AnyConstructor> = (target: InstanceType<T>) => InstanceType<T>;
type AddHandlerForMerge<T extends AnyConstructor> = (target: InstanceType<T>, source: InstanceType<T>, opts?: MergeOptions) => InstanceType<T>;
type AddHandlerForEquals<T extends AnyConstructor> = (target: InstanceType<T>, source: InstanceType<T>) => boolean

export const addHandlerFor = <
    T extends AnyConstructor,
    F extends ('deepClone' | 'deepEqual' | 'deepMerge')
>(
    fn: F,
    cnstr: T,
    handler: (
        F extends 'deepClone'
        ? AddHandleForClone<T>
        : F extends 'deepMerge'
        ? AddHandlerForMerge<T>
        : AddHandlerForEquals<T>
    )
) => {

    assert(/deep(Clone|Merge|Equal)/.test(fn), 'invalid function name');
    assert(isFunction(handler), 'handler is not a function');

    if (fn === 'deepClone') {
        cloneHandlers.set(
            cnstr,
            handler as AddHandleForClone<T>
        );
    }

    if (fn === 'deepEqual') {
        equalityHandlers.set(
            cnstr,
            handler as AddHandlerForMerge<T>
        );
    }

    if (fn === 'deepMerge') {
        mergeHandlers.set(
            cnstr,
            handler as AddHandlerForEquals<T>
        );
    }
}
