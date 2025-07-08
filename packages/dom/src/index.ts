export * from './utils.ts';
export * from './viewport.ts';

/**
 * Credit to
 * https://github.com/biancojs/bianco
 *
 * Where most of these ideas stemmed from
 */

import { HtmlCss } from './css.ts';
import { HtmlAttr } from './attrs.ts';
import { HtmlEvents } from './events.ts';
import { HtmlBehaviors } from './behaviors.ts';

export type {
    CssPropNames,
    CssProps
} from './css';

export type {
    GlobalEvents,
    EvListener
} from './events';

import { isBrowserLike } from '@logosdx/utils';

if (!isBrowserLike()) {

    throw new Error('Dom is not supported in this environment');
}

const document = window?.document;

export const css = HtmlCss;
export const attrs = HtmlAttr;
export const events = HtmlEvents;
export const behaviors = HtmlBehaviors


/**
 * Wraps `querySelectorAll` and converts a NodeList into an array.
 * It will always return an array, even if no elements are found.
 * @param selector CSS selector string to query for
 * @param ctx optional context element to search within (defaults to document)
 * @returns array of elements matching the selector
 *
 * @example
 * const buttons = $('button');
 * const inputs = $('input[type="text"]', form);
 * const items = $('.item', container);
 */
export const $ = <R extends Element = HTMLElement>(selector: string, ctx?: Element): R[] => {

    const elements = (ctx || document).querySelectorAll(selector);

    if (elements.length === 0) {

        return [];
    }

    return Array.from(elements) as R[];
};

/**
 * Main HTML utilities object providing access to CSS, attributes, events, and behaviors.
 * Contains all the DOM manipulation utilities organized by category.
 *
 * @example
 * // CSS manipulation
 * html.css.set(element, { color: 'red', fontSize: '16px' });
 *
 * // Attribute manipulation
 * html.attrs.set(element, { 'data-id': '123', class: 'active' });
 *
 * // Event handling
 * const cleanup = html.events.on(element, 'click', handleClick);
 *
 * // Behavior management
 * html.behaviors.bind(element, 'MyFeature', handler);
 */
export const html = {
    css,
    attrs,
    events,
    behaviors
};
