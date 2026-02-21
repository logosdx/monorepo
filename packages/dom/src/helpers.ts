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
 * Apply a callback to each combination of elements and keys.
 * Eliminates the repeated `toArray(els) → for el → for key → action` pattern.
 *
 * @example
 *     eachEl(els, keys, (el, key) => el.removeAttribute(key));
 */
export function eachEl<E, K>(
    els: E | E[],
    keys: K | K[],
    fn: (el: E, key: K) => void
): void {

    const elements = toArray(els);
    const items = toArray(keys);

    for (const el of elements) {

        for (const key of items) {

            fn(el, key);
        }
    }
}

/**
 * Apply a callback to each element in a OneOrMany.
 * Single-key variant of eachEl for set-all / hide / show patterns.
 *
 * @example
 *     applyEach(els, el => el.setAttribute('aria-hidden', 'true'));
 */
export function applyEach<E>(
    els: E | E[],
    fn: (el: E) => void
): void {

    for (const el of toArray(els)) {

        fn(el);
    }
}

/**
 * Get multiple values from a single element, returning a Record.
 * Eliminates repeated "for key → result[key] = getter(key)" pattern.
 *
 * @example
 *     getMany(el, ['role', 'id'], name => el.getAttribute(name));
 */
export function getMany<V>(
    keys: string[],
    getter: (key: string) => V
): Record<string, V> {

    const result: Record<string, V> = {};

    for (const key of keys) {

        result[key] = getter(key);
    }

    return result;
}

/**
 * Wire an AbortSignal to a stop/cleanup function.
 * Eliminates the repeated `signal.addEventListener('abort', stop, { once: true })` pattern.
 *
 * @example
 *     bindSignal(opts?.signal, stop);
 */
export function bindSignal(
    signal: AbortSignal | undefined,
    stop: () => void
): void {

    if (signal) {

        signal.addEventListener('abort', stop, { once: true });
    }
}
