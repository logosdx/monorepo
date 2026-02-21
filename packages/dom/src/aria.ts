import { eachEl, applyEach, getMany } from './helpers.ts';
import type { OneOrMany } from './types.ts';

/**
 * Set, get, or manage ARIA attributes on DOM elements.
 * Auto-prefixes keys with `aria-` so callers use short names.
 *
 * @example
 *     aria(el, { pressed: 'true' });   // sets aria-pressed="true"
 *     aria(el, 'pressed');              // → 'true'
 *     aria(el, ['pressed', 'expanded']); // → { pressed: 'true', expanded: null }
 *     aria.remove(el, 'pressed');
 *     aria.role(el, 'button');
 *     aria.hide(el);
 */
function aria(
    els: OneOrMany<HTMLElement>,
    attrs: Record<string, string>
): void;
function aria(
    el: HTMLElement,
    attr: string
): string | null;
function aria(
    el: HTMLElement,
    attrs: string[]
): Record<string, string | null>;
function aria(
    els: OneOrMany<HTMLElement>,
    attrs: string | string[] | Record<string, string>
): void | string | null | Record<string, string | null> {

    if (typeof attrs === 'string') {

        return (els as HTMLElement).getAttribute(`aria-${attrs}`);
    }

    if (Array.isArray(attrs)) {

        const el = els as HTMLElement;
        return getMany(attrs, attr => el.getAttribute(`aria-${attr}`));
    }

    eachEl(els, Object.entries(attrs), (el, [key, value]) => {

        el.setAttribute(`aria-${key}`, value);
    });
}

/**
 * Remove one or more ARIA attributes from one or more elements.
 * Auto-prefixes with `aria-`.
 *
 * @example
 *     aria.remove(el, ['pressed', 'expanded']);
 *     aria.remove([el1, el2], 'hidden');
 */
aria.remove = function remove(
    els: OneOrMany<HTMLElement>,
    attrs: string | string[]
): void {

    eachEl(els, attrs, (el, attr) => el.removeAttribute(`aria-${attr}`));
};

/**
 * Create a get/set accessor for a single attribute.
 * Eliminates repeated get/set boilerplate for role, label, etc.
 */
function makeAccessor(attrName: string) {

    return function accessor(
        el: HTMLElement,
        value?: string
    ): string | null | void {

        if (value === undefined) {

            return el.getAttribute(attrName);
        }

        el.setAttribute(attrName, value);
    };
}

/**
 * Get or set the `role` attribute.
 * Unlike other ARIA attributes, `role` has no `aria-` prefix.
 *
 * @example
 *     aria.role(el, 'button'); // sets role="button"
 *     aria.role(el);           // → 'button'
 */
aria.role = makeAccessor('role');

/**
 * Get or set `aria-label`.
 *
 * @example
 *     aria.label(el, 'Submit form');
 *     aria.label(el); // → 'Submit form'
 */
aria.label = makeAccessor('aria-label');

/**
 * Set `aria-hidden="true"` on one or more elements.
 * Hides elements from assistive technology without
 * affecting visual display.
 *
 * @example
 *     aria.hide(el);
 *     aria.hide([el1, el2]);
 */
aria.hide = function hide(els: OneOrMany<HTMLElement>): void {

    applyEach(els, el => el.setAttribute('aria-hidden', 'true'));
};

/**
 * Remove `aria-hidden` from one or more elements.
 * Re-exposes elements to assistive technology.
 *
 * @example
 *     aria.show(el);
 */
aria.show = function show(els: OneOrMany<HTMLElement>): void {

    applyEach(els, el => el.removeAttribute('aria-hidden'));
};

/**
 * Set `aria-live` on one or more elements.
 * Controls how assistive technology announces dynamic content changes.
 *
 * @example
 *     aria.live(el, 'polite');
 *     aria.live([el1, el2], 'assertive');
 */
aria.live = function live(
    els: OneOrMany<HTMLElement>,
    value: string
): void {

    applyEach(els, el => el.setAttribute('aria-live', value));
};

export { aria };
