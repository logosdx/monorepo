import { toArray } from './helpers.ts';
import type { OneOrMany } from './types.ts';

/**
 * Set or get HTML attributes on one or more elements.
 *
 * Provides a unified interface for attribute manipulation,
 * mirroring the `css()` pattern with `.remove()` and `.has()` methods.
 *
 * @example
 *     attr(el, { 'data-id': '123', role: 'button' });
 *     attr(el, 'role');                // → 'button'
 *     attr(el, ['role', 'data-id']);    // → { role: 'button', 'data-id': '123' }
 *     attr.remove(el, 'role');
 *     attr.has(el, 'disabled');        // → boolean
 */
function attr(
    els: OneOrMany<Element>,
    attrs: Record<string, string>
): void;
function attr(
    el: Element,
    name: string
): string | null;
function attr(
    el: Element,
    names: string[]
): Record<string, string | null>;
function attr(
    els: OneOrMany<Element>,
    attrs: string | string[] | Record<string, string>
): void | string | null | Record<string, string | null> {

    if (typeof attrs === 'string') {

        return (els as Element).getAttribute(attrs);
    }

    if (Array.isArray(attrs)) {

        const el = els as Element;
        const result: Record<string, string | null> = {};

        for (const name of attrs) {

            result[name] = el.getAttribute(name);
        }

        return result;
    }

    const elements = toArray(els);

    for (const el of elements) {

        for (const [name, value] of Object.entries(attrs)) {

            el.setAttribute(name, value);
        }
    }
}

/**
 * Remove one or more attributes from one or more elements.
 *
 * @example
 *     attr.remove(el, 'role', 'data-id');
 *     attr.remove([el1, el2], 'role');
 */
attr.remove = function remove(
    els: OneOrMany<Element>,
    ...names: string[]
): void {

    const elements = toArray(els);

    for (const el of elements) {

        for (const name of names) {

            el.removeAttribute(name);
        }
    }
};

/**
 * Check whether an element has a specific attribute.
 *
 * @example
 *     attr.has(el, 'disabled'); // → true
 */
attr.has = function has(
    el: Element,
    name: string
): boolean {

    return el.hasAttribute(name);
};

export { attr };
