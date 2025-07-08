---
permalink: '/packages/dom'
aliases: ["DOM", "@logosdx/dom"]
---

**A lightweight, utility-first DOM manipulation toolkit for contrarians who prefer raw DOM over React or Vue.**

Simple, composable utilities for the 90% of common web use cases—no framework boilerplate required.

Works wherever the DOM is available: modern browsers, SPAs, server-rendered pages, and more.

> 📚 **Complete API Documentation**: [typedoc.logosdx.dev/modules/_logosdx_dom.html](https://typedoc.logosdx.dev/modules/_logosdx_dom.html)


The DOM should be an extension of your programming abilities, and not the thing that is abstracted or hidden by framework X. The idea behind library is to give you a set of utilities for DOM manipulation that saves you time and iteration:

- Instead of `document.querySelectorAll(...)` you can simply call `$(...)`.
- Instead of `elements.forEach(el => el.addEventListener(...))` you can call `html.events.on(elements, ...)`
- and so on...

```bash
npm install @logosdx/dom
yarn add @logosdx/dom
pnpm add @logosdx/dom
```

With jsdeliver:

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/dom@latest/dist/browser/bundle.js"></script>
```

```html
<script>
	const { $, html } = LogosDx.Dom;

    html.behaviors.bind('[copy]', 'Copy', (el) => {

        const copy = new CopyToClipboard(el);
        return () => copy.destroy();
    });
</script>
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

Declarative DOM behavior engine for MPAs and dynamic UIs. Binds handlers to elements based on feature names, prevents double bindings, supports auto-rebinding on DOM changes (via `MutationObserver`), and gives you full manual control when needed.

```typescript
import { $, html, onceReady } from '@logosdx/dom';

// Simple behavior binding
onceReady(() => {

    // Bind copy-to-clipboard behavior
    html.behaviors.bind('[copy]', 'Copy', (el) => {

        const target = html.attrs.get(el, 'copy');

        return html.events.on(el, 'click', () => {

            const [targetEl] = $(target);
            targetEl && copyToClipboard(targetEl.textContent);
        });
    });

    // Auto-bind behaviors as new elements appear
    html.behaviors.observe('modal', '[data-modal]');
    html.behaviors.on('modal', () => {

        return html.behaviors.bind('[data-modal]', 'Modal', (el) => {

            const modal = new Modal(el);
            return () => modal.destroy();
        });
    });
});

// Batch registration with auto-observation
const { cleanup, dispatch } = html.behaviors.create({

    tooltip: {
        els: '[tooltip]',
        handler: el => new Tooltip(el),
        shouldObserve: true // Watch for new tooltip elements
    },

    lazyLoad: {
        els: 'img[data-src]',
        handler: el => {

            const observer = new IntersectionObserver(entries => {

                entries.forEach(entry => {

                    if (entry.isIntersecting) {

                        const img = entry.target as HTMLImageElement;
                        img.src = img.dataset.src!;
                        observer.unobserve(img);
                    }
                });
            });

            observer.observe(el);
            return () => observer.disconnect();
        }
    },

    keyboard: () => {

        return html.events.on(document, 'keydown', (e) => {

            if (e.key === 'Escape') {

                html.events.emit(document.body, 'escape-pressed');
            }
        });
    }
});

// Clean up when done
cleanup();
```

### `html.behaviors.bind(...)`

Bind a handler to one or more elements. Ensures idempotency and tracks unbinders for later cleanup. Automatically filters out hidden and template elements.

```ts
(el: Element | Element[] | string, featureName: string, handler: (el: Element) => void | (() => void)): () => void
```

**Examples:**

```ts
// Bind to elements by selector
const cleanup = html.behaviors.bind('[accordion]', 'Accordion', (el) => {

    const toggle = el.querySelector('.toggle');
    const content = el.querySelector('.content');

    return html.events.on(toggle, 'click', () => {

        content.classList.toggle('open');
    });
});

// Bind to specific elements
const buttons = $('.action-button');
html.behaviors.bind(buttons, 'ActionButton', (el) => {

    const action = html.attrs.get(el, 'data-action');

    return html.events.on(el, 'click', () => {

        performAction(action);
    });
});

// Handler with cleanup
html.behaviors.bind('.video-player', 'VideoPlayer', (el) => {

    const player = new VideoPlayer(el);

    // Return cleanup function
    return () => {

        player.pause();
        player.destroy();
    };
});
```

> **Error Handling Philosophy:** Behavior handlers are always executed in a safe context. If your handler throws an error or returns a failing result, the error is caught and logged, and the behavior is skipped for that element. This ensures that a single faulty handler does not break the initialization of other behaviors or elements.

> **Custom Cleanup Patterns:** When you bind a behavior that attaches event listeners, timers, or other side effects, always return a cleanup function from your handler. This function will be called automatically when the behavior is unbound or the element is removed, ensuring no memory leaks or dangling listeners. If your handler does not need cleanup, you can simply omit the return value.

### `html.behaviors.unbind(...)`

Remove a specific behavior from an element.

```ts
(el: Element, featureName: string): void
```

**Examples:**

```ts
const modal = document.querySelector('.modal');

// Remove just the modal behavior
html.behaviors.unbind(modal, 'Modal');

// Element can still have other behaviors
console.log(html.behaviors.allBound(modal)); // ['Draggable', 'Focusable']
```

### `html.behaviors.unbindAll(...)`

Remove all behaviors from an element. Essential for cleanup when removing elements from DOM.

```ts
(el: Element): void
```

**Examples:**

```ts
// Clean up before removing element
const component = document.querySelector('.complex-component');
html.behaviors.unbindAll(component);
component.remove();

// Clean up in framework lifecycle
class MyComponent {

    onDestroy() {

        html.behaviors.unbindAll(this.element);
    }
}
```

### `html.behaviors.isBound(...)`

Check if a specific feature is already bound to an element.

```ts
(el: Element, featureName: string): boolean
```

**Examples:**

```ts
// Prevent duplicate initialization
function initializeFeature(el: Element) {

    if (!html.behaviors.isBound(el, 'Feature')) {

        html.behaviors.bind(el, 'Feature', handler);
    }
}

// Conditional behavior
$('.item').forEach(el => {

    if (!html.behaviors.isBound(el, 'Draggable')) {

        el.classList.add('draggable-available');
    }
});
```

### `html.behaviors.allBound(...)`

Get all feature names bound to an element.

```ts
(el: Element): string[]
```

**Examples:**

```ts
const features = html.behaviors.allBound(myElement);
// ['Tooltip', 'Draggable', 'Focusable']

// Debug what's bound
function debugElement(el: Element) {

    const bound = html.behaviors.allBound(el);
    console.log(`Element has ${bound.length} behaviors:`, bound);
}
```

### `html.behaviors.on(...)`

Register a lazy behavior for later activation. Listens for `init:${feature}` events.

```ts
(feature: string, init: () => void | (() => void)): () => void
```

**Examples:**

```ts
// Register behavior that initializes on demand
const cleanup = html.behaviors.on('tabs', () => {

    const tabs = $('[role="tablist"]');

    return html.behaviors.bind(tabs, 'Tabs', (el) => {

        const tabManager = new TabManager(el);
        return () => tabManager.destroy();
    });
});

// Trigger initialization later
html.behaviors.dispatch('tabs');

// Chain multiple behaviors
html.behaviors.on('forms', () => {

    // Validation
    html.behaviors.bind('form[validate]', 'Validation', (el) => {

        return new FormValidator(el);
    });

    // Auto-save
    html.behaviors.bind('form[auto-save]', 'AutoSave', (el) => {

        const saver = new AutoSaver(el);
        return () => saver.stop();
    });
});
```

### `html.behaviors.dispatch(...)`

Trigger initialization for one or more features.

```ts
(...features: string[]): void
```

**Examples:**

```ts
// Initialize single feature
html.behaviors.dispatch('modal');

// Initialize multiple features
html.behaviors.dispatch('forms', 'tooltips', 'accordions');

// Conditional initialization
if (document.querySelector('.needs-charts')) {

    html.behaviors.dispatch('charts');
}

// After dynamic content load
fetch('/partial')
    .then(res => res.text())
    .then(html => {

        container.innerHTML = html;
        html.behaviors.dispatch('modal', 'forms');
    });
```

### `html.behaviors.observe(...)`

Watch for new elements and automatically initialize behaviors when they appear.

```ts
(feature: string, selector: string, options?: { root?: Element, debounceMs?: number }): void
```

**Examples:**

```ts
// Basic observation
html.behaviors.observe('tooltip', '[data-tooltip]');

// Observe within specific container
const appRoot = document.getElementById('app');
html.behaviors.observe('modal', '[data-modal]', {
    root: appRoot,
    debounceMs: 100
});

// Dynamic content areas
html.behaviors.observe('gallery', '.gallery-item', {
    root: document.querySelector('.content-area'),
    debounceMs: 50
});

// Combine with on() for complete setup
html.behaviors.on('gallery', () => {

    return html.behaviors.bind('.gallery-item', 'GalleryItem', (el) => {

        const item = new GalleryItem(el);
        return () => item.cleanup();
    });
});

html.behaviors.observe('gallery', '.gallery-item');
```

> **MutationObserver Limitations:** Automatic behavior observation relies on the browser's `MutationObserver` API. If you attempt to use `observe` in a non-browser environment (such as Node.js or server-side rendering), an error will be thrown: `Error: MutationObserver not available in this environment. observePrepare will not work.` Use feature detection or environment checks if you need to support non-browser runtimes.

> **Performance Note:** While automatic observation is powerful, observing very large DOM trees or using extremely low debounce values can impact performance, especially during rapid DOM mutations. For best results, use the narrowest possible root and selector for observation, set a reasonable `debounceMs` (e.g., 50–100ms) to batch rapid changes, and unobserve features when they are no longer needed using `html.behaviors.stop` or `stopAll`. For most apps, the default settings are efficient. If you notice performance issues, review your observation scope and debounce settings.

### `html.behaviors.stop(...)`

Stop observing for new elements matching a selector.

```ts
(feature: string, selector: string, root?: Element): void
```

**Examples:**

```ts
// Stop observing
html.behaviors.stop('modal', '[data-modal]');

// Stop observing in specific root
const container = document.getElementById('dynamic-content');
html.behaviors.stop('tooltip', '[data-tooltip]', container);

// Conditional observation
function toggleFeatureObservation(enabled: boolean) {

    if (enabled) {

        html.behaviors.observe('lazy', '[data-lazy]');
    } else {

        html.behaviors.stop('lazy', '[data-lazy]');
    }
}
```

### `html.behaviors.stopAll(...)`

Stop all mutation observers. Useful for cleanup in tests or when unmounting large UI sections.

```ts
(): void
```

**Examples:**

```ts
// Test cleanup
afterEach(() => {

    html.behaviors.stopAll();
});

// SPA route change
router.on('beforeRouteChange', () => {

    html.behaviors.stopAll();
});

// Full reset
function resetBehaviors() {

    html.behaviors.stopAll();
    document.querySelectorAll('[data-behavior]').forEach(el => {

        html.behaviors.unbindAll(el);
    });
}
```

### `html.behaviors.create(...)`

Batch register multiple behaviors with automatic observation and initialization.

```ts
(registry: Record<string, BehaviorInit>, opts?: { shouldObserve?: boolean, shouldDispatch?: boolean, debounceMs?: number }): { cleanup: () => void, dispatch: () => void }
```

**Examples:**

```ts
// Complete behavior setup
const behaviors = html.behaviors.create({

    // Element-based behavior
    accordion: {
        els: '.accordion',
        handler: (el) => {

            const controller = new AccordionController(el);
            return () => controller.destroy();
        },
        shouldObserve: true // Auto-bind new accordions
    },

    // Global behavior
    shortcuts: () => {

        const shortcuts = new KeyboardShortcuts();
        return () => shortcuts.unbind();
    },

    // Conditional behavior
    analytics: {
        els: '[track-event]',
        handler: (el) => {

            const event = html.attrs.get(el, 'track-event');

            return html.events.on(el, 'click', () => {

                analytics.track(event);
            });
        },
        shouldObserve: true,
        debounceMs: 100
    }
}, {
    shouldDispatch: true, // Initialize immediately
    shouldObserve: true,  // Watch for new elements
    debounceMs: 50        // Default debounce
});

// Manual dispatch if needed
behaviors.dispatch();

// Cleanup everything
behaviors.cleanup();

// Modular feature sets
const coreBehaviors = html.behaviors.create({
    forms: formBehaviors,
    navigation: navBehaviors,
    modals: modalBehaviors
});

const enhancedBehaviors = html.behaviors.create({
    animations: animationBehaviors,
    charts: chartBehaviors
}, {
    shouldDispatch: false // Manual initialization
});

// Initialize enhanced features on demand
if (userPreferences.animations) {

    enhancedBehaviors.dispatch();
}
```

> **Behavior Registry Validation:** When using `html.behaviors.create`, the registry is strictly validated. Invalid entries (such as missing handlers, invalid selectors, or incorrect types) are logged as errors and skipped. This helps catch configuration mistakes early and ensures only valid behaviors are registered. Check your console for validation errors if a behavior does not initialize as expected.

### Debugging

You can enable verbose debug logging for all behavior operations. This will print detailed information about binding, unbinding, observation, and errors to the console, making it easier to trace issues during development.

```ts
html.behaviors.debug(true);
// Console will now show [HtmlBehaviors] logs for all operations
```

To disable, call:

```ts
html.behaviors.debug(false);
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