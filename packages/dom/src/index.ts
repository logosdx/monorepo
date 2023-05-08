export * from './utils';
export * from './viewport';

/**
 * Credit to
 * https://github.com/biancojs/bianco
 *
 * Where most of these ideas stemmed from
 */

import { HtmlCss } from './css';
import { HtmlAttr } from './attrs';
import { HtmlEvents } from './events';

export {
    CssPropNames,
    CssProps
} from './css';

export {
    GlobalEvents,
    EvListener
} from './events';

const document = window.document;

const css = {

    /**
     * Gets one or many css properties from one or many html elements.
     * @param els list of html elements
     * @param propNames property name or array of property names
     *
     * @example
     *
     * html.css.get(div, 'color');
     * // > 'red'
     *
     * html.css.get([div, span], 'color');
     * // > ['red', 'blue']
     *
     * html.css.get(div, ['color', 'fontSize']);
     * // > { color: 'red', fontSize: '12px' }
     *
     * html.css.get([div, span], ['color', 'fontSize']);
     * // > [{ color: 'red', fontSize: '12px' }, { color: 'blue', fontSize: '10px' }]
     *
     */
    get: HtmlCss.get.bind(HtmlCss),

    /**
     * Sets css properties on one or many html elements.
     * @param els list of html elements
     * @param props CSS style props (div.style.fontSize);
     *
     * @example
     *
     * html.css.set([div, span], {
     *      color: 'blue',
     *      paddingRight: '10px'
     * });
     *
     * html.css.set(div, {
     *      color: 'blue',
     *      paddingRight: '10px'
     * });
     */
    set: HtmlCss.set.bind(HtmlCss),

    /**
     * See `html.css.set(...)`
     */
    add: HtmlCss.set.bind(HtmlCss),

    /**
     * Removes properties from html elements
     * @param els list of html elements
     * @param propNames property name or array of property names
     *
     * @example
     *
     * css.remove(div, 'color');
     * css.remove([div, span], 'color');
     * css.remove(div, ['color', 'fontSize']);
     * css.remove([div, span], ['color', 'fontSize']);
     */
    remove: HtmlCss.remove.bind(HtmlCss),

    /**
     * see `html.css.remove(...)`
     */
    rm: HtmlCss.remove.bind(HtmlCss)
};

const attrs = {
    /**
     * Returns attributes on one or many html elements
     * @param els list of html elements
     * @param propNames attribute
     *
     * @example
     *
     * html.attrs.get(form, 'method');
     * // > 'post'
     *
     * html.attrs.get([select, input], 'name');
     * // > ['role', 'full_name']
     *
     * html.attrs.get(form, ['method', 'action']);
     * // > { method: 'post', action: '/' }
     *
     * html.attrs.get([select, input], ['name', 'value']);
     * // > [{ name: '', value: '' }, { name: '', value: '' }]
     */
    get: HtmlAttr.get.bind(HtmlAttr),

    /**
     *
     * @param els
     * @param props
     *
     * @example
     *
     * html.attrs.set(input, { name: 'full_name' });
     * html.attrs.set([div, div, div], { 'data-show': 'false' });
     */
    set: HtmlAttr.set.bind(HtmlAttr),

    /**
     * see `html.attrs.set(...)`
     */
    add: HtmlAttr.set.bind(HtmlAttr),

    /**
     *
     * @param els
     * @param propNames
     *
     * html.attrs.has(form, 'method');
     * // > true
     *
     * html.attrs.has([input, textarea], 'required');
     * // > [true, false]
     *
     * html.attrs.has([input, textarea], ['required', 'name']);
     * // > [{ required: true, name: false }, { required: false, name: false }]
     */
    has: HtmlAttr.has.bind(HtmlAttr),

    /**
     * Removes attributes on one or many html elements
     * @param els list of html elements
     * @param propNames attribute
     *
     * @example
     *
     * html.attrs.remove(form, 'method');
     * html.attrs.remove([select, input], 'name');
     * html.attrs.remove(form, ['method', 'action']);
     * html.attrs.remove([select, input], ['name', 'value']);
     */
    remove: HtmlAttr.remove.bind(HtmlAttr),

    /**
     * see `html.attrs.remove(...)`
     */
    rm: HtmlAttr.remove.bind(HtmlAttr),
};

const events = {


    /**
     * Adds event listeners to dom event interfaces
     * @param els list of html elements
     * @param events events separated by space
     * @param callback
     * @param opts options to pass to addEventListener
     *
     * @example
     *
     * html.events.on(div, 'click', () => {});
     * html.events.on(div, ['focus', 'blur'], () => {});
     * html.events.on([div, input], ['focus', 'blur'], () => {});
     *
     * // returns a cleaup function
     *
     * const cleanup = html.events.on(div, 'click', () => {});
     * setTimeout(cleanup, 1000);
     *
     * // can use alternative name
     * html.events.listen(...)
     */
    on: HtmlEvents.on,

    /**
     * Same as `html.events.on`
     */
    listen: HtmlEvents.on,

    /**
     * Same as `html.events.on`
     */
    add: HtmlEvents.on,

    /**
     * Adds event listeners to dom event interfaces that only run once
     * @param els list of html elements
     * @param events events separated by space
     * @param callback
     * @param opts options to pass to addEventListener
     *
     * @example
     *
     * html.events.one(div, 'click', () => {});
     * html.events.one(div, ['focus', 'blur'], () => {});
     * html.events.one([div, input], ['focus', 'blur'], () => {});
     *
     * // returns a cleaup function
     *
     * const cleanup = html.events.one(div, 'click', () => {});
     * setTimeout(cleanup, 1000);
     * // can use alternative name
     * html.events.once(div, 'click', () => {});
     */
    once: HtmlEvents.once,

    /**
     * Same as `html.events.once`
     */
    one: HtmlEvents.once,

    /**
     * Removes event listeners on dom event interfaces
     * @param els list of html elements
     * @param events events separated by space
     * @param callback
     * @param opts options to pass to addEventListener
     *
     * @example
     *
     * html.events.off(div, 'click', callback);
     * html.events.off(div, ['focus', 'blur'], callback);
     * html.events.off([div, input], ['focus', 'blur'], callback);
     *
     * // can use alternative name
     * html.events.remove(...)
     * html.events.rm(...)
     */
    off: HtmlEvents.off,

    /**
     * Same as `html.events.off`
     */
    remove: HtmlEvents.off,

    /**
     * Same as `html.events.off`
     */
    rm: HtmlEvents.off,

    /**
     * Same as `html.events.off`
     */
    unlisten: HtmlEvents.off,

    /**
     *
     * @param els list of html elements
     * @param event a single event
     * @param data Optional data to pass via `event.detail`
     *
     * @example
     *
     * html.events.trigger(div, 'click', { key: 'Esc' })
     * html.events.trigger([div, span], 'click', { key: 'Esc' })
     *
     * // can use alternative name
     * html.events.emit(...);
     * html.events.send(...);
     */
    trigger: HtmlEvents.trigger,

    /**
     * Same as `html.events.trigger`
     */
    emit: HtmlEvents.trigger,

    /**
     * Same as `html.events.trigger`
     */
    send: HtmlEvents.trigger,
};


/**
 * Wraps `querySelectorAll` and converts a NodeList into an array.
 * It will always return an array
 * @param selector
 * @param ctx
 * @returns
 */
export const $ = (selector: string, ctx?: Element): Element[] => {

    const elements = (ctx || document).querySelectorAll(selector);

    if (elements.length === 0) {

        return [];
    }

    return Array.from(elements);
};

export const html = {
    css,
    attrs,
    events
};
