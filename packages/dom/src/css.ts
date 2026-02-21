import { toArray, isCustomProp, eachEl, getMany } from './helpers.ts';
import type { OneOrMany, AnyCssProp } from './types.ts';

/**
 * Set CSS properties on one or more elements.
 * Get computed CSS property values from a single element.
 *
 * Uses `setProperty` for custom properties (`--*`) and direct
 * style access for standard properties, matching browser conventions.
 *
 * @example
 *     css(el, { color: 'red', fontSize: '16px' });
 *     css(el, 'color');              // → 'red'
 *     css(el, ['color', 'fontSize']); // → { color: 'red', fontSize: '16px' }
 *     css.remove(el, 'color');
 */
function css(
    els: OneOrMany<HTMLElement>,
    props: Record<string, string>
): void;
function css(
    el: HTMLElement,
    prop: string
): string;
function css(
    el: HTMLElement,
    props: string[]
): Record<string, string>;
function css(
    els: OneOrMany<HTMLElement>,
    props: string | string[] | Record<string, string>
): void | string | Record<string, string> {

    if (typeof props === 'string') {

        const el = els as HTMLElement;
        return isCustomProp(props)
            ? getComputedStyle(el).getPropertyValue(props)
            : (el.style as any)[props] as string;
    }

    if (Array.isArray(props)) {

        const el = els as HTMLElement;
        return getMany(props, prop => isCustomProp(prop)
            ? getComputedStyle(el).getPropertyValue(prop)
            : (el.style as any)[prop] as string
        );
    }

    const elements = toArray(els);

    for (const el of elements) {

        for (const [prop, value] of Object.entries(props)) {

            if (isCustomProp(prop)) {

                el.style.setProperty(prop, value);
            }
            else {

                (el.style as any)[prop] = value;
            }
        }
    }
}

/**
 * Remove CSS properties from one or more elements.
 * Resets standard properties to empty string and uses
 * `removeProperty` for custom properties.
 *
 * @example
 *     css.remove(el, ['color', 'fontSize']);
 *     css.remove([el1, el2], ['--theme']);
 */
css.remove = function remove(
    els: OneOrMany<HTMLElement>,
    props: AnyCssProp | AnyCssProp[]
): void {

    eachEl(els, props, (el, prop) => {

        if (isCustomProp(prop)) {

            el.style.removeProperty(prop);
        }
        else {

            (el.style as any)[prop] = '';
        }
    });
};

export { css };
