import { toArray, applyEach } from './helpers.ts';
import type { OneOrMany } from './types.ts';

/**
 * Class manipulation utilities for DOM elements.
 * Wraps classList API with support for operating on multiple elements at once.
 *
 * @example
 *     classify.add(el, ['active', 'highlighted']);
 *     classify.toggle([el1, el2], 'visible');
 *     classify.swap(el, 'open', 'closed');
 */
export const classify = {

    /**
     * Add one or more classes to one or many elements.
     *
     * @example
     *     classify.add(el, ['active', 'highlighted']);
     *     classify.add([el1, el2], 'visible');
     */
    add(els: OneOrMany<Element>, names: string | string[]): void {

        const classes = toArray(names);

        applyEach(els, el => el.classList.add(...classes));
    },

    /**
     * Remove one or more classes from one or many elements.
     *
     * @example
     *     classify.remove(el, ['active', 'highlighted']);
     */
    remove(els: OneOrMany<Element>, names: string | string[]): void {

        const classes = toArray(names);

        applyEach(els, el => el.classList.remove(...classes));
    },

    /**
     * Toggle a class on one or many elements.
     * Each element toggles independently based on its own state.
     *
     * @example
     *     classify.toggle(el, 'active');
     *     classify.toggle([el1, el2], 'visible');
     */
    toggle(els: OneOrMany<Element>, name: string): void {

        applyEach(els, el => el.classList.toggle(name));
    },

    /**
     * Check whether a single element has a class.
     *
     * @example
     *     if (classify.has(el, 'active')) { ... }
     */
    has(el: Element, name: string): boolean {

        return el.classList.contains(name);
    },

    /**
     * Swap between two classes on one or many elements.
     * If the element has class `a`, it gets `b` instead (and vice versa).
     * If the element has neither, nothing happens.
     *
     * @example
     *     classify.swap(el, 'open', 'closed');
     */
    swap(els: OneOrMany<Element>, a: string, b: string): void {

        applyEach(els, el => {

            if (el.classList.contains(a)) {

                el.classList.remove(a);
                el.classList.add(b);
            }
            else if (el.classList.contains(b)) {

                el.classList.remove(b);
                el.classList.add(a);
            }
        });
    },
};
