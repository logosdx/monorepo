
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
