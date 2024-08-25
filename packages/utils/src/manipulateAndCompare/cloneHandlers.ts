import { _nextTick } from '../index.ts';

import type {
    AnyConstructor,
    deepClone as DeepCloneFn,
} from './index.ts';

export interface HandleCloningOf<T extends AnyConstructor> {
    (a: T): T;
}

export const cloneHandlers: Map<AnyConstructor, HandleCloningOf<any>> = new Map();

export const prepareCloneHandlers = (clone: typeof DeepCloneFn) => {

    cloneHandlers.set(Array, (a) => a.map((v: any) => clone(v)));

    cloneHandlers.set(Object, <T>(a: T) => {

        const copy: Partial<T> = {};

        let key: keyof T;

        for (key in a) {

            copy[key] = clone(a[key]);
        }

        return copy;
    });

    cloneHandlers.set(Map, (a: Map<any, any>) => {

        const copy = new Map;

        for (const entry of a.entries()) {

            const [key, val] = entry;
            copy.set(key, clone(val));
        }

        return copy;
    });

    cloneHandlers.set(Set, (a: Set<any>) => {

        const copy = new Set;

        for (const original in [...a.values()]) {

            const cloned = clone(original);
            copy.add(cloned);
        }

        return copy;
    });
}
