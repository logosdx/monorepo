import {
    TypeCloneFunc,
    AnyConstructor
} from './internal/types';

import {
    isNonIterable,
    _nextTick
} from '.';

const typeCloneFunc: Map<AnyConstructor, TypeCloneFunc<any>> = new Map();

typeCloneFunc.set(Array, <T>(a: Array<T>): Array<T> => a.map((v) => clone(v)));

typeCloneFunc.set(Object, <T extends object>(a: T) => {

    const copy: Partial<T> = {};

    let key: keyof T;

    for (key in a) {

        copy[key] = clone(a[key]);
    }

    return copy;
});

typeCloneFunc.set(Map, <K, V>(a: Map<K, V>): Map<K, V> => {

    const copy = new Map;

    for (const entry of a.entries()) {

        const [key, val] = entry;
        copy.set(key, clone(val));
    }

    return copy;
});

typeCloneFunc.set(Set, <T>(a: Set<T>) => {

    const copy = new Set;

    for (const original in [...a.values()]) {

        const cloned = clone(original);
        copy.add(cloned);
    }

    return copy;
});

/**
 * Deep clones Objects, Arrays, Maps and Sets
 * @param original
 * @returns {any} Cloned value
 */
export const clone = <T>(original: T): T => {

    // Primatives do not have issues with hoisting
    if (isNonIterable(original) || (original instanceof Date)) {
        return original;
    }

    const cloneType = typeCloneFunc.get(original.constructor as AnyConstructor);

    // Warn about using specific types that are not supported
    if (!cloneType) {
        _nextTick(() => console.warn(`Cannot clone ${original.constructor.name} type.`));
        return original;
    }

    return cloneType(original);
};
