import {
    isSameLength,
    forInEvery,
    forOfEvery,
    hasNoConstructor,
} from '../index.ts';

import type {
    AnyConstructor,
    deepEqual as DeepEqualFn,
} from './index.ts';

export interface HandleEquatingOf {
    (a: unknown, b: unknown): boolean;
}

export const equalityHandlers: Map<AnyConstructor, HandleEquatingOf> = new Map();

export const prepareDeepEqualHandlers = (deepEqual: typeof DeepEqualFn) => {

    equalityHandlers.set(Array, (_a, _b) => {

        const a = _a as unknown[];
        const b = _b as unknown[];

        // If length changed, they do not match
        if (!isSameLength(a, b)) return false;

        return forInEvery(a, (val, i) => deepEqual(val, b[i as any]))
    });

    equalityHandlers.set(Object, (_a, _b) => {

        const a = _a as Record<string, unknown>;
        const b = _b as Record<string, unknown>;

        if (a === b) return true;
        if (hasNoConstructor(a) || hasNoConstructor(b)) return false;

        const aKeys = new Set(Object.keys(a));
        const bKeys = new Set(Object.keys(b));

        if (!isSameLength(aKeys, bKeys)) return false;

        const bHasAKeys = forOfEvery(aKeys, val => bKeys.has(val as string));
        const aHasBKeys = forOfEvery(bKeys, val => aKeys.has(val as string));

        if (!aHasBKeys || !bHasAKeys) return false;

        return forInEvery(a, (val, i) => deepEqual(val, b[i]));
    });

    equalityHandlers.set(Map, (_a, _b) => {

        const a = _a as Map<unknown, unknown>;
        const b = _b as Map<unknown, unknown>;

        // If size changed, they do not match
        if (a.size !== b.size) return false;

        const aKeys = new Set(a.keys());
        const bKeys = new Set(b.keys());

        const bHasAKeys = forOfEvery(aKeys, val => bKeys.has(val));
        const aHasBKeys = forOfEvery(bKeys, val => aKeys.has(val));

        if (!aHasBKeys || !bHasAKeys) return false;

        return forOfEvery(
            a.keys(),
            (key) => deepEqual(
                a.get(key),
                b.get(key)
            )
        );
    });

    equalityHandlers.set(Set, (_a, _b) => {

        const a = _a as Set<unknown>;
        const b = _b as Set<unknown>;

        // If size changed, they do not match
        if (a.size !== b.size) return false;

        return forOfEvery(a, (val) => b.has(val));
    });

    equalityHandlers.set(Date, (a, b) => (

        +(a as Date) === +(b as Date)
    ));

    equalityHandlers.set(RegExp, (_a, _b) => {

        const a = _a as RegExp;
        const b = _b as RegExp;

        return (
            (a.source === b.source) &&
            (a.flags === b.flags)
        );
    });

    equalityHandlers.set(Function, (_a, _b) => {

        const a = _a as Function;
        const b = _b as Function;

        if (a === b) return true;

        return a.toString() === b.toString();

    });

}
