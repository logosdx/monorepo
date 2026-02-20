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

/**
 * Convert kebab-case to camelCase.
 * CSS properties in markup use kebab-case but CSSStyleDeclaration
 * expects camelCase for direct property access.
 *
 * @example
 *     kebabToCamel('background-color'); // 'backgroundColor'
 *     kebabToCamel('font-size');        // 'fontSize'
 */
export function kebabToCamel(str: string): string {

    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Guard that throws when called outside a browser-like environment.
 * Prevents cryptic errors when DOM APIs are unavailable.
 *
 * @example
 *     assertBrowser('$.css'); // throws in Node without jsdom
 */
export function assertBrowser(name: string): void {

    if (typeof document === 'undefined') {

        throw new Error(`${name} requires a browser environment`);
    }
}
