import { Func, MaybePromise, assert } from '@logosdx/utils';
import { html } from './index.ts';
import { EvListener } from './events.ts';

/**
 * Appends children to the parent element
 * @param parent
 * @param children
 */
export const appendIn = (parent: Element, ...children: (Element | Node)[]) => {

    while (children.length) {

        // https://stackoverflow.com/questions/54496398/typescript-type-string-undefined-is-not-assignable-to-type-string
        const child = children.shift()!;
        parent.appendChild(child);
    }
};

/**
 * Appends elements after the target element
 * @param target
 * @param elements
 */
export const appendAfter = (target: Element, ...elements: Element[]) => {

    while (elements.length) {

        const el = elements.shift()!;
        target.after(el);
        target = el;
    }
};

/**
 * Appends elements after the target element
 * @param target
 * @param elements
 */
export const appendBefore = (target: Element, ...elements: Element[]) => {

    while (elements.length) {

        const el = elements.shift()!;
        target.before(el);
        target = el;
    }
};

/**
 * Receives a form to clone, and a callback to manipulate the clone.
 * Appends a hidden form to DOM and then submits.
 * @param {HTMLFormElement} form The form element
 * @param {Function} changeCb The callback that will be passed cloned form
 */
export const cloneAndSubmitForm = <T extends HTMLFormElement>(
    form: T,
    changeCb: (form: T) => MaybePromise<void>
) => {


    html.events.on(form, 'submit', async (e) => {

        e.preventDefault();

        const clone = form.cloneNode(true) as T;

        changeCb && (await changeCb(clone));

        html.css.set(clone, { display: 'none'});
        document.body.appendChild(clone);
        clone.submit();
    });
};

/**
 * Triggers then given function when the DOMContentLoaded
 * event is triggered.
 * @param fn
 */
export const onceReady = (fn: Func) => {

    window?.addEventListener('DOMContentLoaded', fn);
}

/**
 * Copy given text to clipboard
 * @param text
 */
export const copyToClipboard = (text: string) => {

    navigator.clipboard.writeText(text);
};

/**
 * Shortcut to `document.createElement(...)`
 * @param args
 * @returns
 */
export const createEl: Document['createElement'] = (...args: Parameters<Document['createElement']>) => {

    return document.createElement(...args);
}

type CreateElWithOpts<CustomHtmlEvents> = {
    text?: string,
    children?: (string | HTMLElement)[],
    class?: string[],
    attrs?: Record<string, string>,
    domEvents?: { [E in keyof GlobalEventHandlersEventMap]?: EvListener<E> },
    customEvents?: CustomHtmlEvents,
    css?: Partial<CSSStyleDeclaration>
}

/**
 * Create an HTML element and attach attributes, css, events, classes.
 * Attaches `cleanup()` function for later detaching event listeners.
 * @param opts
 * @returns
 *
 * @example
 *
 * const myForm = createElWith('form', {
 *     text: 'inner text',
 *     attrs: {
 *         method: 'post',
 *         acton: '/login'
 *     },
 *     css: {
 *         background: 'red',
 *     },
 *     class: ['form'],
 *     domEvents: {
 *         reset: (e) => {},
 *         submit: (e) => {}
 *     },
 *     customEvents: {
 *         bounce: (e) => {}
 *     }
 * });
 *
 * // unbind events
 * myForm.cleanup();
 */
export const createElWith = <
    CustomHtmlEvents extends Record<string, (e: Event) => any>,
    N extends Parameters<Document['createElement']>[0],
>(
    name: N, opts: CreateElWithOpts<CustomHtmlEvents> = {}
) => {

    const el = createEl(name);

    assert(!!el, 'invalid element');
    assert(!opts.class || Array.isArray(opts.class), 'invalid opts.class');
    assert(!opts.attrs || typeof opts.attrs === 'object', 'invalid opts.attrs');
    assert(!opts.domEvents || typeof opts.domEvents === 'object', 'invalid opts.events');
    assert(!opts.customEvents || typeof opts.customEvents === 'object', 'invalid opts.events');
    assert(!opts.css || typeof opts.css === 'object', 'invalid opts.css');
    assert(!opts.text || typeof opts.text === 'string', 'invalid opts.text');
    assert(!opts.children || Array.isArray(opts.children), 'invalid opts.children');

    if (opts.text && opts.text.length) {

        appendIn(el, document.createTextNode(opts.text));
    }

    if (opts.children && opts.children.length) {

        const children = opts.children.map(

            (c) => (

                typeof c === 'string' ?
                document.createTextNode(c) :
                c
            )
        );

        appendIn(el, ...children);
    }

    if (opts.class && opts.class.length) {

        el.classList.add(...opts.class);
    }

    if (opts.css) {
        html.css.set(el, opts.css!);
    }

    if (opts.attrs) {
        html.attrs.set(el, opts.attrs);
    }

    /**
     * Cleans up events, if any were passed
     * @returns
     */
    let cleanup = () => null as any;

    const attachEventsFor = (
        entries: [string, EvListener<any>][]
    ) => {

        const cleaupCbs = entries.map(
            ([ev, fn]) => html.events.on(el, ev, fn as any)
        );

        const originalCleanup = cleanup;
        cleanup = () => {

            originalCleanup();
            cleaupCbs.forEach(cleanUp => cleanUp());
        };
    }

    if (opts.domEvents) {

        attachEventsFor(Object.entries(opts.domEvents));
    }

    if (opts.customEvents) {

        attachEventsFor(Object.entries(opts.customEvents));
    }

    const returnEl = el as (
        N extends keyof HTMLElementDeprecatedTagNameMap
        ? HTMLElementDeprecatedTagNameMap[N]
        : N extends keyof HTMLElementTagNameMap
            ? HTMLElementTagNameMap[N]
            : HTMLElement
    ) & { cleanup: typeof cleanup };

    return returnEl
};

export const isInViewport = (
    element: HTMLElement,
    refHeight = window.innerHeight || document.documentElement.clientHeight,
    refWidth = window.innerWidth || document.documentElement.clientWidth
) => {

    const rect = element.getBoundingClientRect();

    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= refHeight &&
        rect.right <= refWidth
    );
};

export const isScrolledIntoView = (
    el: HTMLElement,
    inRelationTo: HTMLElement | Window = window
) => {

    const relEl = inRelationTo as HTMLElement;
    const relWin = inRelationTo as Window;

    const top = relEl.scrollTop || relWin.scrollY;

    const offset = el.offsetTop;
    const height = el.offsetHeight;

    return top >= offset && top < offset + height;
};

export const swapClasses = (el: HTMLElement, one: string, two: string) => {

    const hasOne = el.classList.contains(one);
    const hasTwo = el.classList.contains(two);

    if (hasOne) {

        el.classList.remove(one);
        el.classList.add(two);
    }

    if (hasTwo) {

        el.classList.remove(two);
        el.classList.add(one);
    }
};
