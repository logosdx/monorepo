import {
    _nextTick,
    hasNoConstructor,
    hasSameConstructor,
} from '../index.ts';

import type {
    AnyConstructor,
    deepMerge as DeepMergeFn,
} from './index.ts';

export interface HandleMergeOf {
    (a: any, b: any, opts?: MergeOptions): any;
}

export const mergeHandlers: Map<AnyConstructor, HandleMergeOf> = new Map();

export type MergeOptions = {
    mergeArrays?: boolean;
    mergeSets?: boolean;
};

const mergeHelpers: { [k: string]: HandleMergeOf } = {};

mergeHelpers.mergeArrays = (target: Array<any>, source: Array<any>) => {

    for (const value of source) {
        target.push(value);
    }

    return target
};


mergeHelpers.mergeSets = <T>(target: Set<T>, source: Set<T>) => {

    for (const value of source) {

        if (!target.has(value)) {

            target.add(value);
        }
    }

    return target;
};


mergeHelpers.overwriteArrays = <T>(target: Array<T>, source: Array<T>) => {

    target.length = 0;

    for (const value of source) {
        target.push(value);
    }

    return target
};


mergeHelpers.overwriteSets = <T>(target: Set<T>, source: Set<T>) => {

    target.clear();

    for (const value of source) {

        target.add(value);
    }

    return target;
};

export const prepareMergeHandlers = (merge: typeof DeepMergeFn) => {

    mergeHandlers.set(Array, <T>(target: Array<T>, source: Array<T>, options?: MergeOptions) => {

        if (options?.mergeArrays) {

            return mergeHelpers.mergeArrays!(target, source);
        }

        return mergeHelpers.overwriteArrays!(target, source);
    });

    mergeHandlers.set(Set, <T>(target: Set<T>, source: Set<T>, options?: MergeOptions) => {

        if (options?.mergeSets) {

            return mergeHelpers.mergeSets!(target, source);
        }

        return mergeHelpers.overwriteSets!(target, source);
    });

    mergeHandlers.set(
        Object,
        <C extends Record<string, unknown>, I extends C>(
            target: C,
            source: I,
            options?: MergeOptions
        ) => {

        let key: keyof C;

        for (key in source) {

            if (hasNoConstructor(target[key]) || hasNoConstructor(source[key])) {

                target[key] = source[key];
                continue;
            }

            if (hasSameConstructor(target[key], source[key])) {

                target[key] = merge(target[key], source[key], options);
                continue;
            }

            target[key] = source[key];
        }

        return target as C & I;
    });

    mergeHandlers.set(Map, <K, V>(target: Map<K, V>, source: Map<K, V>, options?: MergeOptions) => {

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
}