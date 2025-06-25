import { attemptSync } from '@logosdx/utils';

/**
 * Gets the max value from a list of arguments filtering the falsy values
 * @private
 * @param args - list of numbers
 * @returns the highest value
 */
const max = (...args: number[]) => Math.max(0, ...args.filter((v => !!v)), 0);

/**
 * Returns the width of the browser's scrollbar.
 *
 * This addresses the cross-browser inconsistency in scrollbar width calculations.
 * Different browsers and operating systems render scrollbars with varying widths,
 * and some hide scrollbars dynamically. This measurement is critical for precise
 * layout calculations in fixed-position elements, modal positioning, and responsive
 * design where accounting for scrollbar width prevents layout shifts.
 *
 * Creates a temporary measurement element to calculate the difference between offsetWidth and clientWidth.
 * @returns scrollbar width in pixels, or 0 if measurement fails
 *
 * @example
 * const scrollbarWidth = scrollbarWidth();
 * // Adjust layout calculations to account for scrollbar
 */
export function scrollbarWidth(): number {

    const document = window?.document;

    if (!document?.body) {

        return 0;
    }

    const [result, err] = attemptSync(() => {

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
    });

    if (err) {

        console.warn('Failed to measure scrollbar width:', err);
        return 0;
    }

    return result;
}

/**
 * Gets the total height of the document including overflow content.
 *
 * This solves the cross-browser challenge of accurately measuring document height.
 * Different browsers report document dimensions through different properties
 * (scrollHeight, offsetHeight, clientHeight), and each can return varying values
 * depending on CSS box model, DOCTYPE, and quirks mode. This function ensures
 * reliable measurements for scroll progress indicators, infinite scroll implementations,
 * and precise positioning calculations.
 *
 * Returns the maximum value from various height properties to ensure accuracy across browsers.
 * @returns document height in pixels
 *
 * @example
 * const docHeight = documentHeight();
 * // Use for scroll calculations or layout positioning
 */
export function documentHeight(): number {

    const document = window?.document;

    if (!document) {

        return 0;
    }

    return max(
        document.body?.scrollHeight || 0,
        document.body?.offsetHeight || 0,
        document.documentElement?.clientHeight || 0,
        document.documentElement?.scrollHeight || 0,
        document.documentElement?.offsetHeight || 0
    );
}

/**
 * Gets the total width of the document including overflow content.
 *
 * This addresses the same cross-browser measurement challenges as documentHeight
 * but for horizontal dimensions. Critical for horizontal scroll implementations,
 * responsive breakpoint calculations, and ensuring content fits within viewports
 * across different browser engines and rendering modes.
 *
 * Returns the maximum value from various width properties to ensure accuracy across browsers.
 * @returns document width in pixels
 *
 * @example
 * const docWidth = documentWidth();
 * // Use for responsive calculations or layout positioning
 */
export function documentWidth(): number {

    const document = window?.document;

    if (!document) {

        return 0;
    }

    return max(
        document.body?.scrollWidth || 0,
        document.body?.offsetWidth || 0,
        document.documentElement?.clientWidth || 0,
        document.documentElement?.scrollWidth || 0,
        document.documentElement?.offsetWidth || 0
    );
}

/**
 * Gets the current vertical scroll position of the document.
 *
 * This handles the browser inconsistency where scroll position is reported
 * through different properties: window.scrollY (modern), window.pageYOffset (legacy),
 * and document.documentElement.scrollTop (IE/Edge). Different browsers and
 * mobile platforms report scroll position through different mechanisms,
 * making reliable scroll position detection essential for scroll-based
 * animations, progress indicators, and viewport calculations.
 *
 * Returns the maximum value from various scroll properties to ensure cross-browser compatibility.
 * @returns scroll top value in pixels
 *
 * @example
 * const currentScroll = scrollTop();
 * // Use for scroll-based animations or positioning
 */
export function scrollTop(): number {

    const document = window?.document;

    if (!document) {

        return 0;
    }

    return max(
        window?.scrollY || 0,
        window?.pageYOffset || 0,
        document.documentElement?.scrollTop || 0
    );
}

/**
 * Gets the current horizontal scroll position of the document.
 *
 * Similar to scrollTop, this addresses browser inconsistencies in horizontal
 * scroll position reporting. Essential for horizontal scroll implementations,
 * carousel positioning, and responsive layouts that need precise horizontal
 * scroll awareness across different browsers and mobile platforms.
 *
 * Returns the maximum value from various scroll properties to ensure cross-browser compatibility.
 * @returns scroll left value in pixels
 *
 * @example
 * const currentScroll = scrollLeft();
 * // Use for horizontal scroll calculations
 */
export function scrollLeft(): number {

    const document = window?.document;

    if (!document) {

        return 0;
    }

    return max(
        window?.scrollX || 0,
        window?.pageXOffset || 0,
        document.documentElement?.scrollLeft || 0
    );
}

/**
 * Gets the absolute top offset of an element relative to the document.
 *
 * This solves the challenge of accurate element positioning in dynamic layouts.
 * getBoundingClientRect() provides viewport-relative positions, but many use cases
 * require document-relative positions for scroll animations, anchor linking,
 * and precise element targeting. This function bridges that gap by combining
 * current scroll position with element bounds for reliable absolute positioning.
 *
 * Calculates position by combining current scroll position with element's bounding rect.
 * @param el - the element to get the offset for
 * @returns the element's absolute top position in pixels
 *
 * @example
 * const topOffset = elementOffsetTop(myElement);
 * // Use for positioning calculations or scroll-to-element
 */
export function elementOffsetTop(el: HTMLElement): number {

    if (!el) {

        return 0;
    }

    const [rect, err] = attemptSync(() => el.getBoundingClientRect());

    if (err || !rect) {

        return 0;
    }

    return max(scrollTop() + rect.top);
}

/**
 * Gets the absolute left offset of an element relative to the document.
 *
 * Complementary to elementOffsetTop, this provides reliable horizontal positioning
 * calculations essential for tooltip positioning, dropdown alignment, and
 * horizontal scroll-to-element implementations across different browser
 * rendering contexts and scroll states.
 *
 * Calculates position by combining current scroll position with element's bounding rect.
 * @param el - the element to get the offset for
 * @returns the element's absolute left position in pixels
 *
 * @example
 * const leftOffset = elementOffsetLeft(myElement);
 * // Use for positioning calculations or horizontal alignment
 */
export function elementOffsetLeft(el: HTMLElement): number {

    if (!el) {

        return 0;
    }

    const [rect, err] = attemptSync(() => el.getBoundingClientRect());

    if (err || !rect) {

        return 0;
    }

    return max(scrollLeft() + rect.left);
}

/**
 * Gets the current viewport width (window inner width).
 *
 * This addresses viewport calculation inconsistencies across browsers and mobile devices.
 * Mobile browsers dynamically hide/show UI elements (address bars, toolbars), causing
 * viewport dimensions to change during scrolling. Different browsers also report viewport
 * dimensions differently. This function provides reliable viewport width calculations
 * essential for responsive breakpoints and layout calculations.
 *
 * Accounts for scrollbar width to provide accurate available space.
 * @returns viewport width in pixels
 *
 * @example
 * const vw = viewportWidth();
 * // Use for responsive breakpoint calculations
 */
export function viewportWidth(): number {

    if (!window) {

        return 0;
    }

    return max(
        window?.innerWidth || 0,
        window?.document?.documentElement?.clientWidth || 0
    );
}

/**
 * Gets the current viewport height (window inner height).
 *
 * Critical for mobile web development where viewport height changes dynamically
 * as browsers show/hide UI elements. This inconsistency breaks fixed positioning,
 * full-height layouts, and scroll calculations. This function provides reliable
 * viewport height measurements essential for responsive design and mobile-first
 * development approaches.
 *
 * Accounts for browser UI elements to provide accurate available space.
 * @returns viewport height in pixels
 *
 * @example
 * const vh = viewportHeight();
 * // Use for responsive layout calculations
 */
export function viewportHeight(): number {

    if (!window) {

        return 0;
    }

    return max(
        window?.innerHeight || 0,
        window?.document?.documentElement?.clientHeight || 0
    );
}

/**
 * Gets the device pixel ratio for high-DPI displays.
 *
 * This is essential for crisp rendering on retina/high-DPI displays. Modern devices
 * have varying pixel densities, and web content needs to adapt to provide sharp
 * visuals. This is particularly critical for canvas rendering, image scaling,
 * and precise pixel-perfect layouts that need to look crisp across different
 * display technologies and zoom levels.
 *
 * Useful for canvas rendering and image scaling.
 * @returns pixel ratio (1 for standard displays, 2+ for retina)
 *
 * @example
 * const ratio = devicePixelRatio();
 * // Scale canvas context for crisp rendering
 */
export function devicePixelRatio(): number {

    return window?.devicePixelRatio || 1;
}

/**
 * Gets the vertical scroll progress as a percentage (0-100).
 *
 * This provides a normalized scroll position essential for progress indicators,
 * reading progress bars, and scroll-based animations. Calculating accurate scroll
 * progress requires accounting for document height variations and viewport differences
 * across browsers, making this abstraction valuable for consistent user experiences.
 *
 * When an element is provided, calculates progress within that element's scrollable area.
 * When no element is provided, calculates progress for the entire document.
 *
 * Useful for progress indicators and scroll-based animations.
 * @param element - Optional element to calculate scroll progress within
 * @returns scroll progress percentage
 *
 * @example
 * const progress = scrollProgress();
 * // Update progress bar: progressBar.style.width = `${progress}%`
 *
 * @example
 * const elementProgress = scrollProgress(document.querySelector('.scrollable'));
 * // Get progress within specific element
 */
export function scrollProgress(element?: Element): number {

    if (element) {

        const current = element.scrollTop;
        const maxScroll = element.scrollHeight - element.clientHeight;

        if (maxScroll <= 0) return 0;

        return Math.min(100, (current / maxScroll) * 100);
    }

    const current = scrollTop();
    const maxScroll = documentHeight() - viewportHeight();

    if (maxScroll <= 0) return 0;

    return Math.min(100, (current / maxScroll) * 100);
}

/**
 * Gets the horizontal scroll progress as a percentage (0-100).
 *
 * Complementary to vertical scroll progress, this is essential for horizontal
 * scrolling interfaces, carousels, and timeline components that need precise
 * progress tracking. Provides normalized progress calculation for consistent
 * horizontal scroll-based interactions.
 *
 * When an element is provided, calculates progress within that element's scrollable area.
 * When no element is provided, calculates progress for the entire document.
 *
 * Useful for horizontal progress indicators.
 * @param element - Optional element to calculate horizontal scroll progress within
 * @returns horizontal scroll progress percentage
 *
 * @example
 * const hProgress = horizontalScrollProgress();
 * // Update horizontal progress indicator
 *
 * @example
 * const elementHProgress = horizontalScrollProgress(document.querySelector('.horizontal-scroll'));
 * // Get horizontal progress within specific element
 */
export function horizontalScrollProgress(element?: Element): number {

    if (element) {

        const current = element.scrollLeft;
        const maxScroll = element.scrollWidth - element.clientWidth;

        if (maxScroll <= 0) return 0;

        return Math.min(100, (current / maxScroll) * 100);
    }

    const current = scrollLeft();
    const maxScroll = documentWidth() - viewportWidth();

    if (maxScroll <= 0) return 0;

    return Math.min(100, (current / maxScroll) * 100);
}

/**
 * Checks if the page is scrolled to the bottom.
 *
 * This is fundamental for infinite scroll implementations and content loading systems.
 * Determining "bottom" requires accounting for browser rendering differences, mobile
 * viewport changes, and floating-point precision issues in scroll calculations.
 * A reliable bottom detection prevents content loading issues and ensures smooth
 * infinite scroll experiences across different devices and browsers.
 *
 * Useful for infinite scroll implementations.
 * @param threshold - pixels from bottom to consider "at bottom" (default: 10)
 * @returns true if scrolled to bottom
 *
 * @example
 * if (isAtBottom()) {
 *     // Load more content
 * }
 */
export function isAtBottom(threshold = 10): boolean {

    return scrollTop() + viewportHeight() >= documentHeight() - threshold;
}

/**
 * Checks if the page is scrolled to the top.
 *
 * Essential for UI elements like "scroll to top" buttons, header behavior changes,
 * and navigation state management. Reliable top detection ensures consistent
 * user interface behaviors regardless of browser scroll behavior variations
 * or fractional pixel positioning issues.
 *
 * Useful for "scroll to top" button visibility.
 * @param threshold - pixels from top to consider "at top" (default: 10)
 * @returns true if scrolled to top
 *
 * @example
 * const showTopButton = !isAtTop();
 */
export function isAtTop(threshold = 10): boolean {

    return scrollTop() <= threshold;
}

/**
 * Gets the percentage of an element that is visible in the viewport.
 *
 * This solves the complex challenge of intersection calculations for lazy loading,
 * analytics tracking, and animation triggering. Accurate visibility calculation
 * requires precise geometric calculations that account for element positioning,
 * viewport boundaries, partial overlaps, and edge cases where elements extend
 * beyond viewport boundaries.
 *
 * Useful for lazy loading and visibility-based animations.
 * @param el - element to check
 * @returns percentage visible (0-100)
 *
 * @example
 * const visibility = elementVisibility(myElement);
 * // Fade in element based on visibility
 */
export function elementVisibility(el: HTMLElement): number {

    if (!el) {

        return 0;
    }

    const [rect, err] = attemptSync(() => el.getBoundingClientRect());

    if (err || !rect) {

        return 0;
    }

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
 *
 * This provides a threshold-based visibility check essential for performance
 * optimizations in content loading, animation triggering, and analytics tracking.
 * More flexible than binary visibility checks, allowing fine-tuned control over
 * when elements are considered "visible enough" for various use cases.
 *
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
export function isPartiallyVisible(el: HTMLElement, threshold = 0.1): boolean {

    return elementVisibility(el) >= threshold * 100;
}

/**
 * Gets the distance from an element to the viewport edges.
 *
 * This is critical for smart positioning systems like tooltips, dropdowns, and modals
 * that need to avoid viewport edges. Provides the geometric data needed for intelligent
 * positioning decisions, overflow prevention, and responsive UI component placement
 * that adapts to available space in any direction.
 *
 * Useful for positioning tooltips, modals, or determining scroll direction.
 * @param el - element to measure
 * @returns object with distances to each edge
 *
 * @example
 * const distances = elementViewportDistances(myElement);
 * // Position tooltip based on available space
 */
export function elementViewportDistances(el: HTMLElement): { top: number; bottom: number; left: number; right: number } {

    if (!el) {

        return { top: 0, bottom: 0, left: 0, right: 0 };
    }

    const [rect, err] = attemptSync(() => el.getBoundingClientRect());

    if (err || !rect) {

        return { top: 0, bottom: 0, left: 0, right: 0 };
    }

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
 *
 * This addresses the cross-browser inconsistencies in smooth scrolling implementation.
 * Different browsers handle scroll timing, easing, and offset calculations differently.
 * This function provides consistent scroll-to-element behavior essential for anchor
 * navigation, form validation highlighting, and user-initiated content navigation
 * across all browser environments.
 *
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
): void {

    if (!el) {

        return;
    }

    const targetY = elementOffsetTop(el) - offset;

    window?.scrollTo({
        top: targetY,
        behavior
    });
}

/**
 * Smoothly scrolls to a specific position.
 *
 * This wraps the native scrollTo API to provide consistent behavior across browsers
 * that may handle smooth scrolling differently or not at all. Essential for
 * programmatic scrolling, scroll restoration, and custom navigation implementations
 * that need reliable scrolling behavior regardless of browser support variations.
 *
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
): void {

    window?.scrollTo({
        left: x,
        top: y,
        behavior
    });
}

