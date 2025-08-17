---
title: DOM
description: For those who like to raw-dawg the DOM
---

# DOM

Not every site needs React. `@logosdx/dom` is for developers building simple sites with minimal JavaScript - landing pages, marketing sites, enhanced static content. Work directly with the DOM using clean APIs for selection, styling, events, and attributes. The behavior system lets you attach JavaScript to HTML declaratively. Everything returns cleanup functions so you never leak memory. Cross-browser utilities that just work. It's vanilla JavaScript with the rough edges smoothed out - perfect for when you want to keep things simple.

[[toc]]

## Installation

::: code-group

```bash [npm]
npm install @logosdx/dom
```

```bash [yarn]
yarn add @logosdx/dom
```

```bash [pnpm]
pnpm add @logosdx/dom
```

:::

**CDN:**

```html
<script src="https://cdn.jsdelivr.net/npm/@logosdx/dom@latest/dist/browser.min.js"></script>
<script>
  const { $, html } = LogosDx.Dom;
</script>
```

## Quick Start

```typescript
import { $ } from '@logosdx/dom'

// Select elements (always returns arrays)
const buttons = $<HTMLButtonElement>('button');

// Manipulate styles
buttons.forEach(btn => {
    btn.style.backgroundColor = 'blue';
    btn.addEventListener('click', () => console.log('Clicked!'));
});
```

## Core Concepts

The `$` function returns arrays of elements (never null or NodeList), and all functionality is organized into namespaced modules (`html.css`, `html.events`, etc.) for clean imports and consistent APIs.

## Exports

```typescript
import { $, html, css, attrs, events, behaviors } from '@logosdx/dom';
```

- `$` - Element selection function
- `html` - Namespace containing all modules (`html.css`, `html.attrs`, etc.)
- `css`, `attrs`, `events`, `behaviors` - Direct module imports

## Element Selection

### **$**

The foundation of everything. Wraps `querySelectorAll` but returns proper arrays.

```typescript
function $<R extends Element = HTMLElement>(
    selector: string,
    ctx?: Element
): R[]
```

**Parameters:**

- `selector` - CSS selector string
- `ctx` - Optional context element to search within

**Returns:** Array of elements (empty array if no matches)

**Examples:**

```typescript
// Basic selection
const buttons = $<HTMLButtonElement>('button');
const modals = $<HTMLDialogElement>('#modal');

// Context-aware selection
const form = $('form')[0];
const inputs = $<HTMLInputElement>('input', form);

// Always returns arrays, even for single elements
const singleElement = $('#unique-id'); // HTMLElement[], not HTMLElement
```

**Note:** Always returns arrays, never null or NodeList. Use type assertions for better type inference.

## CSS Module

Style manipulation that understands the difference between computed and inline styles.

### **html.css.get**

Get computed styles from elements. Supports single/multiple elements and properties.

```typescript
// Single element, single property
html.css.get<T extends HTMLElement, P extends CssPropNames>(el: T, prop: P): CssProps[P]

// Multiple elements, single property
html.css.get<T extends HTMLElement, P extends CssPropNames>(el: T[], prop: P): CssProps[P][]

// Single element, multiple properties
html.css.get<T extends HTMLElement, P extends CssPropNames>(el: T, props: P[]): { [K in P]: CssProps[K] }

// Multiple elements, multiple properties
html.css.get<T extends HTMLElement, P extends CssPropNames>(el: T[], props: P[]): { [K in P]: CssProps[K] }[]
```

**Examples:**

```typescript
// Get single property from single element
const color = html.css.get(div, 'color'); // string

// Get single property from multiple elements
const colors = html.css.get([div, span], 'color'); // string[]

// Get multiple properties from single element
const styles = html.css.get(div, ['color', 'fontSize']);
// { color: string, fontSize: string }

// Get multiple properties from multiple elements
const allStyles = html.css.get([div, span], ['color', 'fontSize']);
// [{ color: string, fontSize: string }, ...]
```

**Note:** Returns computed styles, not inline styles. If CSS overrides your inline styles, the computed value is returned.

### **html.css.set**

Set inline styles on elements. Handles vendor prefixes and property name normalization.

```typescript
html.css.set<T extends OneOrMany<HTMLElement>>(
    els: T,
    props: { [K in CssPropNames]?: CssProps[K] | null }
): void
```

**Parameters:**

- `els` - Single element or array of elements
- `props` - Object with CSS properties and values

**Examples:**

```typescript
// Single element
html.css.set(div, { color: 'red', fontSize: '16px' });

// Multiple elements
html.css.set([div, span], {
    opacity: '0.5',
    transition: 'all 0.3s ease'
});

// CSS property names are normalized automatically
html.css.set(div, {
    'font-size': '14px',      // Becomes fontSize
    'background-color': 'blue' // Becomes backgroundColor
});

// Set to null to remove property
html.css.set(div, { color: null });
```

### **html.css.remove**

Remove CSS properties by setting them to empty string.

```typescript
html.css.remove<T extends HTMLElement>(
    els: OneOrMany<T>,
    propNames: OneOrMany<CssPropNames>
): void
```

**Examples:**

```typescript
// Remove single property
html.css.remove(div, 'color');

// Remove multiple properties
html.css.remove([div, span], ['color', 'fontSize']);
```

## Attributes Module

HTML attribute management that knows the difference between attributes and properties.

### **html.attrs.get**

Get HTML attributes from elements.

```typescript
// Single element, single attribute
html.attrs.get<T extends string>(el: HTMLElement, attr: T): string | null

// Multiple elements, single attribute
html.attrs.get<T extends string>(el: HTMLElement[], attr: T): (string | null)[]

// Single element, multiple attributes
html.attrs.get<T extends string>(el: HTMLElement, attr: T[]): Record<T, string | null>

// Multiple elements, multiple attributes
html.attrs.get<T extends string>(el: HTMLElement[], attr: T[]): Record<T, string | null>[]
```

**Examples:**

```typescript
// Get single attribute
const method = html.attrs.get(form, 'method'); // string | null

// Get from multiple elements
const names = html.attrs.get([input1, input2], 'name'); // (string | null)[]

// Get multiple attributes
const attrs = html.attrs.get(form, ['method', 'action']);
// { method: string | null, action: string | null }
```

### **html.attrs.has**

Check if HTML attributes exist on elements.

```typescript
// Single element, single attribute
html.attrs.has(el: HTMLElement, attr: string): boolean

// Multiple elements, single attribute
html.attrs.has(el: HTMLElement[], attr: string): boolean[]

// Single element, multiple attributes
html.attrs.has<T extends string>(el: HTMLElement, attr: string[]): Record<T, boolean>

// Multiple elements, multiple attributes
html.attrs.has<T extends string>(el: HTMLElement[], attr: string[]): Record<T, boolean>[]
```

**Examples:**

```typescript
// Check single attribute
const hasRequired = html.attrs.has(input, 'required'); // boolean

// Check on multiple elements
const requiredStates = html.attrs.has([input1, input2], 'required'); // boolean[]

// Check multiple attributes
const hasAttrs = html.attrs.has(input, ['required', 'disabled']);
// { required: boolean, disabled: boolean }
```

### **html.attrs.set**

Set HTML attributes on elements.

```typescript
html.attrs.set(els: OneOrMany<HTMLElement>, props: StringProps): void
```

**Examples:**

```typescript
// Single element
html.attrs.set(input, { name: 'username', required: 'true' });

// Multiple elements
html.attrs.set([input1, input2], { 'data-validated': 'false' });

// Data attributes
html.attrs.set(element, { 'data-component': 'modal', 'data-state': 'open' });
```

**Note:** All attribute values must be strings in HTML.

### **html.attrs.remove**

Remove HTML attributes from elements.

```typescript
html.attrs.remove(els: OneOrMany<HTMLElement>, attrs: OneOrMany<string>): void
```

**Examples:**

```typescript
// Remove single attribute
html.attrs.remove(input, 'disabled');

// Remove multiple attributes
html.attrs.remove([input1, input2], ['required', 'disabled']);
```

## Events Module

Event handling with automatic cleanup and multi-target support.

### **html.events.on**

Add event listeners with cleanup functions.

```typescript
html.events.on<E extends EvType>(
    targets: TargetsOrWin,
    events: Events<E>,
    cb: EvListener<E>,
    opts?: AddEventListenerOptions
): () => void
```

**Parameters:**
- `targets` - Single element, array of elements, or window
- `events` - Single event name or array of event names
- `cb` - Event handler function
- `opts` - Standard `AddEventListenerOptions`

**Returns:** Cleanup function

**Examples:**

```typescript
// Single element, single event
const cleanup = html.events.on(button, 'click', handleClick);

// Multiple elements, single event
const cleanup = html.events.on([btn1, btn2], 'click', handleClick);

// Single element, multiple events
const cleanup = html.events.on(input, ['focus', 'blur'], handleFocus);

// Multiple elements, multiple events
const cleanup = html.events.on([input1, input2], ['focus', 'blur'], handleFocus);

// With options
const cleanup = html.events.on(button, 'click', handleClick, { passive: true });

// Always clean up when done
cleanup();
```

### **html.events.once**

Add event listeners that fire once and remove themselves.

```typescript
html.events.once<E extends EvType>(
    targets: TargetsOrWin,
    event: Events<E>,
    cb: EvListener<E>,
    opts?: AddEventListenerOptions
): () => void
```

**Examples:**

```typescript
const cleanup = html.events.once(button, 'click', handleClick);
// Listener removes itself after first click
// cleanup() still works if you need to cancel early
```

### **html.events.off**

Remove specific event listeners.

```typescript
html.events.off(
    targets: TargetsOrWin,
    events: Events,
    cb: Func,
    opts?: EventListenerOptions
): void
```

**Examples:**

```typescript
html.events.off(button, 'click', handleClick);
html.events.off([btn1, btn2], ['focus', 'blur'], handleFocus);
```

**Note:** Using cleanup functions is more convenient than `off()`.

### **html.events.emit**

Dispatch custom events with optional data.

```typescript
html.events.emit(els: TargetsOrWin, event: EvType | Event, data?: unknown): void
```

**Examples:**

```typescript
// Simple custom event
html.events.emit(document.body, 'app:ready');

// Custom event with data
html.events.emit(modal, 'modal:open', { modalId: 'settings' });

// Listen for custom events
html.events.on(document.body, 'app:ready', () => {
    console.log('App is ready!');
});

html.events.on(modal, 'modal:open', (e: CustomEvent) => {
    console.log('Modal opened:', e.detail.modalId);
});
```

## Behaviors Module

Component lifecycle management with automatic observation and cleanup.

### **html.behaviors.bind**

Bind a handler to elements matching a selector.

```typescript
html.behaviors.bind<T extends Element>(
    el: T | T[] | string,
    featureName: string,
    handler: BehaviorHandler
): (() => void) | undefined
```

**Parameters:**
- `el` - Element(s) or CSS selector
- `featureName` - Unique name for this behavior
- `handler` - Function that initializes the behavior

**Returns:** Cleanup function

**Examples:**

```typescript
// Basic binding
const cleanup = html.behaviors.bind('.accordion', 'Accordion', (el) => {
    const toggle = el.querySelector('.toggle') as HTMLElement;
    const content = el.querySelector('.content') as HTMLElement;

    return html.events.on(toggle, 'click', () => {
        content.classList.toggle('open');
    });
});

// Complex behavior with state
html.behaviors.bind('[data-video]', 'VideoPlayer', (el) => {
    const player = new VideoPlayer(el, {
        autoplay: false,
        controls: true
    });

    // Return cleanup function
    return () => {
        player.pause();
        player.destroy();
    };
});
```

**Note:** Each element/feature combination can only be bound once (idempotent).

### **html.behaviors.observe**

Automatically bind behaviors to new DOM elements using MutationObserver.

```typescript
html.behaviors.observe<T extends Element>(
    feature: string,
    selector: string,
    options?: { root?: T; debounceMs?: number }
): void
```

**Examples:**

```typescript
// Basic observation
html.behaviors.observe('tooltip', '[data-tooltip]');

// With options
html.behaviors.observe('modal', '[data-modal]', {
    root: document.getElementById('app'), // Limit scope
    debounceMs: 100 // Batch DOM changes
});

// Must register the behavior handler separately
html.behaviors.on('tooltip', () => {
    return html.behaviors.bind('[data-tooltip]', 'Tooltip', (el) => {
        const tooltip = new Tooltip(el);
        return () => tooltip.destroy();
    });
});
```

### **html.behaviors.create**

Batch register multiple behaviors with automatic initialization.

```typescript
html.behaviors.create(
    registry: Record<string, BehaviorInit>,
    opts?: {
        shouldObserve?: boolean
        shouldDispatch?: boolean
        debounceMs?: number
    }
): { cleanup: () => void; dispatch: () => void }
```

**Parameters:**
- `registry` - Object mapping behavior names to configurations
- `opts` - Global options for all behaviors

**Returns:** Object with cleanup and dispatch functions

**Examples:**

```typescript
const { cleanup, dispatch } = html.behaviors.create({
    // Element-based behavior
    accordion: {
        els: '.accordion',
        handler: (el) => new AccordionController(el),
        shouldObserve: true
    },

    // Global behavior (no elements)
    keyboard: () => html.events.on(document, 'keydown', handleGlobalShortcuts),

    // With custom options
    analytics: {
        els: '[data-track]',
        handler: (el) => new AnalyticsTracker(el),
        shouldObserve: true,
        debounceMs: 50
    }
}, {
    shouldDispatch: true,  // Initialize immediately
    shouldObserve: true,   // Enable observation by default
    debounceMs: 100       // Default debounce
});

// Initialize all behaviors
dispatch();

// Clean up everything
cleanup();
```

### Behavior State Management

```typescript
// Check if behavior is bound
html.behaviors.isBound<T extends Element>(el: T, feature: string): boolean

// Get all bound behaviors
html.behaviors.allBound(el: Element): string[]

// Remove specific behavior
html.behaviors.unbind(el: Element, featureName: string): void

// Remove all behaviors from element
html.behaviors.unbindAll(el: Element): void
```

**Examples:**

```typescript
// Check before binding
if (!html.behaviors.isBound(element, 'MyBehavior')) {
    html.behaviors.bind(element, 'MyBehavior', handler);
}

// Debug what's bound to an element
const behaviors = html.behaviors.allBound(element);
console.log('Element has behaviors:', behaviors);

// Cleanup specific behavior
html.behaviors.unbind(element, 'MyBehavior');

// Cleanup all behaviors (useful for component unmounting)
html.behaviors.unbindAll(element);
```

### Event-Driven Initialization

```typescript
// Register lazy behavior
html.behaviors.on(feature: string, init: BehaviorCb): () => void

// Trigger behavior initialization
html.behaviors.dispatch(...features: string[]): void
```

**Examples:**

```typescript
// Register behavior without immediate initialization
const cleanup = html.behaviors.on('charts', () => {
    return html.behaviors.bind('.chart', 'Chart', (el) => {
        const chart = new Chart(el);
        return () => chart.destroy();
    });
});

// Initialize later (e.g., when user navigates to charts page)
html.behaviors.dispatch('charts');

// Or initialize multiple behaviors
html.behaviors.dispatch('charts', 'maps', 'analytics');
```

### Debugging

```typescript
// Enable detailed logging
html.behaviors.debug(on: boolean): void

// Stop all observations
html.behaviors.stopAll(): void
```

**Examples:**

```typescript
// Debug mode shows all behavior operations
html.behaviors.debug(true);
// Console will show: [HtmlBehaviors] bind: MyBehavior -> Element

// Stop all MutationObservers
html.behaviors.stopAll();
```

## Viewport Utilities

Cross-browser viewport calculations and scroll management.

### Document Measurements

```typescript
// Get scrollbar width (varies by OS/browser)
scrollbarWidth(): number

// Total document dimensions
documentHeight(): number
documentWidth(): number

// Current viewport dimensions
viewportWidth(): number
viewportHeight(): number

// Device pixel ratio for high-DPI displays
devicePixelRatio(): number
```

### Scroll Position & Progress

```typescript
// Current scroll positions
scrollTop(): number
scrollLeft(): number

// Scroll progress as percentage (0-100)
scrollProgress(element?: Element): number
horizontalScrollProgress(element?: Element): number

// Scroll position detection
isAtTop(threshold?: number): boolean
isAtBottom(threshold?: number): boolean
```

### Element Positioning

```typescript
// Absolute position relative to document
elementOffsetTop<T extends Element>(el: T): number
elementOffsetLeft<T extends Element>(el: T): number

// Visibility calculations
elementVisibility<T extends Element>(el: T): number // 0-100 percentage
isPartiallyVisible<T extends Element>(el: T, threshold?: number): boolean

// Distance from element to viewport edges
elementViewportDistances<T extends Element>(el: T): {
    top: number
    bottom: number
    left: number
    right: number
}
```

### Smooth Scrolling

```typescript
// Scroll to element with options
scrollToElement<T extends Element, S extends Element>(
    el: T,
    opts?: {
        offset?: number
        behavior?: ScrollBehavior
        scrollElement?: S
    }
): void

// Scroll to coordinates
scrollToPosition(
    x: number,
    y: number,
    opts?: {
        behavior?: ScrollBehavior
        scrollElement?: HTMLElement
    }
): void
```

**Examples:**

```typescript
// Basic scroll to element
scrollToElement(targetElement);

// With offset (useful for fixed headers)
scrollToElement(targetElement, { offset: 80, behavior: 'smooth' });

// Scroll to specific position
scrollToPosition(0, 500, { behavior: 'smooth' });

// Check scroll progress
const progress = scrollProgress();
if (progress > 80) {
    // Show "back to top" button
}
```

## DOM Utilities

Miscellaneous utilities for element creation and manipulation.

### Element Creation

```typescript
// Simple createElement wrapper
createEl: Document['createElement']

// Full-featured element creation
createElWith<CustomHtmlEvents extends Record<string, (e: Event) => any>, N extends Parameters<Document["createElement"]>[0]>(
    name: N,
    opts?: CreateElWithOpts<CustomHtmlEvents>
): (HTMLElement & { cleanup: () => any })
```

**CreateElWithOpts:**

```typescript
type CreateElWithOpts<CustomHtmlEvents> = {
    text?: string
    children?: (string | HTMLElement)[]
    class?: string[]
    attrs?: Record<string, string>
    domEvents?: { [E in keyof GlobalEventHandlersEventMap]?: EvListener<E> }
    customEvents?: CustomHtmlEvents
    css?: Partial<CSSStyleDeclaration>
}
```

**Examples:**

```typescript
// Simple creation
const div = createEl('div');
const input = createEl('input');

// Full-featured creation
const form = createElWith('form', {
    attrs: { method: 'post', action: '/submit' },
    css: { padding: '1rem', border: '1px solid #ccc' },
    class: ['form', 'enhanced'],
    domEvents: {
        submit: (e) => e.preventDefault(),
        reset: (e) => console.log('Form reset')
    },
    customEvents: {
        validate: (e) => console.log('Validation:', e.detail)
    },
    children: [
        createEl('input'),
        createEl('button')
    ]
});

// Clean up event listeners when done
form.cleanup();
```

### DOM Manipulation

```typescript
// Add children to parent
appendIn(parent: Element, ...children: (Element | Node)[]): void

// Insert after target
appendAfter(target: Element, ...elements: Element[]): void

// Insert before target
appendBefore(target: Element, ...elements: Element[]): void
```

### Utility Functions

```typescript
// Copy text to clipboard
copyToClipboard(text: string): void

// Wait for DOM ready
onceReady(fn: Func): void

// Form operations
cloneAndSubmitForm<T extends HTMLFormElement>(
    form: T,
    changeCb: (form: T) => MaybePromise<void>
): void

// Class manipulation
swapClasses(el: HTMLElement, one: string, two: string): void

// Visibility checks
isInViewport(element: HTMLElement, refHeight?: number, refWidth?: number): boolean
isScrolledIntoView(el: HTMLElement, inRelationTo?: HTMLElement | Window): boolean
```

**Examples:**

```typescript
// Add multiple children
appendIn(container, element1, element2, element3);

// Copy to clipboard
copyToClipboard('Text to copy');

// Wait for DOM ready
onceReady(() => {
    // DOM is fully loaded and parsed
    initializeApp();
});

// Clone and modify form before submission
cloneAndSubmitForm(originalForm, (clonedForm) => {
    const token = createEl('input');
    token.type = 'hidden';
    token.name = 'csrf_token';
    token.value = getCSRFToken();
    clonedForm.appendChild(token);
});
```

## Type Exports

```typescript
import type {
    CssPropNames,
    CssProps,
    GlobalEvents,
    EvListener,
    BehaviorHandler,
    BehaviorInit,
    OneOrMany,
    StringProps
} from '@logosdx/dom';
```

### Key Types

```typescript
// CSS types
type CssPropNames = Extract<NonFunctionProps<CSSStyleDeclaration>, string>
type CssProps = { [K in CssPropNames]?: CSSStyleDeclaration[K] }

// Event types
type GlobalEvents = keyof DocumentEventMap
type EvType = GlobalEvents | string
type EvListener<E extends EvType> = (ev: E extends GlobalEvents ? DocumentEventMap[E] : Event) => void

// Behavior types
type BehaviorHandler = (el: Element) => Unbind | void
type Unbind = () => void
type BehaviorInit = BehaviorCb | {
    els: string | Element | Element[]
    handler: BehaviorHandler
    shouldObserve?: boolean
    shouldDispatch?: boolean
    debounceMs?: number
}

// Utility types
type OneOrMany<T> = T | T[]
type StringProps = Record<string, string>
```

## Error Handling

### MutationObserverUnavailableError

Thrown when trying to use observation features in environments without MutationObserver:

```typescript
try {
    html.behaviors.observe('feature', '.selector');
} catch (error) {
    if (error instanceof MutationObserverUnavailableError) {
        // Fallback to manual initialization
        html.behaviors.dispatch('feature');
    }
}
```

### General Error Patterns

```typescript
// Always check if elements exist when necessary
const buttons = $('button');
if (buttons.length === 0) {
    console.warn('No buttons found');
    return;
}

// Behavior handlers are wrapped in try-catch internally
html.behaviors.bind('.component', 'Component', (el) => {
    // If this throws, it's caught and logged, but other behaviors continue
    throw new Error('Component initialization failed');
});
```
