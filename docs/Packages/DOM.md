---
permalink: '/packages/dom'
aliases: ["DOM", "@logosdx/dom"]
---
The DOM should be an extension of your programming abilities, and not the thing that is abstracted or hidden by framework X. The idea behind library is to give you a set of utilities for DOM manipulation that saves you time and iteration:
- Instead of `document.querySelectorAll(...)` you can simply call `$(...)`.
- Instead of `elements.forEach(el => el.addEventListener(...))` you can call `html.events.on(elements, ...)`
- and so on...

```bash
npm install @logosdx/dom
yarn add @logosdx/dom
pnpm add @logosdx/dom
```

## Browser Support & Error Handling

This package requires a browser-like environment with DOM APIs available. It will throw an error if used in Node.js or other non-browser environments.

```typescript
// ✅ Works in browsers
import { $, html } from '@logosdx/dom';

// ❌ Throws error in Node.js
// Error: Dom is not supported in this environment
```

## Type Exports

The package exports several TypeScript types for better type safety:

```typescript
import type {
    CssPropNames,
    CssProps,
    GlobalEvents,
    EvListener
} from '@logosdx/dom';

// CSS property types
type CssPropNames = Extract<NonFunctionProps<CSSStyleDeclaration>, string>;
type CssProps = { [K in CssPropNames]?: CSSStyleDeclaration[K] };

// Event types
type GlobalEvents = keyof DocumentEventMap;
interface EvListener<E extends EvType> extends EventListener {
    (ev: E extends GlobalEvents ? DocumentEventMap[E] : Event): void;
}
```

## Example

```typescript

import { $, html, appendIn, createElWith } from '@logosdx/dom';

const navs = $('nav');

navs.forEach(nav => {

	if ($('[subnav]', nav).length) {

		const icon = createElWith('i', { class: ['fa', 'fa-chevron-down'] });
		appendIn(nav, icon);

		html.events.on(icon, 'click', () => {

			html.events.emit(nav, 'open');
		});
	}
});

html.events.on(navs, 'open', (e) => {

	e.target.classList.add('open');
});

html.events.on(navs, 'close', (e) => {

	e.target.classList.add('close');
});
```

## Attribute Manipulation

HTML attributes can be powerful tools. You can do things with them that extend beyond the defaults of the browser. For example, turn any div into a copyable code snippet, or have it open a nav bar, or modal.

```typescript
import { $, html, onceReady, copyToClipboard } from '@logosdx/dom';

const makeCopyable = () => {

	$('[copy]').forEach(el => {

		const whatToCopy = html.attrs.get(el, 'copy');
		const [elToCopy] = $(whatToCopy);

		// bind click event
		html.events.on(el, 'click', () => {

			elToCopy && copyToClipboard(elToCopy.outerHTML);
		});

		// don't double bind later
		html.attrs.remove(el, 'copy');
	});
}

onceReady(() => {

	makeCopyable();
});

```


### `html.attrs.get(...)`

Get one or many attributes from one or many elements.

```ts
<T = StringProps>(els: OneOrManyElements, propNames: string | string[]) => string | string[] | T | T[];
```

**Examples:**

```ts
html.attrs.get(form, 'method');
// > 'post'

html.attrs.get([select, input], 'name');
// > ['role', 'full_name']

html.attrs.get(form, ['method', 'action']);
// > { method: 'post', action: '/' }



html.attrs.get([select, input], ['name', 'value']);
// > [{ name: '', value: '' }, { name: '', value: '' }]
```

### `html.attrs.set(...)`

Set one or many attributes on one or many elements.

```ts
(els: OneOrManyElements, props: StringProps): void;
```

**Examples:**

```ts
html.attrs.set(input, { name: 'full_name' });

html.attrs.set([div, div, div], { 'data-show': 'false' });
```



### `html.attrs.remove(...)`

Remove one or many attributes from one or many elements.

```ts
(els: OneOrManyElements, propNames: string | string[]): void;
```

**Examples:**

```ts
html.attrs.remove(form, 'method');
html.attrs.remove([select, input], 'name');
html.attrs.remove(form, ['method', 'action']);
html.attrs.remove([select, input], ['name', 'value']);
```


### `html.attrs.has(...)`

Check if one or many attributes exist on one or many elements.

```ts
(els: OneOrManyElements, propNames: string | string[]): boolean | boolean[] | BoolProps | BoolProps[]
```

**Examples:**

```ts
html.attrs.has(form, 'method');
// > true

html.attrs.has([input, textarea], 'required');
// > [true, false]

html.attrs.has([input, textarea], ['required', 'name']);
// > [{ required: true, name: false }, { required: false, name: false }]
```




## CSS Manipulation

CSS manipulation is sometimes necessary via programmatic means. For example, if you're making some sort of animation, you might want to manipualte the CSS on a series of items. For any case where you might want to do this, this tool is appropriate.

```ts
import { $, html, onceReady } from '@logosdx/dom';

onceReady(() => {

	html.css.set($('[hide]'), { display: 'none' });
});

html.events.on(document.body, 'lock', () => {

	html.css.set(document.body, { overflow: 'hidden' });
});

html.events.on(document.body, 'unlock', () => {

	html.css.set(document.body, { overflow: '' });
});

```

### `html.css.get(...)`

Get one or many css styles from one or many elements. Returns computed styles, not inline styles.

```ts
(els: OneOrManyElements, propNames: string | string[]): string | Partial<CSSStyleDeclaration> | Partial<CSSStyleDeclaration>[]
```

**Examples:**

```ts
html.css.get(div, 'color');
// > 'red'

html.css.get([div, span], 'color');
// > ['red', 'blue']

html.css.get(div, ['color', 'fontSize']);
// > { color: 'red', fontSize: '12px' }

html.css.get([div, span], ['color', 'fontSize']);
// > [{ color: 'red', fontSize: '12px' }, { color: 'blue', fontSize: '10px' }]
```


### `html.css.set(...)`

Set one or many css styles on one or many elements. Applies inline styles directly to elements.

```ts
(els: OneOrManyElements, props: Partial<CSSStyleDeclaration>): void;
```

**Examples:**

```ts
html.css.set([div, span], {
	color: 'blue',
	paddingRight: '10px'
});

html.css.set(div, {
	color: 'blue',
	paddingRight: '10px'
});
```


### `html.css.remove(...)`

Remove CSS properties from elements by setting them to empty string. This effectively resets the properties to their default values.

```ts
(els: OneOrManyElements, propNames: string | string[]): void;
```

**Examples:**

```ts
html.css.remove(div, 'color');

html.css.remove([div, span], 'color');

html.css.remove(div, ['color', 'fontSize']);

html.css.remove([div, span], ['color', 'fontSize']);
```


## Events

The most useful thing on the DOM is the ability to dispatch and hook into events. This is what truly makes your app feel dynamic and reponsive; things' observability are what give websites the ability to become web apps.

```ts
import { $, html, onceReady } from '@logosdx/dom';
import { observer } from './app';

html.events.on(document.body, 'keyup', (e) => {

	observer.emit(e.code, e);

	// or re-emit
	html.events.emit(document.body, e.code, e);
});

html.events.on(document.body, 'Escape', () => {

	closeModal();
	closeAlerts();
	closeMenu();
})

```

### `html.events.on(...)`

Listen for one or many events on one or many elements. Returns a cleanup function to remove all added event listeners.

```ts
<E extends EvType>(targets: TargetsOrWin, events: Events<E>, cb: EvListener<E>, opts?: EvOpts): EventCleanupCb
```

**Examples:**

```ts
html.events.on(div, 'click', () => {});

html.events.on(div, ['focus', 'blur'], () => {});

html.events.on([div, input], ['focus', 'blur'], () => {});

// Returns cleanup function
const cleanup = html.events.on(div, 'click', () => {});
setTimeout(cleanup, 1000); // Remove listener after 1 second
```


### `html.events.once(...)`

Listen for one or many events on one or many elements once. Automatically removes the listener after the first execution.

```ts
<E extends EvType>(targets: TargetsOrWin, event: Events<E>, cb: EvListener<E>, opts?: EvOpts): EventCleanupCb
```

**Examples:**

```ts
html.events.once(div, 'click', () => {});

html.events.once(div, ['focus', 'blur'], () => {});

html.events.once([div, input], ['focus', 'blur'], () => {});

// Returns cleanup function
const cleanup = html.events.once(div, 'click', () => {});
setTimeout(cleanup, 1000); // Remove listener after 1 second
```


### `html.events.off(...)`

Remove listener for one or many events on one or many elements.

```ts
(targets: TargetsOrWin, events: Events, cb: Func, opts?: EventListenerOptions): void
```

**Examples:**

```ts
html.events.off(div, 'click', callback);

html.events.off(div, ['focus', 'blur'], callback);

html.events.off([div, input], ['focus', 'blur'], callback);
```


### `html.events.emit(...)`

Dispatch custom events on DOM elements or window. Creates CustomEvent with optional data if string event name is provided.

```ts
(els: TargetsOrWin, event: EvType | Event, data?: unknown): void
```

**Examples:**

```ts
html.events.emit(div, 'click', { key: 'Esc' })

html.events.emit([div, span], 'click', { key: 'Esc' })

// With existing Event object
html.events.emit(div, existingEvent);
```

## Behaviors

Modern DOM development often requires coordinating behaviors across multiple elements while avoiding double-binding and managing lifecycle properly. The behaviors system provides a framework-less approach to organizing DOM interactions using an event-driven prepare pattern.

**Built with your own utilities** - The behaviors system dogfoods the DOM package's own `html.events.emit` for consistent event handling and returns cleanup functions for proper lifecycle management.

```ts
import { $, html, onceReady } from '@logosdx/dom';

// Register behaviors that respond to prepare:* events
html.behaviors.registerPrepare('copy', () => {

	$('[copy]').forEach(el => {

		// Prevent double-binding
		if (html.behaviors.isBound(el, 'CopyToClipboard')) return;

		// Safely bind behavior with error handling
		html.behaviors.bindBehavior(el, 'CopyToClipboard', (element) => {

			const text = html.attrs.get(element, 'copy');

			html.events.on(element, 'click', () => {

				copyToClipboard(text);
			});
		});
	});
});

// Register multiple behaviors at once
html.behaviors.createBehaviorRegistry({
	copy: () => { /* copy behavior init */ },
	modal: () => { /* modal behavior init */ },
	nav: () => { /* navigation behavior init */ },
});

// Auto-observe for dynamic content - perfect for SPAs
html.behaviors.observePrepare('copy', '[copy]', {
	debounceMs: 100 // Debounce rapid DOM changes
});

// Trigger behavior initialization manually
onceReady(() => {

	html.behaviors.dispatchPrepare('copy', 'modal', 'nav');
});
```

### `html.behaviors.isBound(...)`

Check if an element has already been bound to a specific behavior feature.

```ts
(el: Element, feature: string): boolean
```

**Examples:**

```ts
if (html.behaviors.isBound(button, 'ClickHandler')) {
	return; // Already bound, skip initialization
}

const isSetup = html.behaviors.isBound(modal, 'Modal');
// > true/false
```

### `html.behaviors.markBound(...)`

Mark an element as bound to a specific behavior feature to prevent double-binding.

```ts
(el: Element, feature: string): void
```

**Examples:**

```ts
html.behaviors.markBound(button, 'ClickHandler');

// After binding a complex behavior
html.behaviors.markBound(carousel, 'ImageCarousel');
```

### `html.behaviors.bindBehavior(...)`

Safely bind a behavior to an element with built-in error handling and duplicate prevention.

```ts
(el: Element, feature: string, handler: (el: Element) => void): void
```

**Examples:**

```ts
$('[tooltip]').forEach(el => {

	html.behaviors.bindBehavior(el, 'Tooltip', (element) => {

		new TooltipBehavior(element);
	});
});

// Error handling is built-in - failed bindings are logged but don't crash
html.behaviors.bindBehavior(el, 'ComplexWidget', (element) => {

	throw new Error('Something went wrong'); // Safely caught and logged
});
```

### `html.behaviors.registerPrepare(...)`

Register a behavior initialization function that responds to `prepare:*` events.

```ts
(feature: string, init: () => void): () => void
```

**Examples:**

```ts
const cleanup = html.behaviors.registerPrepare('accordion', () => {

	$('[data-accordion]').forEach(el => {

		html.behaviors.bindBehavior(el, 'Accordion', (element) => {

			new AccordionBehavior(element);
		});
	});
});

// Later, to unregister the behavior
cleanup();

// Grouped behavior setup
const formsCleanup = html.behaviors.registerPrepare('forms', () => {

	html.behaviors.dispatchPrepare('validation', 'autosave', 'formatting');
});
```

### `html.behaviors.dispatchPrepare(...)`

Trigger prepare events for one or more behavior features.

```ts
(...features: string[]): void
```

**Examples:**

```ts
// Initialize single behavior
html.behaviors.dispatchPrepare('copy');

// Initialize multiple behaviors at once
html.behaviors.dispatchPrepare('copy', 'modal', 'nav', 'forms');

// Great for SPA route changes
router.on('page-load', () => {

	html.behaviors.dispatchPrepare('copy', 'modal', 'analytics');
});
```

### `html.behaviors.createBehaviorRegistry(...)`

Register multiple prepare event listeners from an object map - cleaner than multiple `registerPrepare` calls.

```ts
(registry: Record<string, () => void>): () => void
```

**Examples:**

```ts
const cleanupAll = html.behaviors.createBehaviorRegistry({

	copy: () => {
		$('[copy]').forEach(el => /* bind copy behavior */);
	},

	modal: () => {
		$('[data-modal]').forEach(el => /* bind modal behavior */);
	},

	dropdown: () => {
		$('[dropdown]').forEach(el => /* bind dropdown behavior */);
	},

	forms: () => {
		html.behaviors.dispatchPrepare('validation', 'autosave');
	}
});

// Later, to unregister all behaviors at once
cleanupAll();
```

### `html.behaviors.setupLifecycle(...)`

Attach a teardown callback to an element for proper cleanup when the behavior is no longer needed.

```ts
(el: Element, key: string, teardown: () => void): void
```

**Examples:**

```ts
html.behaviors.bindBehavior(modal, 'Modal', (element) => {

	const observer = new ResizeObserver(/* ... */);
	const interval = setInterval(/* ... */, 1000);

	// Setup teardown for cleanup
	html.behaviors.setupLifecycle(element, 'Modal', () => {

		observer.disconnect();
		clearInterval(interval);
	});
});
```

### `html.behaviors.teardownFeature(...)`

Execute the teardown function for a behavior feature on an element. Safely handles cases where no teardown function exists.

```ts
(el: Element, key: string): void
```

**Examples:**

```ts
// Clean up before removing element
html.behaviors.teardownFeature(modal, 'Modal');
modal.remove();

// Cleanup on SPA route change
router.on('route-change', () => {

	$('[data-modal]').forEach(el => {

		html.behaviors.teardownFeature(el, 'Modal');
	});
});
```

### `html.behaviors.queryLive(...)`

Query for elements while ignoring hidden, template, or inert elements - perfect for prepare functions. Filters out elements that are hidden, have data-template attribute, or aria-hidden="true".

```ts
(selector: string, root?: Document | Element): Element[]
```

**Examples:**

```ts
// Only gets visible, active elements
const liveButtons = html.behaviors.queryLive('[data-action]');

// Ignores elements in templates or hidden containers
const activeModals = html.behaviors.queryLive('[data-modal]');
// Won't return: <div data-modal hidden>, <template><div data-modal></template>

// Scoped to container
const scopedElements = html.behaviors.queryLive('[copy]', document.getElementById('content'));
```

### `html.behaviors.observePrepare(...)`

Automatically observe DOM changes and dispatch prepare events when matching elements are added. Uses a shared MutationObserver for optimal performance with many features. Requires MutationObserver support (not available in Node.js environments).

```ts
(feature: string, selector: string, options?: { root?: Element; debounceMs?: number }): void
```

**Examples:**

```ts
// Watch for new copy elements anywhere on the page
html.behaviors.observePrepare('copy', '[copy]');

// Watch for modals with debouncing to prevent thrashing
html.behaviors.observePrepare('modal', '[data-modal]', {
	debounceMs: 100
});

// Scoped observation within a container
html.behaviors.observePrepare('widget', '[data-widget]', {
	root: document.getElementById('dynamic-content'),
	debounceMs: 50
});

// Perfect for SPA dynamic content
// As soon as new [copy] elements are inserted, prepare:copy fires automatically
```

### `html.behaviors.stopObserving(...)`

Stop observing prepare events for a specific feature and selector combination. Automatically disconnects the MutationObserver if no more features are being observed for that root.

```ts
(feature: string, selector: string, root?: Element): void
```

**Examples:**

```ts
// Stop watching for copy elements
html.behaviors.stopObserving('copy', '[copy]');

// Stop scoped observation
html.behaviors.stopObserving('widget', '[data-widget]', widgetContainer);
```

### `html.behaviors.stopAllObserving(...)`

Stop all active DOM mutation observers and clear all observed features. Useful for cleanup when the application is shutting down or when you want to stop all automatic behavior binding.

```ts
(): void
```

**Examples:**

```ts
// Clean shutdown - stop all DOM observation
html.behaviors.stopAllObserving();

// Good for SPA cleanup or testing
window.addEventListener('beforeunload', () => {

	html.behaviors.stopAllObserving();
});
```

## Viewport Utilities

Utilities for working with viewport dimensions, scroll positions, and element positioning. These functions provide cross-browser compatible measurements and calculations.

### `scrollbarWidth(...)`

Returns the width of the browser's scrollbar. Creates a temporary measurement element to calculate the difference between offsetWidth and clientWidth.

```ts
(): number
```

**Examples:**

```ts
const scrollbarWidth = scrollbarWidth();
// Adjust layout calculations to account for scrollbar

// Calculate available width
const availableWidth = window.innerWidth - scrollbarWidth();
```

### `documentHeight(...)`

Gets the total height of the document including overflow content. Returns the maximum value from various height properties to ensure accuracy across browsers.

```ts
(): number
```

**Examples:**

```ts
const docHeight = documentHeight();
// Use for scroll calculations or layout positioning

// Check if page is scrollable
const isScrollable = docHeight > window.innerHeight;
```

### `documentWidth(...)`

Gets the total width of the document including overflow content. Returns the maximum value from various width properties to ensure accuracy across browsers.

```ts
(): number
```

**Examples:**

```ts
const docWidth = documentWidth();
// Use for responsive calculations or layout positioning

// Check if page is horizontally scrollable
const isHScrollable = docWidth > window.innerWidth;
```

### `scrollTop(...)`

Gets the current vertical scroll position of the document. Returns the maximum value from various scroll properties to ensure cross-browser compatibility.

```ts
(): number
```

**Examples:**

```ts
const currentScroll = scrollTop();
// Use for scroll-based animations or positioning

// Check if scrolled to bottom
const isAtBottom = currentScroll + window.innerHeight >= documentHeight();
```

### `scrollLeft(...)`

Gets the current horizontal scroll position of the document. Returns the maximum value from various scroll properties to ensure cross-browser compatibility.

```ts
(): number
```

**Examples:**

```ts
const currentScroll = scrollLeft();
// Use for horizontal scroll calculations

// Check if scrolled to right edge
const isAtRight = currentScroll + window.innerWidth >= documentWidth();
```

### `elementOffsetTop(...)`

Gets the absolute top offset of an element relative to the document. Calculates position by combining current scroll position with element's bounding rect.

```ts
(el: HTMLElement): number
```

**Examples:**

```ts
const topOffset = elementOffsetTop(myElement);
// Use for positioning calculations or scroll-to-element

// Scroll to element
window.scrollTo(0, elementOffsetTop(myElement));
```

### `elementOffsetLeft(...)`

Gets the absolute left offset of an element relative to the document. Calculates position by combining current scroll position with element's bounding rect.

```ts
(el: HTMLElement): number
```

**Examples:**

```ts
const leftOffset = elementOffsetLeft(myElement);
// Use for positioning calculations or horizontal alignment

// Scroll horizontally to element
window.scrollTo(elementOffsetLeft(myElement), 0);
```

### `viewportWidth(...)`

Gets the current viewport width (window inner width). This addresses viewport calculation inconsistencies across browsers and mobile devices. Mobile browsers dynamically hide/show UI elements (address bars, toolbars), causing viewport dimensions to change during scrolling. Different browsers also report viewport dimensions differently. This function provides reliable viewport width calculations essential for responsive breakpoints and layout calculations.

```ts
(): number
```

**Examples:**

```ts
const vw = viewportWidth();
// Use for responsive breakpoint calculations

// Calculate available width accounting for scrollbars
const availableWidth = viewportWidth() - scrollbarWidth();
```

### `viewportHeight(...)`

Gets the current viewport height (window inner height). Accounts for browser UI elements to provide accurate available space.

```ts
(): number
```

**Examples:**

```ts
const vh = viewportHeight();
// Use for responsive layout calculations

// Check if element fits in viewport
const fitsInViewport = elementHeight <= viewportHeight();
```

### `devicePixelRatio(...)`

Gets the device pixel ratio for high-DPI displays. Useful for canvas rendering and image scaling.

```ts
(): number
```

**Examples:**

```ts
const ratio = devicePixelRatio();
// Scale canvas context for crisp rendering

// Adjust canvas size for retina displays
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const dpr = devicePixelRatio();
canvas.width = width * dpr;
canvas.height = height * dpr;
ctx.scale(dpr, dpr);
```

### `scrollProgress(...)`

Gets the vertical scroll progress as a percentage (0-100). Useful for progress indicators and scroll-based animations.

```ts
(): number
```

**Examples:**

```ts
const progress = scrollProgress();
// Update progress bar: progressBar.style.width = `${progress}%`

// Create scroll progress indicator
const progressBar = document.querySelector('.scroll-progress');
window.addEventListener('scroll', () => {
    progressBar.style.width = `${scrollProgress()}%`;
});
```

### `horizontalScrollProgress(...)`

Gets the horizontal scroll progress as a percentage (0-100). Useful for horizontal progress indicators.

```ts
(): number
```

**Examples:**

```ts
const hProgress = horizontalScrollProgress();
// Update horizontal progress indicator

// Track horizontal scroll progress
const horizontalBar = document.querySelector('.horizontal-progress');
window.addEventListener('scroll', () => {
    horizontalBar.style.width = `${horizontalScrollProgress()}%`;
});
```

### `isAtBottom(...)`

Checks if the page is scrolled to the bottom. Useful for infinite scroll implementations.

```ts
(threshold?: number): boolean
```

**Examples:**

```ts
if (isAtBottom()) {
    // Load more content
}

// Infinite scroll with threshold
if (isAtBottom(50)) {
    loadMorePosts();
}
```

### `isAtTop(...)`

Checks if the page is scrolled to the top. Useful for "scroll to top" button visibility.

```ts
(threshold?: number): boolean
```

**Examples:**

```ts
const showTopButton = !isAtTop();

// Show/hide scroll-to-top button
const topButton = document.querySelector('.scroll-to-top');
window.addEventListener('scroll', () => {
    topButton.style.display = isAtTop() ? 'none' : 'block';
});
```

### `elementVisibility(...)`

Gets the percentage of an element that is visible in the viewport. Useful for lazy loading and visibility-based animations.

```ts
(el: HTMLElement): number
```

**Examples:**

```ts
const visibility = elementVisibility(myElement);
// Fade in element based on visibility

// Lazy loading based on visibility
const images = document.querySelectorAll('img[data-src]');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const visibility = elementVisibility(entry.target as HTMLElement);
        if (visibility > 50) {
            // Load image when 50% visible
            const img = entry.target as HTMLImageElement;
            img.src = img.dataset.src;
            observer.unobserve(img);
        }
    });
});
```

### `isPartiallyVisible(...)`

Checks if an element is partially visible in the viewport. More flexible than full visibility checks.

```ts
(el: HTMLElement, threshold?: number): boolean
```

**Examples:**

```ts
if (isPartiallyVisible(myElement, 0.5)) {
    // Element is at least 50% visible
}

// Trigger animations when partially visible
const animatedElements = document.querySelectorAll('.animate-on-scroll');
window.addEventListener('scroll', () => {
    animatedElements.forEach(el => {
        if (isPartiallyVisible(el as HTMLElement, 0.3)) {
            el.classList.add('animated');
        }
    });
});
```

### `elementViewportDistances(...)`

Gets the distance from an element to the viewport edges. Useful for positioning tooltips, modals, or determining scroll direction.

```ts
(el: HTMLElement): { top: number; bottom: number; left: number; right: number }
```

**Examples:**

```ts
const distances = elementViewportDistances(myElement);
// Position tooltip based on available space

// Smart tooltip positioning
function positionTooltip(element: HTMLElement, tooltip: HTMLElement) {
    const distances = elementViewportDistances(element);

    if (distances.bottom < 100) {
        // Position above if not enough space below
        tooltip.style.bottom = '100%';
        tooltip.style.top = 'auto';
    } else {
        // Position below
        tooltip.style.top = '100%';
        tooltip.style.bottom = 'auto';
    }
}
```

### `scrollToElement(...)`

Smoothly scrolls to an element with optional offset. Provides consistent scroll behavior across browsers.

```ts
(el: HTMLElement, offset?: number, behavior?: ScrollBehavior): void
```

**Examples:**

```ts
scrollToElement(myElement, 20);
// Scrolls to element with 20px offset from top

// Smooth scroll to section
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            scrollToElement(target as HTMLElement, 80, 'smooth');
        }
    });
});
```

### `scrollToPosition(...)`

Smoothly scrolls to a specific position. Wrapper around window.scrollTo with consistent behavior.

```ts
(x: number, y: number, behavior?: ScrollBehavior): void
```

**Examples:**

```ts
scrollToPosition(0, 500);
// Scrolls to 500px from top

// Scroll to top button
document.querySelector('.scroll-to-top').addEventListener('click', () => {
    scrollToPosition(0, 0, 'smooth');
});

// Scroll to specific coordinates
function scrollToCoordinates(x: number, y: number) {
    scrollToPosition(x, y, 'smooth');
}
```

## Utilities

Beyond the basic element manipulation, there's always something quirky to be done on the DOM. Provided are utilities to make the life of the day-to-day DOM dev easier.

### `appendIn(...)`

Add HTML elements inside of a parent element. Uses a while loop to efficiently append multiple children.

```ts
(parent: Element, ...children: (Element | Node)[]): void
```

**Example:**

```ts
import { $, html, appendIn, createElWith } from '@logosdx/dom';

const [nav] = $('nav#main');

const makeLink = (id: string, l: { link: string, text: string }) => {

	const { link: href, text } = l;

	const el = createElWith('a', {
		text,
		attrs: { id, href }
	});

	return el;
}

const links = {

	about: { link: '/about', text: 'About' },
	service: { link: '/service', text: 'Service' },
	login: { link: '/login', text: 'Login' },
	logout: { link: '/logout', text: 'Logout' },
	account: { link: '/account', text: 'Account' },
}

const links = Object.entries(links).map(
	e => makeLink(e[0], e[1])
);

appendIn(nav, ...links);
```

### `appendAfter(...)`

Add HTML elements after a particular element. Elements are inserted sequentially, with each new element becoming the new target.

```ts
(target: Element, ...elements: Element[]): void
```

**Example:**

```ts
import { $, html, appendAfter } from '@logosdx/dom';
import { observer } from './app'

// ...

observer.on('login', () => {

	const serviceLink = $('a#service', nav);

	appendAfter(
		serviceLink,
		makeLink('account', links['account']),
		makeLink('logout', links['logout']),
	);

	$('a#login').forEach(e => e.remove())
});
```


### `appendBefore(...)`

Add HTML elements before a particular element. Elements are inserted sequentially, with each new element becoming the new target.

```ts
(target: Element, ...elements: Element[]): void
```

**Example:**

```ts
import { $, html, appendBefore } from '@logosdx/dom';
import { observer } from './app'

// ...

observer.on('logout', () => {

	const logoutLink = $('a#logout', nav);

	appendBefore(
		logoutLink,
		makeLink('login', links['login']),
	);

	$('a#logout, a#account').forEach(e => e.remove())
});
```

### `createEl(...)`

Shortcut around `document.createElement`. It does the exact same thing.

```ts
(...args: Parameters<Document['createElement']>): ReturnType<Document['createElement']>
```

**Examples:**

```ts
const div = createEl('div');
const input = createEl('input', { type: 'text' });
```

### `createElWith(...)`

An elaborated version of `createEl(...)` with more configurability. Create an HTML element and attach attributes, css, events, classes. Attaches `cleanup()` function for later detaching event listeners.

```ts
type CreateElWithOpts<CustomHtmlEvents> = {
	text?: string,
    children?: (string | HTMLElement)[],
    class?: string[],
    attrs?: Record<string, string>,
    domEvents?: { [E in keyof GlobalEventHandlersEventMap]?: EvListener<E> },
    customEvents?: CustomHtmlEvents,
    css?: Partial<CSSStyleDeclaration>
};

<CustomHtmlEvents extends Record<string, (e: Event) => any>, N extends Parameters<Document['createElement']>[0]>(name: N, opts: CreateElWithOpts<CustomHtmlEvents> = {}): HTMLElement & { cleanup: () => void }
```

**Example:**

```ts
import { createElWith } from '@logosdx/dom';

const myForm = createElWith('form', {
	text: 'inner text',
    attrs: {
        method: 'post',
        action: '/login'
    },
    css: {
        background: 'red',
    },
    class: ['form'],
    domEvents: {
        reset: (e) => {},
        submit: (e) => {}
    },
    customEvents: {
        bounce: (e) => {}
    }
});

// unbind events
myForm.cleanup();
```


### `cloneAndSubmitForm(...)`

Allows the changing and submitting of HTML forms dynamically. This util does the following:
- Deep clones an HTML form
- Allows you to manipulate it
- Appends it to the DOM
- Submits it as standard HTML form
- Removes the clone after submission

```ts
type ChangeCallback<F> = (form: F) => MaybePromise<void>;

<F extends HTMLFormElement>(form: F, changeCb: ChangeCallback<F>): void
```

**Example:**

```ts
import { $, html, appendIn, createElWith, cloneAndSubmitForm } from '@logosdx/dom';
import { observer } from './app'

// ...

const [loginForm] = $('form#login');

cloneAndSubmitForm(loginForm, async (newForm) => {

	const value = await getNonce();
	const nonceInput = createElWith('input', {
		attrs: {
			value,
			type: 'hidden',
			name: 'nonce'
		}
	})

	appendIn(newForm, nonceInput);
});
```


### `onceReady(...)`

Runs function after `DOMContentLoaded` event is triggered by `window`

```ts
(fn: Func): void
```

**Examples:**

```ts
onceReady(() => {
    // DOM is fully loaded and ready
    initializeApp();
});
```


### `copyToClipboard(...)`

Copies the passed text to clipboard using the Clipboard API.

```ts
(text: string): void
```

**Examples:**

```ts
copyToClipboard('Hello World');
// Text is now in the user's clipboard
```


### `isInViewport(...)`

Checks if an element is fully visible within the viewport.

```ts
(element: HTMLElement, refHeight?: number, refWidth?: number): boolean
```

**Examples:**

```ts
if (isInViewport(myElement)) {
    // Element is fully visible
}

// Check against custom viewport
const isVisible = isInViewport(element, 800, 600);
```


### `isScrolledIntoView(...)`

Checks if an element is scrolled into view within a container.

```ts
(el: HTMLElement, inRelationTo?: HTMLElement | Window): boolean
```

**Examples:**

```ts
if (isScrolledIntoView(myElement, container)) {
    // Element is visible within the container
}

// Check against window
const isVisible = isScrolledIntoView(element);
```


### `swapClasses(...)`

Swaps two CSS classes on an element. If the element has the first class, it's replaced with the second, and vice versa.

```ts
(el: HTMLElement, one: string, two: string): void
```

**Examples:**

```ts
swapClasses(button, 'active', 'inactive');
// If button has 'active' class, it becomes 'inactive'
// If button has 'inactive' class, it becomes 'active'
```


### `$(...)`

Wraps `querySelectorAll` and converts a NodeList into an array. It will always return an array, even if no elements are found.

```ts
<R extends Element = HTMLElement>(selector: string, ctx?: Element): R[]
```

**Examples:**

```ts
const buttons = $('button');
const inputs = $('input[type="text"]', form);
const items = $('.item', container);
```


### `html`

Main HTML utilities object providing access to CSS, attributes, events, and behaviors. Contains all the DOM manipulation utilities organized by category.

**Examples:**

```ts
// CSS manipulation
html.css.set(element, { color: 'red', fontSize: '16px' });

// Attribute manipulation
html.attrs.set(element, { 'data-id': '123', class: 'active' });

// Event handling
const cleanup = html.events.on(element, 'click', handleClick);

// Behavior management
html.behaviors.bindBehavior(element, 'MyFeature', handler);
```