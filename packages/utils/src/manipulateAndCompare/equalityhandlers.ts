import {
    _nextTick,
    isSameLength,
    forInIsEqual,
    forOfIsEqual,
} from '../index.ts';

import type {
    AnyConstructor,
    deepEqual as DeepEqualFn,
} from './index.ts';

export interface HandleEquatingOf {
    (a: any, b: any): boolean;
}

export const equalityHandlers: Map<AnyConstructor, HandleEquatingOf> = new Map();

export const prepareDeepEqualHandlers = (deepEqual: typeof DeepEqualFn) => {

    equalityHandlers.set(Array, (a: any[], b: any[]) => {

        // If length changed, they do not match
        if (!isSameLength(a, b)) return false;

        return forInIsEqual(a, (val, i) => deepEqual(val, b[i as any]))
    });

    equalityHandlers.set(Object, (a, b) => {

        const aKeys = new Set(Object.keys(a));
        const bKeys = new Set(Object.keys(b));

        if (!isSameLength(aKeys, bKeys)) return false;

        const bHasAKeys = forOfIsEqual(aKeys, val => bKeys.has(val));
        const aHasBKeys = forOfIsEqual(bKeys, val => aKeys.has(val));

        if (!aHasBKeys || !bHasAKeys) return false;

        return forInIsEqual(a, (val, i) => deepEqual(val, b[i]));
    });

    equalityHandlers.set(Map, (a: Map<any, any>, b: Map<any, any>) => {

        // If size changed, they do not match
        if (a.size !== b.size) return false;

        const aKeys = new Set(a.keys());
        const bKeys = new Set(b.keys());

        const bHasAKeys = forOfIsEqual(aKeys, val => bKeys.has(val));
        const aHasBKeys = forOfIsEqual(bKeys, val => aKeys.has(val));

        if (!aHasBKeys || !bHasAKeys) return false;

        return forOfIsEqual(a.entries(), ([key, val]) => deepEqual(val, b.get(key)));
    });

    equalityHandlers.set(Set, (a, b) => {

        // If size changed, they do not match
        if (a.size !== b.size) return false;

        return forOfIsEqual(a, (val) => b.has(val));
    });

    equalityHandlers.set(Date, (a, b) => +a === +b);

    equalityHandlers.set(RegExp, (a, b) => (

        (a.source === b.source) &&
        (a.flags === b.flags)
    ));

    equalityHandlers.set(Function, (a, b) => a === b);

}
