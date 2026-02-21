---
title: DOM
description: For those who like to raw-dawg the DOM
---

# DOM


Not every site needs React. `@logosdx/dom` is for developers building embeddable widgets, landing pages, and enhanced static content. Work directly with the DOM using a chainable `$()` selector backed by standalone tree-shakeable functions. AbortController-based lifecycle management, modern observer wrappers, Web Animations API, and an accessibility-first aria namespace — all in under 10KB.

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

## Flexible Inputs


Every standalone function accepts **one or many elements** and **one or many keys**. No special "batch" API — just pass what you have:

```typescript
// Single element or array — same function
css(el, { color: 'red' });
css([el1, el2, el3], { color: 'red' });

on(el, 'click', handler);
on(el, ['pointerenter', 'focus'], handler);   // multiple events
on([el1, el2], 'click', handler);             // multiple elements

aria(el, { pressed: 'true' });
aria([el1, el2], { pressed: 'true' });

animate.fadeIn(el, 300);
animate.fadeIn([el1, el2], 300);

// Custom events work the same way
emit(el, 'widget:open', { chatId: 123 });
emit([el1, el2], 'ping');
```

Getters accept a **single key or an array of keys**:

```typescript
// Single key → single value
css(el, 'color');                    // → 'red'
attr(el, 'role');                    // → 'button'
aria(el, 'pressed');                 // → 'true'
data(el, 'userId');                  // → '123'

// Array of keys → Record
css(el, ['color', 'fontSize']);      // → { color: 'red', fontSize: '14px' }
attr(el, ['role', 'data-id']);       // → { role: 'button', 'data-id': '1' }
aria(el, ['pressed', 'expanded']);   // → { pressed: 'true', expanded: 'false' }
data(el, ['userId', 'role']);        // → { userId: '123', role: 'admin' }
```

The `$()` selector follows the same philosophy — pass a CSS selector, a single element, or an array:

```typescript
$('.btn');                           // query the DOM
$(element);                          // wrap one element
$([el1, el2], { signal });          // wrap many with options
```

This `OneOrMany` pattern is consistent across the entire library. The `OneOrMany<T>` type is defined as `T | T[]`.


## Widget Lifecycle Example


The recommended pattern for building embeddable widgets — a single `AbortController` manages the entire lifecycle:

```typescript
import { $, observe, watchResize } from '@logosdx/dom';

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

## What's Next


| Page | Description |
|------|-------------|
| [Selection](./selection) | `$()` selector, `DomCollection`, element creation |
| [Styling](./styling) | CSS, classes, attributes, data |
| [Aria](./aria) | Accessibility-first namespace |
| [Events](./events) | Event handling, delegation, signal lifecycle |
| [Animate](./animate) | Web Animations API with presets |
| [Templates](./templates) | Clone and hydrate HTML `<template>` elements |
| [Observers](./observers) | MutationObserver, IntersectionObserver, ResizeObserver, viewport |

## Exports Reference


```typescript
// Entry point
import {
    $,                                    // selector + $.create + $.template
    DomCollection,                        // collection class
    TemplateStamper,                      // template cloning + hydration

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
    StampOptions,     // { text, css, class, attrs, data, aria, on }
    StampMap,         // Record<string, string | StampOptions>
    TemplateConfig,   // { signal?, map? }
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
├── index.ts          # $, $.create, $.template, all exports
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
├── template.ts       # TemplateStamper class
├── dom.ts            # create, append, prepend, remove, replace
├── helpers.ts        # internal utilities
└── types.ts          # shared types
```
