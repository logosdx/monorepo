import { html } from './';

/**
 * Appends children to the parent element
 * @param parent
 * @param children
 */
export const appendIn = (parent: Element, ...children: Element[]) => {

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
export const changeAndSubmitClonedForm = (
    form: HTMLFormElement,
    changeCb: Function
) => {


    html.events.on(form, 'submit', (e) => {


        e.preventDefault();

        const clone = form.cloneNode(true) as HTMLFormElement;

        changeCb && changeCb(clone);

        html.css.set(clone, { display: 'none'});

        document.body.appendChild(clone);

        clone.submit();
    });
};
