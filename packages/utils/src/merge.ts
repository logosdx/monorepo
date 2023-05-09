import { MapTypeMerge, TypeMergeFunc } from './internal/types';
import {
    hasSameConstructor,
    isNonIterable,
    isNonObject,
    _nextTick
} from '.';
import { AnyConstructor } from './internal/types';;

const typeMergeFunc: MapTypeMerge = new Map();

type MergeOptions = {
    mergeArrays?: Boolean;
    mergeSets?: Boolean;
};

const internals: { [k: string]: TypeMergeFunc } = {};

internals.mergeArrays = (current: Array<any>, incoming: Array<any>) => {

    for (const value of incoming) {
        current.push(value);
    }

    return current
};


internals.mergeSets = <T>(current: Set<T>, incoming: Set<T>) => {

    for (const value of incoming) {

        if (!current.has(value)) {

            current.add(value);
        }
    }

    return current;
};


internals.overwriteArrays = <T>(current: Array<T>, incoming: Array<T>) => {

    current.length = 0;

    for (const value of incoming) {
        current.push(value);
    }

    return current
};


internals.overwriteSets = <T>(current: Set<T>, incoming: Set<T>) => {

    current.clear();

    for (const value of incoming) {

        current.add(value);
    }

    return current;
};


typeMergeFunc.set(Array, <T>(current: Array<T>, incoming: Array<T>, options?: MergeOptions) => {

    if (options?.mergeArrays) {

        return internals.mergeArrays!(current, incoming);
    }

    return internals.overwriteArrays!(current, incoming);
});

typeMergeFunc.set(Set, <T>(current: Set<T>, incoming: Set<T>, options?: MergeOptions) => {

    if (options?.mergeSets) {

        return internals.mergeSets!(current, incoming);
    }

    return internals.overwriteSets!(current, incoming);
});

typeMergeFunc.set(
    Object,
    <C extends Record<string, unknown>, I extends C>(
        current: C,
        incoming: I,
        options?: MergeOptions
    ) => {

    let key: keyof C;

    for (key in incoming) {

        if (isNonObject(current[key]) || isNonObject(incoming[key])) {

            current[key] = incoming[key];
            continue;
        }

        if (hasSameConstructor(current[key], incoming[key])) {

            current[key] = merge(current[key], incoming[key], options);
            continue;
        }

        current[key] = incoming[key];
    }

    return current as C & I;
});

typeMergeFunc.set(Map, <K, V>(current: Map<K, V>, incoming: Map<K, V>, options?: MergeOptions) => {

    for (const [key, bValue] of incoming.entries()) {

        if (!current.has(key)) {

            current.set(key, bValue);
            continue;
        }

        const aValue = current.get(key);

        if (isNonObject(aValue) || isNonObject(bValue)) {

            current.set(key, bValue);
            continue;
        }


        if (hasSameConstructor(bValue, aValue)) {

            current.set(key, merge(aValue, bValue, options));
            continue;
        }

        current.set(key, bValue);
    }

    return current;
});

interface Merge {

    <C = any, I = any>(current: C, incoming: I, options?: MergeOptions): C & I
    _defaults: MergeOptions;
    setDefaults(options: MergeOptions): void
}

/**
 * Deep merge Objects, Arrays, Maps and Sets
 * @param current
 * @param incoming
 */
export const merge: Merge = (current, incoming, options = {}) => {

    options = {
        ...merge._defaults,
        ...options
    };

    // Primatives do not have issues with hoisting
    if (isNonIterable(incoming) || (incoming instanceof Date)) {
        return incoming;
    }

    if (hasSameConstructor(incoming, current)) {

        const mergeType = typeMergeFunc.get(current!.constructor as AnyConstructor);

        // Warn about using specific types that are not supported
        if (!mergeType) {
            _nextTick(() => console.warn(`Cannot merge ${current!.constructor.name} type.`));
            return current;
        }

        return mergeType(current, incoming, options);
    }

    return incoming;
};

merge._defaults = {

    mergeArrays: true,
    mergeSets: true
};

merge.setDefaults = (options) => Object.assign(merge._defaults, options);


