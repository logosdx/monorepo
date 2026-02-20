import { DomCollection } from './collection.ts';
import { create } from './dom.ts';
import type { SelectOptions, CreateOptions } from './types.ts';

/**
 * Query the DOM and return a {@link DomCollection} wrapping matched elements.
 *
 * Supports two overloads:
 * - `$(selector, element)` — scopes the query to a parent element
 * - `$(selector, { signal })` — passes options through to the collection
 *
 * @example
 *     const buttons = $<HTMLButtonElement>('.btn');
 *     buttons.css({ color: 'red' }).on('click', handler);
 *
 * @example
 *     const items = $('.item', container);
 */
export function $<T extends Element = HTMLElement>(
    selector: string,
    ctxOrOpts?: Element | SelectOptions
): DomCollection<T> {

    let context: Element = document.documentElement;
    let opts: SelectOptions | undefined;

    if (ctxOrOpts instanceof Element) {

        context = ctxOrOpts;
    }
    else if (ctxOrOpts) {

        opts = ctxOrOpts;
    }

    const elements = Array.from(context.querySelectorAll<T>(selector));
    return new DomCollection<T>(elements, opts);
}

/**
 * Create a DOM element and return it wrapped in a {@link DomCollection}.
 *
 * @example
 *     const card = $.create('div', { text: 'Hello', class: ['card'] });
 */
$.create = function createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    opts?: CreateOptions<HTMLElementTagNameMap[K]>
): DomCollection<HTMLElementTagNameMap[K]> {

    const el = create(tag, opts);
    return new DomCollection([el], opts);
} as <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    opts?: CreateOptions<HTMLElementTagNameMap[K]>
) => DomCollection<HTMLElementTagNameMap[K]>;

// --- Re-exports ---
export { DomCollection } from './collection.ts';
export { css } from './css.ts';
export { attr } from './attr.ts';
export { classify } from './class.ts';
export { data } from './data.ts';
export { aria } from './aria.ts';
export { on, once, off, emit } from './events.ts';
export { animate } from './animate.ts';
export { observe } from './observe.ts';
export { watchVisibility, watchResize } from './watch.ts';
export { viewport } from './viewport.ts';
export { create, append, prepend, remove, replace } from './dom.ts';

export type * from './types.ts';
