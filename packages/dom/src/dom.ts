import { css } from './css.ts';
import { attr } from './attr.ts';
import { classify } from './class.ts';
import { on } from './events.ts';
import type { CreateOptions, EvListener } from './types.ts';

/**
 * Create an HTML element with full declarative configuration.
 *
 * Combines element creation with class, style, attribute, children,
 * and event binding in a single call — reducing imperative boilerplate.
 *
 * @example
 *     const card = create('div', {
 *         text: 'Hello',
 *         css: { padding: '1rem', '--theme': 'dark' },
 *         attrs: { 'data-id': '123' },
 *         class: ['card', 'active'],
 *         children: [create('span', { text: 'child' }), 'text node'],
 *         on: { click: handler },
 *         signal: controller.signal
 *     });
 */
export function create<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    opts?: CreateOptions
): HTMLElementTagNameMap[K] {

    const el = document.createElement(tag);

    if (!opts) return el;

    if (opts.text) el.textContent = opts.text;
    if (opts.class) classify.add(el, ...opts.class);
    if (opts.css) css(el, opts.css);
    if (opts.attrs) attr(el, opts.attrs);

    if (opts.children) {

        for (const child of opts.children) {

            if (typeof child === 'string') {

                el.appendChild(document.createTextNode(child));
            }
            else {

                el.appendChild(child);
            }
        }
    }

    if (opts.on) {

        for (const [event, handler] of Object.entries(opts.on)) {

            on(el, event, handler as EvListener,
                opts.signal ? { signal: opts.signal } : undefined);
        }
    }

    return el;
}

/**
 * Append one or more children to a parent element.
 *
 * @example
 *     append(container, header, body, footer);
 */
export function append(parent: Element, ...children: (Element | Node)[]): void {

    for (const child of children) {

        parent.appendChild(child);
    }
}

/**
 * Prepend one or more children to a parent element.
 *
 * @example
 *     prepend(list, newFirstItem);
 */
export function prepend(parent: Element, ...children: (Element | Node)[]): void {

    for (const child of children) {

        parent.prepend(child);
    }
}

/**
 * Remove an element from the DOM.
 *
 * @example
 *     remove(obsoleteElement);
 */
export function remove(el: Element): void {

    el.remove();
}

/**
 * Replace an existing element with a new one.
 *
 * @example
 *     replace(oldCard, updatedCard);
 */
export function replace(oldEl: Element, newEl: Element): void {

    oldEl.replaceWith(newEl);
}
