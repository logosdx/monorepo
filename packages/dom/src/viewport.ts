const document = window?.document;

/**
 * Get the max value from a list of arguments filtering the falsy values
 * @private
 * @param args - list of numbers
 * @returns the highest value
 */
const max = (...args: number[]) => Math.max(0, ...args.filter((v => !!v)), 0);

/**
 * Return the size of the scrollbar that depends on the browser or device used on the client
 * @returns - the browser scrollbar width
 */
export function scrollbarWidth() {

    // Create the measurement node
    const div = document.createElement('div')

    Object.assign(div.style, {
        width: '100px',
        height: '100px',
        overflow: 'scroll',
        position: 'fixed',
        opacity: '0'
    });

    document.body.appendChild(div);

    // Read values
    const { offsetWidth, clientWidth } = div;

    // Delete helper element
    document.body.removeChild(div);

    return max(offsetWidth - clientWidth);
}

/**
 * Get the height of the whole page
 * @returns height in px of the document
 */
export function documentHeight() {

    return max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
    );
}

/**
 * Get the width of the whole page
 * @returns width in px of the document
 */
export function documentWidth() {

    return max(
        document.body.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.clientWidth,
        document.documentElement.scrollWidth,
        document.documentElement.offsetWidth
    );
}

/**
 * Return amount of px scrolled from the top of the document
 * @returns scroll top value in px
 */
export function scrollTop() {

    return max(
        global.window?.scrollY,
        global.window?.pageYOffset,
        document.documentElement.scrollTop
    );
}

/**
 * Return amount of px scrolled from the left of the document
 * @returns scroll left value in px
 */
export function scrollLeft() {
    return max(
        global.window?.scrollX,
        global.window?.pageXOffset,
        document.documentElement.scrollLeft
    );
}


/**
 * Get the offset top of any DOM element
 * @param el - the element we need to check
 * @returns the element y position in px
 */
export function elementOffsetTop(el: HTMLElement) {

    return max(scrollTop() + el.getBoundingClientRect().top)
}

/**
 * Get the offset left of any DOM element
 * @param el - the element we need to check
 * @returns the element x position in px
 */
export function elementOffsetLeft(el: HTMLElement) {

    return max(scrollLeft() + el.getBoundingClientRect().left)
}

