import type {
    ConstructorCheckOptions,
    MapType,
} from './internal/types';

import {
    oneIsNonIterable,
    hasSameConstructor,
    isSameLength,
    _nextTick,
    isFunction,
    forInIsEqual,
    forOfIsEqual,
} from '.';

const deepEqualHandlers: MapType = new Map();

deepEqualHandlers.set(Array, (a: any[], b: any[]) => {

    // If length changed, they do not match
    if (!isSameLength(a, b)) return false;

    return forInIsEqual(a, (val, i) => deepEqual(val, b[i]))
});

deepEqualHandlers.set(Object, (a, b) => {

    const aKeys = new Set(Object.keys(a));
    const bKeys = new Set(Object.keys(b));

    if (!isSameLength(aKeys, bKeys)) return false;

    const bHasAKeys = forOfIsEqual(aKeys, val => bKeys.has(val));
    const aHasBKeys = forOfIsEqual(bKeys, val => aKeys.has(val));

    if (!aHasBKeys || !bHasAKeys) return false;

    return forInIsEqual(a, (val, i) => deepEqual(val, b[i]));
});

deepEqualHandlers.set(Map, (a: Map<any, any>, b: Map<any, any>) => {

    // If size changed, they do not match
    if (a.size !== b.size) return false;

    const aKeys = new Set(a.keys());
    const bKeys = new Set(b.keys());

    const bHasAKeys = forOfIsEqual(aKeys, val => bKeys.has(val));
    const aHasBKeys = forOfIsEqual(bKeys, val => aKeys.has(val));

    if (!aHasBKeys || !bHasAKeys) return false;

    return forOfIsEqual(a.entries(), ([key, val]) => deepEqual(val, b.get(key)));
});

deepEqualHandlers.set(Set, (a, b) => {

    // If size changed, they do not match
    if (a.size !== b.size) return false;

    return forOfIsEqual(a, (val) => b.has(val));
});

deepEqualHandlers.set(Date, (a, b) => +a === +b);

deepEqualHandlers.set(RegExp, (a, b) => (

    (a.source === b.source) &&
    (a.flags === b.flags)
));

deepEqualHandlers.set(Function, (a, b) => a === b);

/**
 * For adding your own constructors incase you're doing
 * weird OO things or using libraries
 */
const specialTypes = new Set();

/**
 * Add special constructor checks. You can treat as an existing
 * supported js constructor or make your own deepEqual function.
 * @param opts
 *
 * @example
 *
 * addConstructorCheck({
 *      constructor: Triangle,
 *      treatAs: Object
 * })
 *
 * addConstructorCheck({
 *      constructor: Triangle,
 *      deepEqualFunc: (a, b) => a.hypotenuse !== b.hypotenuse
 * })
 */
export const addConstructorCheck = (opts: ConstructorCheckOptions) => {

    if (deepEqualHandlers.has(opts.constructor)) {
        throw Error(`${opts.constructor} check already exists`);
    }

    if (!opts.constructor) {
        throw Error('Constructor is required.');
    }

    if (!opts.treatAs && !opts.deepEqualFunc) {
        throw Error(
            'Constructor check requires deepEqualFunc function or '
            + 'treatAs another known constructor. '
            + 'Both values cannot be blank.'
        );
    }

    if (opts.treatAs && opts.deepEqualFunc){
        console.warn('`treatAs` will be prioritzied over `deepEqualFunc`');
    }

    specialTypes.add(opts.constructor);

    if (opts.treatAs) {

        const treatAsCheck = deepEqualHandlers.get(opts.treatAs);

        deepEqualHandlers.set(
            opts.constructor,
            treatAsCheck
        );

        return;
    }

    deepEqualHandlers.set(
        opts.constructor,
        opts.deepEqualFunc
    );

}

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
    let typedeepEqualFunc = deepEqualHandlers.get(current.constructor);

    // Handles GeneratorFunction and AsyncFunction
    if (
        !typedeepEqualFunc &&
        isFunction(change) &&
        isFunction(current)
    ) {

        typedeepEqualFunc = deepEqualHandlers.get(Function);
    }

    if (
        specialTypes.size &&
        specialTypes.has(change.constructor)
    ) {

        typedeepEqualFunc = deepEqualHandlers.get(change.constructor);
    }

    if (!typedeepEqualFunc) {

        // Warn about using specific types that are not supported
        // But warn after processing
        _nextTick(() => console.warn(
            `deepEquals does not support ${current.constructor.name} type. `
            + `Strict equality will be used instead.`
        ));

        return change === current;
    }

    return typedeepEqualFunc(change, current);
};
