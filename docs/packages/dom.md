---
title: DOM
description: For those who like to raw-dawg the DOM
---

# DOM


Not every site needs React. `@logosdx/dom` is for developers building embeddable widgets, landing pages, and enhanced static content. Work directly with the DOM using a chainable `$()` selector backed by standalone tree-shakeable functions. AbortController-based lifecycle management, modern observer wrappers, Web Animations API, and an accessibility-first aria namespace — all in under 5KB.

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
    const { $, css, on, aria } = LogosDx.Dom;
</script>
```

## Quick Start


```typescript
import { $, on, css, aria } from '@logosdx/dom';

// Select and chain operations
$('.btn')
    .css({ color: 'white', backgroundColor: 'blue' })
    .class.add('active')
    .aria({ label: 'Submit form' })
    .on('click', handleSubmit);

// Or use standalone functions for tree-shaking
css(el, { color: 'red' });
on(el, 'click', handler, { signal: controller.signal });
aria(el, { expanded: 'true' });
```

## Core: `$()` Selector


The `$` function queries the DOM and returns a `DomCollection` — a lightweight wrapper around an array of elements with chainable methods.

```typescript
import { $, DomCollection } from '@logosdx/dom';
```

### Selection

```typescript
// Basic query
const btns = $<HTMLButtonElement>('.btn');

// Scoped to a container
const items = $('.item', { container: sidebar });

// With signal for lifecycle management
const chat = $('.chat', { signal: controller.signal });

// Scoped + signal
const scopedChat = $('.btn', { container: sidebar, signal: controller.signal });

// Wrap existing elements
const wrapped = $(element);
const wrapped = $([el1, el2], { signal: controller.signal });
```

### Properties & Iteration

```typescript
btns.elements    // HTMLButtonElement[]
btns.length      // number
btns.first       // HTMLButtonElement | undefined
btns.at(2)       // HTMLButtonElement | undefined

// Chainable iteration
btns.each(el => { /* ... */ });

// Transforms
btns.map(el => el.textContent);         // string[]
btns.filter(el => !el.disabled);        // new DomCollection
for (const btn of btns) { /* ... */ }   // iterable
```

### Element Creation

```typescript
const card = $.create('div', {
    text: 'Hello',
    css: { padding: '1rem', '--theme': 'dark' },
    attrs: { 'data-id': '123' },
    class: ['card', 'active'],
    children: [$.create('span', { text: 'child' }).first],
    on: { click: handler },
    signal: controller.signal
});
```

## CSS


Callable namespace pattern — call to set/get, use `.remove()` to remove.

```typescript
import { css } from '@logosdx/dom';

// Set styles (single or multiple elements)
css(el, { color: 'red', '--theme': 'dark' });
css([el1, el2], { opacity: '0.5' });

// Get styles
css(el, 'color');                    // → string
css(el, ['color', 'fontSize']);      // → Record<string, string>

// Remove styles
css.remove(el, 'color');
css.remove(el, 'color', '--theme'); // variadic

// Chained
$('.btn').css({ color: 'red' }).css.remove('fontSize');
$('.btn').css('color');  // get from first element
```

**Note:** Standard properties read from `el.style` (inline). CSS custom properties (`--*`) read from `getComputedStyle`.


## Attributes


```typescript
import { attr } from '@logosdx/dom';

attr(el, { role: 'button', 'data-id': '1' });   // set
attr(el, 'role');                                 // get → string | null
attr(el, ['role', 'data-id']);                    // get → Record
attr.remove(el, 'role', 'tabindex');              // remove (variadic)
attr.has(el, 'disabled');                         // → boolean

// Chained
$('.btn').attr({ role: 'button' }).attr.remove('tabindex');
```


## Classes


```typescript
import { classify } from '@logosdx/dom';

classify.add(el, 'active', 'highlighted');
classify.remove(el, 'active');
classify.toggle(el, 'active');
classify.has(el, 'active');              // → boolean
classify.swap(el, 'active', 'inactive');

// Chained (note: `.class` on collections, not `.classify`)
$('.btn').class.add('active').class.toggle('highlight');
$('.btn').class.has('active');  // boolean from first element
```


## Data


```typescript
import { data } from '@logosdx/dom';

data(el, { userId: '123', role: 'admin' });   // set via dataset
data(el, 'userId');                            // get → string | undefined
data(el, ['userId', 'role']);                  // get → Record
data.remove(el, 'userId');                     // remove

// Chained
$('.card').data({ id: '1' }).data.remove('stale');
```


## Aria


Accessibility-first namespace. All attribute names are auto-prefixed with `aria-`.

```typescript
import { aria } from '@logosdx/dom';

// Set and get
aria(el, { pressed: 'true', expanded: 'false' });  // set
aria(el, 'pressed');                                 // get → string | null
aria(el, ['pressed', 'expanded']);                   // get → Record

// Remove (variadic)
aria.remove(el, 'pressed');
aria.remove(el, 'pressed', 'expanded');

// Shorthand methods
aria.role(el, 'button');    aria.role(el);   // set/get role (not aria-role)
aria.label(el, 'Submit');   aria.label(el);  // set/get aria-label
aria.hide(el);                               // aria-hidden="true"
aria.show(el);                               // removes aria-hidden
aria.live(el, 'polite');                     // aria-live

// Chained
$('.modal')
    .aria({ modal: 'true' })
    .aria.role('dialog')
    .aria.label('Settings');
```


## Events


AbortController-integrated event handling with delegation support.

```typescript
import { on, once, off, emit } from '@logosdx/dom';

// Basic
on(el, 'click', handler);
on(el, ['pointerenter', 'focus'], handler);       // multiple events
on([el1, el2], 'click', handler);                  // multiple elements

// Options
on(el, 'click', handler, { capture: true });
on(el, 'click', handler, { signal: ctrl.signal }); // auto-cleanup on abort

// Event delegation
on(parent, 'click', handler, { delegate: '.child' });

// Once
once(el, 'click', handler);   // fires once, auto-removes

// Remove (does not work with delegated listeners — use signal instead)
off(el, 'click', handler);
off(el, ['pointerenter', 'focus'], handler);  // multiple events

// Emit custom events (bubbles by default)
emit(el, 'widget:open', { chatId: 123 });
```

### Signal Inheritance

When a `DomCollection` is created with a signal, all `.on()` calls automatically inherit it:

```typescript
const controller = new AbortController();
const chat = $('.chat', { signal: controller.signal });

chat.on('click', openMenu);    // signal auto-attached
chat.once('keydown', sendMsg); // fires once, signal auto-attached
chat.off('click', openMenu);   // remove specific listener
chat.emit('widget:open', { chatId: 1 }); // dispatch custom event

controller.abort();            // removes ALL listeners
```

An explicit per-call signal takes precedence over the collection signal.


## Animate


Wraps the Web Animations API with presets. Automatically respects `prefers-reduced-motion` — returns a no-op finished animation when the user prefers reduced motion.

```typescript
import { animate } from '@logosdx/dom';

// Custom keyframes
animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
animate([el1, el2], [{ opacity: 0 }, { opacity: 1 }], 300);  // multiple elements

// Presets (all accept single or array of elements)
animate.fadeIn(el, 300);
animate.fadeIn([el1, el2], 500);
animate.fadeOut(el, 300);
animate.slideTo(el, { x: 10, y: -20 }, 300);

// Returns Animation[] — one per element
const animations = animate.fadeIn([el1, el2]);
await Promise.all(animations.map(a => a.finished));

// Chained
await Promise.all($('.modal').animate.fadeIn(200));
```


## Observers


### `observe` — MutationObserver Auto-Binding

Automatically binds initialization logic to elements matching a selector — both existing and dynamically added. Uses a `WeakSet` to prevent double-processing.

```typescript
import { observe } from '@logosdx/dom';

const stop = observe('[data-tooltip]', (el) => {

    const tip = new Tooltip(el);
    return () => tip.destroy();  // per-element cleanup
});

// Disconnect observer + run all per-element cleanups
stop();

// With options
observe('[data-tooltip]', init, {
    root: container,              // limit observation scope
    signal: controller.signal     // auto-cleanup
});
```

### `watchVisibility` — IntersectionObserver

```typescript
import { watchVisibility } from '@logosdx/dom';

const stop = watchVisibility(el, (entry) => {

    if (entry.isIntersecting) loadImage(el);
}, { threshold: 0.5, once: true });
```

### `watchResize` — ResizeObserver

```typescript
import { watchResize } from '@logosdx/dom';

const stop = watchResize(el, (entry) => {

    if (entry.contentRect.width < 400) compact(el);
});
```

All observers support `{ signal }` for AbortController-based cleanup.


## Viewport


```typescript
import { viewport } from '@logosdx/dom';

viewport.width();           viewport.height();
viewport.scrollX();         viewport.scrollY();
viewport.scrollProgress();      // 0–1 (page)
viewport.scrollProgress(el);    // 0–1 (scrollable element)
viewport.pixelRatio();
viewport.isAtTop(10);       viewport.isAtBottom(10);  // optional threshold
viewport.scrollTo(el, { behavior: 'smooth' });
viewport.scrollTo(0, 500, { behavior: 'smooth' });
```


## DOM Manipulation


```typescript
import { create, append, prepend, remove, replace } from '@logosdx/dom';

const el = create('div', {
    text: 'Hello',
    class: ['card'],
    css: { padding: '1rem' },
    attrs: { 'data-id': '1' },
    on: { click: handler }
});

append(parent, el, otherEl);
prepend(parent, el);
remove(el);
replace(oldEl, newEl);
```


## Widget Lifecycle Example


The recommended pattern for building embeddable widgets — a single `AbortController` manages the entire lifecycle:

```typescript
function initChatWidget(container: HTMLElement) {

    const controller = new AbortController();
    const ui = $(container, { signal: controller.signal });

    // Setup
    ui.class.add('chat-active');
    ui.aria({ role: 'dialog', label: 'Customer support' });
    ui.css({ '--chat-bg': '#fff' });
    ui.on('click', handler);

    // Observers also use the same signal
    observe('[data-emoji]', initEmoji, { signal: controller.signal });
    watchResize(container, relayout, { signal: controller.signal });

    // Single cleanup for everything
    return () => controller.abort();
}
```


## Exports Reference


```typescript
// Entry point
import {
    $,                                    // selector + $.create
    DomCollection,                        // collection class

    // Callable namespaces
    css,                                  // css() + css.remove()
    attr,                                 // attr() + attr.remove() + attr.has()
    data,                                 // data() + data.remove()
    aria,                                 // aria() + shorthand methods

    // Plain namespace
    classify,                             // classify.add/remove/toggle/has/swap

    // Standalone functions
    on, once, off, emit,                  // events
    animate,                              // animate() + animate.fadeIn/fadeOut/slideTo
    observe,                              // MutationObserver
    watchVisibility, watchResize,         // IntersectionObserver, ResizeObserver
    viewport,                             // viewport namespace
    create, append, prepend, remove, replace  // DOM manipulation
} from '@logosdx/dom';
```


## Type Definitions


```typescript
import type {
    OneOrMany,         // T | T[]
    CssPropNames,     // string keys of CSSStyleDeclaration
    CssCustomProp,    // `--${string}`
    AnyCssProp,       // CssPropNames | CssCustomProp
    Cleanup,          // () => void
    SignalOptions,    // { signal?: AbortSignal }
    SelectOptions,    // { signal?: AbortSignal; container?: Element }
    CreateOptions,    // { text, css, attrs, class, children, on, signal }
    EventOptions,     // extends AddEventListenerOptions + { delegate?: string }
    GlobalEvents,     // keyof DocumentEventMap
    EvType,           // GlobalEvents | (string & {})
    EvListener,       // typed event listener
    AnimateOptions    // extends KeyframeAnimationOptions
} from '@logosdx/dom';
```


## Module Structure


```
@logosdx/dom
├── index.ts          # $, $.create, all exports
├── collection.ts     # DomCollection class
├── css.ts            # css() + css.remove()
├── attr.ts           # attr() + attr.remove() + attr.has()
├── class.ts          # classify.add/remove/toggle/has/swap
├── data.ts           # data() + data.remove()
├── aria.ts           # aria() + shorthand methods
├── events.ts         # on, once, off, emit
├── animate.ts        # animate() + presets
├── observe.ts        # observe (MutationObserver)
├── watch.ts          # watchVisibility, watchResize
├── viewport.ts       # viewport namespace
├── dom.ts            # create, append, prepend, remove, replace
├── helpers.ts        # internal utilities
└── types.ts          # shared types
```
