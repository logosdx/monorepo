import {
    _nextTick,
    hasNoConstructor,
    hasSameConstructor,
} from '../index.ts';

import type {
    AnyConstructor,
    deepMerge as DeepMergeFn,
} from './index.ts';

export interface HandleMergeOf<T = unknown, U = unknown> {
    (a: T, b: U, opts?: MergeOptions): T & U;
}

export const mergeHandlers: Map<AnyConstructor, HandleMergeOf> = new Map();

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

export const prepareMergeHandlers = (merge: typeof DeepMergeFn) => {

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

        for (const key in source) {

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
}