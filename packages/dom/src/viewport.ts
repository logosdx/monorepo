/**
 * Gets the max value from a list of arguments filtering the falsy values
 * @private
 * @param args - list of numbers
 * @returns the highest value
 */
const max = (...args: number[]) => Math.max(0, ...args.filter((v => !!v)), 0);

/**
 * Returns the width of the browser's scrollbar.
 * Creates a temporary measurement element to calculate the difference between offsetWidth and clientWidth.
 * @returns scrollbar width in pixels
 *
 * @example
 * const scrollbarWidth = scrollbarWidth();
 * // Adjust layout calculations to account for scrollbar
 */
export function scrollbarWidth() {

    const document = window?.document;

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
 * Gets the total height of the document including overflow content.
 * Returns the maximum value from various height properties to ensure accuracy across browsers.
 * @returns document height in pixels
 *
 * @example
 * const docHeight = documentHeight();
 * // Use for scroll calculations or layout positioning
 */
export function documentHeight() {

    const document = window?.document;

    return max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
    );
}

/**
 * Gets the total width of the document including overflow content.
 * Returns the maximum value from various width properties to ensure accuracy across browsers.
 * @returns document width in pixels
 *
 * @example
 * const docWidth = documentWidth();
 * // Use for responsive calculations or layout positioning
 */
export function documentWidth() {

    const document = window?.document;

    return max(
        document.body.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.clientWidth,
        document.documentElement.scrollWidth,
        document.documentElement.offsetWidth
    );
}

/**
 * Gets the current vertical scroll position of the document.
 * Returns the maximum value from various scroll properties to ensure cross-browser compatibility.
 * @returns scroll top value in pixels
 *
 * @example
 * const currentScroll = scrollTop();
 * // Use for scroll-based animations or positioning
 */
export function scrollTop() {

    const document = window?.document;

    return max(
        global.window?.scrollY,
        global.window?.pageYOffset,
        document.documentElement.scrollTop
    );
}

/**
 * Gets the current horizontal scroll position of the document.
 * Returns the maximum value from various scroll properties to ensure cross-browser compatibility.
 * @returns scroll left value in pixels
 *
 * @example
 * const currentScroll = scrollLeft();
 * // Use for horizontal scroll calculations
 */
export function scrollLeft() {

    const document = window?.document;

    return max(
        global.window?.scrollX,
        global.window?.pageXOffset,
        document.documentElement.scrollLeft
    );
}


/**
 * Gets the absolute top offset of an element relative to the document.
 * Calculates position by combining current scroll position with element's bounding rect.
 * @param el - the element to get the offset for
 * @returns the element's absolute top position in pixels
 *
 * @example
 * const topOffset = elementOffsetTop(myElement);
 * // Use for positioning calculations or scroll-to-element
 */
export function elementOffsetTop(el: HTMLElement) {

    return max(scrollTop() + el.getBoundingClientRect().top)
}

/**
 * Gets the absolute left offset of an element relative to the document.
 * Calculates position by combining current scroll position with element's bounding rect.
 * @param el - the element to get the offset for
 * @returns the element's absolute left position in pixels
 *
 * @example
 * const leftOffset = elementOffsetLeft(myElement);
 * // Use for positioning calculations or horizontal alignment
 */
export function elementOffsetLeft(el: HTMLElement) {

    return max(scrollLeft() + el.getBoundingClientRect().left)
}

/**
 * Gets the current viewport width (window inner width).
 * Accounts for scrollbar width to provide accurate available space.
 * @returns viewport width in pixels
 *
 * @example
 * const vw = viewportWidth();
 * // Use for responsive breakpoint calculations
 */
export function viewportWidth() {

    const window = global.window;

    return max(
        window?.innerWidth,
        window?.document?.documentElement?.clientWidth
    );
}

/**
 * Gets the current viewport height (window inner height).
 * Accounts for browser UI elements to provide accurate available space.
 * @returns viewport height in pixels
 *
 * @example
 * const vh = viewportHeight();
 * // Use for responsive layout calculations
 */
export function viewportHeight() {

    const window = global.window;

    return max(
        window?.innerHeight,
        window?.document?.documentElement?.clientHeight
    );
}

/**
 * Gets the device pixel ratio for high-DPI displays.
 * Useful for canvas rendering and image scaling.
 * @returns pixel ratio (1 for standard displays, 2+ for retina)
 *
 * @example
 * const ratio = devicePixelRatio();
 * // Scale canvas context for crisp rendering
 */
export function devicePixelRatio() {

    return global.window?.devicePixelRatio || 1;
}

/**
 * Gets the vertical scroll progress as a percentage (0-100).
 * Useful for progress indicators and scroll-based animations.
 * @returns scroll progress percentage
 *
 * @example
 * const progress = scrollProgress();
 * // Update progress bar: progressBar.style.width = `${progress}%`
 */
export function scrollProgress() {

    const current = scrollTop();
    const maxScroll = documentHeight() - viewportHeight();

    if (maxScroll <= 0) return 0;

    return Math.min(100, (current / maxScroll) * 100);
}

/**
 * Gets the horizontal scroll progress as a percentage (0-100).
 * Useful for horizontal progress indicators.
 * @returns horizontal scroll progress percentage
 *
 * @example
 * const hProgress = horizontalScrollProgress();
 * // Update horizontal progress indicator
 */
export function horizontalScrollProgress() {

    const current = scrollLeft();
    const maxScroll = documentWidth() - viewportWidth();

    if (maxScroll <= 0) return 0;

    return Math.min(100, (current / maxScroll) * 100);
}

/**
 * Checks if the page is scrolled to the bottom.
 * Useful for infinite scroll implementations.
 * @param threshold - pixels from bottom to consider "at bottom" (default: 10)
 * @returns true if scrolled to bottom
 *
 * @example
 * if (isAtBottom()) {
 *     // Load more content
 * }
 */
export function isAtBottom(threshold = 10) {

    return scrollTop() + viewportHeight() >= documentHeight() - threshold;
}

/**
 * Checks if the page is scrolled to the top.
 * Useful for "scroll to top" button visibility.
 * @param threshold - pixels from top to consider "at top" (default: 10)
 * @returns true if scrolled to top
 *
 * @example
 * const showTopButton = !isAtTop();
 */
export function isAtTop(threshold = 10) {

    return scrollTop() <= threshold;
}

/**
 * Gets the percentage of an element that is visible in the viewport.
 * Useful for lazy loading and visibility-based animations.
 * @param el - element to check
 * @returns percentage visible (0-100)
 *
 * @example
 * const visibility = elementVisibility(myElement);
 * // Fade in element based on visibility
 */
export function elementVisibility(el: HTMLElement) {

    const rect = el.getBoundingClientRect();
    const vw = viewportWidth();
    const vh = viewportHeight();

    const visibleWidth = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));

    const visibleArea = visibleWidth * visibleHeight;
    const totalArea = rect.width * rect.height;

    if (totalArea === 0) return 0;

    return (visibleArea / totalArea) * 100;
}

/**
 * Checks if an element is partially visible in the viewport.
 * More flexible than full visibility checks.
 * @param el - element to check
 * @param threshold - minimum percentage visible (default: 0.1 = 10%)
 * @returns true if element is partially visible
 *
 * @example
 * if (isPartiallyVisible(myElement, 0.5)) {
 *     // Element is at least 50% visible
 * }
 */
export function isPartiallyVisible(el: HTMLElement, threshold = 0.1) {

    return elementVisibility(el) >= threshold * 100;
}

/**
 * Gets the distance from an element to the viewport edges.
 * Useful for positioning tooltips, modals, or determining scroll direction.
 * @param el - element to measure
 * @returns object with distances to each edge
 *
 * @example
 * const distances = elementViewportDistances(myElement);
 * // Position tooltip based on available space
 */
export function elementViewportDistances(el: HTMLElement) {

    const rect = el.getBoundingClientRect();
    const vw = viewportWidth();
    const vh = viewportHeight();

    return {
        top: rect.top,
        bottom: vh - rect.bottom,
        left: rect.left,
        right: vw - rect.right
    };
}

/**
 * Smoothly scrolls to an element with optional offset.
 * Provides consistent scroll behavior across browsers.
 * @param el - element to scroll to
 * @param offset - additional offset from element top (default: 0)
 * @param behavior - scroll behavior (default: 'smooth')
 *
 * @example
 * scrollToElement(myElement, 20);
 * // Scrolls to element with 20px offset from top
 */
export function scrollToElement(
    el: HTMLElement,
    offset = 0,
    behavior: ScrollBehavior = 'smooth'
) {

    const targetY = elementOffsetTop(el) - offset;

    window?.scrollTo({
        top: targetY,
        behavior
    });
}

/**
 * Smoothly scrolls to a specific position.
 * Wrapper around window.scrollTo with consistent behavior.
 * @param x - horizontal position
 * @param y - vertical position
 * @param behavior - scroll behavior (default: 'smooth')
 *
 * @example
 * scrollToPosition(0, 500);
 * // Scrolls to 500px from top
 */
export function scrollToPosition(
    x: number,
    y: number,
    behavior: ScrollBehavior = 'smooth'
) {

    window?.scrollTo({
        left: x,
        top: y,
        behavior
    });
}

