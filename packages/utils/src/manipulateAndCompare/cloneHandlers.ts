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

    cloneHandlers.set(Array, (arr: unknown[]) => arr.map((v) => clone(v)));

    cloneHandlers.set(Object, <T>(obj: T) => {

        const copy: Partial<T> = {};

        let key: keyof T;

        for (key in obj) {

            if (key === '__proto__') {
                continue;
            }

            copy[key] = clone(obj[key]);
        }

        return copy;
    });

    cloneHandlers.set(Map, (_map: Map<unknown, unknown>) => {

        const copy = new Map();

        for (const entry of _map.entries()) {

            const [key, val] = entry;
            copy.set(key, clone(val));
        }

        return copy;
    });

    cloneHandlers.set(Set, (_set: Set<unknown>) => {

        const copy = new Set();

        for (const original of _set) {

            copy.add(clone(original));
        }

        return copy;
    });
}
