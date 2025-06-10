import type {
    AnyConstructor,
    deepClone as DeepCloneFn,
} from './index.ts';

export interface HandleCloningOf<T extends AnyConstructor> {
    (original: T, seen: WeakMap<any, any>): T;
}

export const cloneHandlers: Map<AnyConstructor, HandleCloningOf<any>> = new Map();

export const prepareCloneHandlers = (clone: typeof DeepCloneFn) => {

    cloneHandlers.set(Array, (arr: unknown[], seen: WeakMap<any, any>) =>
        arr.map((v) => clone(v, seen))
    );

    cloneHandlers.set(Object, <T>(obj: T, seen: WeakMap<any, any>) => {

        const copy: Partial<T> = {};

        let key: keyof T;

        for (key in obj) {

            if (key === '__proto__') {
                continue;
            }

            copy[key] = clone(obj[key], seen);
        }

        return copy;
    });

    cloneHandlers.set(Map, (_map: Map<unknown, unknown>, seen: WeakMap<any, any>) => {

        const copy = new Map();

        for (const entry of _map.entries()) {

            const [key, val] = entry;
            copy.set(key, clone(val, seen));
        }

        return copy;
    });

    cloneHandlers.set(Set, (_set: Set<unknown>, seen: WeakMap<any, any>) => {

        const copy = new Set();

        for (const original of _set) {

            copy.add(clone(original, seen));
        }

        return copy;
    });

    // Add support for TypedArrays and ArrayBuffer
    const TYPED_ARRAYS = [
        Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
        Int32Array, Uint32Array, Float32Array, Float64Array,
        BigInt64Array, BigUint64Array
    ];

    TYPED_ARRAYS.forEach(TypedArrayConstructor => {

        cloneHandlers.set(TypedArrayConstructor, (arr: any) => {

            return new TypedArrayConstructor(arr);
        });
    });

    cloneHandlers.set(ArrayBuffer, (buffer: ArrayBuffer) => {

        return buffer.slice(0);
    });

    cloneHandlers.set(DataView, (view: DataView) => {

        const clonedBuffer = view.buffer.slice(0);
        return new DataView(clonedBuffer, view.byteOffset, view.byteLength);
    });

    // Add support for Error objects
    const ERROR_TYPES = [
        Error, TypeError, ReferenceError, SyntaxError,
        RangeError, EvalError, URIError
    ];

    ERROR_TYPES.forEach(ErrorConstructor => {

        cloneHandlers.set(ErrorConstructor, (error: Error, seen: WeakMap<any, any>) => {

            const cloned = new (error.constructor as ErrorConstructor)(error.message);

            if (error.name) {
                cloned.name = error.name;
            }

            if (error.stack) {
                cloned.stack = error.stack;
            }

            // Copy any additional enumerable properties
            for (const key in error) {

                if (key !== 'name' && key !== 'message' && key !== 'stack') {

                    (cloned as any)[key] = clone((error as any)[key], seen);
                }
            }

            return cloned;
        });
    });
}
