import { Func, MaybePromise, assert } from '@logosdx/utils';
import { html } from './index.ts';
import { EvListener } from './events.ts';

/**
 * Appends children to the parent element.
 * Uses a while loop to efficiently append multiple children.
 * @param parent parent element to append children to
 * @param children child elements or text nodes to append
 *
 * @example
 * appendIn(container, child1, child2, child3);
 */
export const appendIn = (parent: Element, ...children: (Element | Node)[]) => {

    while (children.length) {

        // https://stackoverflow.com/questions/54496398/typescript-type-string-undefined-is-not-assignable-to-type-string
        const child = children.shift()!;
        parent.appendChild(child);
    }
};

/**
 * Appends elements after the target element.
 * Elements are inserted sequentially, with each new element becoming the new target.
 * @param target reference element to append after
 * @param elements elements to append after the target
 *
 * @example
 * appendAfter(reference, newElement1, newElement2);
 * // Result: reference -> newElement1 -> newElement2
 */
export const appendAfter = (target: Element, ...elements: Element[]) => {

    while (elements.length) {

        const el = elements.shift()!;
        target.after(el);
        target = el;
    }
};

/**
 * Appends elements before the target element.
 * Elements are inserted sequentially, with each new element becoming the new target.
 * @param target reference element to append before
 * @param elements elements to append before the target
 *
 * @example
 * appendBefore(reference, newElement1, newElement2);
 * // Result: newElement2 -> newElement1 -> reference
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
 * @param form The form element to clone and submit
 * @param changeCb The callback that will be passed the cloned form for manipulation
 *
 * @example
 * cloneAndSubmitForm(myForm, (clone) => {
 *     // Modify the cloned form
 *     clone.querySelector('input[name="id"]').value = 'new-id';
 * });
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
        clone.remove();
    });
};

/**
 * Triggers the given function when the DOMContentLoaded event is triggered.
 * @param fn function to execute when DOM is ready
 *
 * @example
 * onceReady(() => {
 *     // DOM is fully loaded and ready
 *     initializeApp();
 * });
 */
export const onceReady = (fn: Func) => {

    window?.addEventListener('DOMContentLoaded', fn);
}

/**
 * Copies given text to clipboard using the Clipboard API.
 * @param text text to copy to clipboard
 *
 * @example
 * copyToClipboard('Hello World');
 * // Text is now in the user's clipboard
 */
export const copyToClipboard = (text: string) => {

    navigator.clipboard.writeText(text);
};

/**
 * Shortcut to `document.createElement(...)`.
 * @param args arguments to pass to document.createElement
 * @returns created HTML element
 *
 * @example
 * const div = createEl('div');
 * const input = createEl('input', { type: 'text' });
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
 * Create an HTML element and attach attributes, CSS, events, and classes.
 * Attaches a `cleanup()` function for later detaching event listeners.
 * @param name HTML element tag name
 * @param opts configuration options for the element
 * @returns created element with cleanup function
 *
 * @example
 *
 * const myForm = createElWith('form', {
 *     text: 'inner text',
 *     attrs: {
 *         method: 'post',
 *         action: '/login'
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
     * @returns void
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

/**
 * Checks if an element is fully visible within the viewport.
 * @param element HTML element to check
 * @param refHeight reference height (defaults to window height)
 * @param refWidth reference width (defaults to window width)
 * @returns true if element is completely within the viewport
 *
 * @example
 * if (isInViewport(myElement)) {
 *     // Element is fully visible
 * }
 */
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

/**
 * Checks if an element is scrolled into view within a container.
 * @param el element to check
 * @param inRelationTo container element or window to check against
 * @returns true if element is scrolled into view
 *
 * @example
 * if (isScrolledIntoView(myElement, container)) {
 *     // Element is visible within the container
 * }
 */
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

/**
 * Swaps two CSS classes on an element.
 * If the element has the first class, it's replaced with the second, and vice versa.
 * @param el HTML element to swap classes on
 * @param one first CSS class name
 * @param two second CSS class name
 *
 * @example
 * swapClasses(button, 'active', 'inactive');
 * // If button has 'active' class, it becomes 'inactive'
 * // If button has 'inactive' class, it becomes 'active'
 */
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
