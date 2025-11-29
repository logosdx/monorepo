
/**
 * A no-operation function that accepts any arguments and returns any value.
 *
 * @param args any arguments
 * @returns any value
 */
export const noop: (...args: any[]) => any = () => {};

/**
 * Generates a random ID.
 *
 * Creates a random ID string using Math.random().
 *
 * @returns random ID string
 */
export const generateId = () => '_' + Math.random().toString(36).slice(2, 9);

/**
 * Repeats something N times and returns an array of the results.
 *
 * @param fn function to repeat
 * @param n number of times to repeat
 * @returns array of results
 *
 * @example
 * nTimes(() => createEl('span'), 3) // [span, span, span]
 * nTimes(() => Math.random(), 5) // [0.123, 0.456, 0.789, 0.123, 0.456]
 * nTimes((i) => (i + 1) * 2, 3) // [2, 4, 6]
 */
export const nTimes = <T>(fn: (iteration: number) => T, n: number) => {

    if (typeof n !== 'number') throw new Error('n must be a number');
    if (typeof fn !== 'function') throw new Error('fn must be a function');

    return Array.from({ length: n }, (_, i) => fn(i));
};

const unserializableIds = new WeakMap<WeakKey, string>();

const getUnserializableId = (value: WeakKey): string => {

    if (!unserializableIds.has(value)) {

        unserializableIds.set(value, generateId());
    }

    return unserializableIds.get(value)!;
}


/**
 * Enhanced key generation that handles object property ordering,
 * circular references, and non-serializable values with unique IDs.
 *
 * This function provides more reliable key generation than JSON.stringify
 * by handling edge cases like circular references, consistent object key ordering,
 * and various JavaScript types.
 *
 * **Non-serializable types get unique instance IDs:**
 * - Functions → `fn:_abc123` (unique per function instance)
 * - Symbols → `sym:_abc123` (unique per symbol instance)
 * - Errors → `e:_abc123` (unique per error instance)
 * - WeakMap → `wm:_abc123` (unique per instance)
 * - WeakSet → `ws:_abc123` (unique per instance)
 * - Circular refs → `circ:_abc123` (unique per object)
 *
 * @param args - The arguments to generate a key from
 * @returns A string key suitable for caching
 *
 * @example
 * ```typescript
 * const key = serializer([{a: 1, b: 2}, "test", 123]);
 * // Returns: '{"a":1,"b":2}|test|123'
 *
 * const key2 = serializer([new Date(1000), /test/i]);
 * // Returns: 'd:1000|r:/test/i'
 *
 * // Functions get unique IDs
 * const fn1 = () => {};
 * const fn2 = () => {};
 * serializer([fn1]) !== serializer([fn2]); // true
 * serializer([fn1]) === serializer([fn1]); // true
 * ```
 */
export const serializer = (args: unknown[]): string => {

    const seen = new WeakSet();

    const stringify = (value: any): string => {

        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return `${value}`;
        if (typeof value === 'number') {

            if (Object.is(value, -0)) return '-0';
            return String(value);
        }
        if (typeof value === 'boolean') return String(value);
        if (typeof value === 'bigint') return `bi:${value}`;
        if (typeof value === 'symbol') return `sym:${getUnserializableId(value)}`;
        if (typeof value === 'function') return `fn:${getUnserializableId(value)}`;

        if (value instanceof Date) return `d:${value.getTime()}`;
        if (value instanceof RegExp) return `r:${value.toString()}`;
        if (value instanceof Error) return `e:${getUnserializableId(value)}`;
        if (value instanceof WeakMap) return `wm:${getUnserializableId(value)}`;
        if (value instanceof WeakSet) return `ws:${getUnserializableId(value)}`;

        if (typeof value === 'object') {

            if (seen.has(value)) return `circ:${getUnserializableId(value)}`;
            seen.add(value);

            if (value instanceof Map) {

                const pairs = Array.from(value.entries())
                    .map(([k, v]) => `${stringify(k)}:${stringify(v)}`)
                    .sort();
                const result = `map:${pairs.join(',')}`;
                seen.delete(value);
                return result;
            }

            if (value instanceof Set) {

                const values = Array.from(value).map(stringify).sort();
                const result = `set:${values.join(',')}`;
                seen.delete(value);
                return result;
            }

            if (Array.isArray(value)) {

                const result = `[${value.map(stringify).join(',')}]`;
                seen.delete(value);
                return result;
            }

            // Plain objects
            const keys = Object.keys(value).sort();
            const pairs = keys.map(key => `"${key}":${stringify(value[key])}`);
            const result = `{${pairs.join(',')}}`;
            seen.delete(value);
            return result;
        }

        // Fallback for any unknown types (defensive - shouldn't be reached for standard JS)
        return `u:${String(value)}`;
    };

    const key = args.map(stringify).join('|');

    return key || '0'; // Use '0' for functions with no arguments
}
