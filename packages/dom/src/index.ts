export * from './utils';
export * from './viewport';

/**
 * Credit to
 * https://github.com/biancojs/bianco
 *
 * Where most of these ideas stemmed from
 */

import * as Css from './css';
import * as Attrs from './attrs';
import * as Events from './events';

export * from './utils';
export * from './viewport';

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
    get: Css.getCss,

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
    set: Css.setCss,

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
    remove: Css.removeCss,

    /**
     * see `html.css.remove(...)`
     */
    rm: Css.removeCss
};

const attrs = {
    /**
     * Returns attributes on one or many html elements
     * @param els list of html elements
     * @param propNames attribute
     *
     * @example
     *
     * attrs.get(form, 'method');
     * // > 'post'
     *
     * attrs.get([select, input], 'name');
     * // > ['role', 'full_name']
     *
     * attrs.get(form, ['method', 'action']);
     * // > { method: 'post', action: '/' }
     *
     * attrs.get([select, input], ['name', 'value']);
     * // > [{ name: '', value: '' }, { name: '', value: '' }]
     */
    get: Attrs.getAttr,

    /**
     *
     * @param els
     * @param props
     *
     * @example
     *
     * attrs.set(input, { name: 'full_name' });
     * attrs.set([div, div, div], { 'data-show': 'false' });
     */
    set: Attrs.setAttr,

    /**
     *
     * @param els
     * @param propNames
     *
     * attrs.has(form, 'method');
     * // > true
     *
     * attrs.has([input, textarea], 'required');
     * // > [true, false]
     *
     * attrs.has([input, textarea], ['required', 'name']);
     * // > [{ required: true, name: false }, { required: false, name: false }]
     */
    has: Attrs.hasAttr,

    /**
     * Removes attributes on one or many html elements
     * @param els list of html elements
     * @param propNames attribute
     *
     * @example
     *
     * attrs.remove(form, 'method');
     * attrs.remove([select, input], 'name');
     * attrs.remove(form, ['method', 'action']);
     * attrs.remove([select, input], ['name', 'value']);
     */
    remove: Attrs.removeAttr,

    /**
     * see `html.attrs.remove`
     */
    rm: Attrs.removeAttr,
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
     * // can use alternative name
     * html.events.listen(...)
     */
    on: Events.eventOn,

    /**
     * Same as `html.events.on`
     */
    listen: Events.eventOn,

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
     * // can use alternative name
     * html.events.once(div, 'click', () => {});
     */
    one: Events.eventOne,

    /**
     * Same as `html.events.one`
     */
    once: Events.eventOne,

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
    off: Events.eventOff,

    /**
     * Same as `html.events.off`
     */
    remove: Events.eventOff,

    /**
     * Same as `html.events.off`
     */
    rm: Events.eventOff,

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
    trigger: Events.eventTrigger,

    /**
     * Same as `html.events.trigger`
     */
    emit: Events.eventTrigger,

    /**
     * Same as `html.events.trigger`
     */
    send: Events.eventTrigger,
};


/**
 * Shortcut to `querySelectorAll` which converts a NodeList into an array.
 * If the resulting NodeList contains only 1 element, it will be returned instead of an array.
 * If the resulting NodeList contains only nothing, `null` will be returned instead.
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
