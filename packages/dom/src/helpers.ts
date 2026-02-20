/**
 * Normalize a single value or array into an array.
 * Avoids repeated Array.isArray checks throughout the codebase.
 *
 * @example
 *     toArray('a');       // ['a']
 *     toArray(['a','b']); // ['a','b']
 */
export function toArray<T>(value: T | T[]): T[] {

    return Array.isArray(value) ? value : [value];
}

/**
 * Check if a CSS property is a custom property (--*).
 * Custom properties use `setProperty`/`getPropertyValue` instead of
 * direct style access, so we need to distinguish them.
 *
 * @example
 *     isCustomProp('--color');  // true
 *     isCustomProp('color');    // false
 */
export function isCustomProp(name: string): name is `--${string}` {

    return name.startsWith('--');
}

