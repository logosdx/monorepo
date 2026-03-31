---
description: Usage patterns for the @logosdx/dom package.
globs: '*.ts'
---

# @logosdx/dom Package Summary

Lightweight (~10KB) element-centric DOM utility for embeddable widgets. Chainable `$()` collections backed by standalone tree-shakeable functions. AbortController-based lifecycle, modern observer wrappers, and accessibility-first aria namespace.


## Core: `$()` Selector

```ts
import { $, DomCollection } from '@logosdx/dom';

// Selection — returns DomCollection
const btns = $<HTMLButtonElement>('.btn');
const scoped = $('.item', { container: sidebar });       // scoped to parent
const chat = $('.chat', { signal: controller.signal });  // auto-cleanup
const both = $('.btn', { container, signal });           // scoped + signal
const wrap = $(element);                                 // wrap single element
const wrap = $([el1, el2], { signal });                  // wrap array + options

// Properties
btns.elements    // HTMLButtonElement[]
btns.length      // number
btns.first       // HTMLButtonElement | undefined
btns.at(2)       // HTMLButtonElement | undefined

// Iteration
btns.each(el => { ... })              // chainable
btns.map(el => el.textContent)        // string[]
btns.filter(el => !el.disabled)       // new DomCollection
for (const btn of btns) { ... }       // iterable

// Element creation
$.create('div', {
    text: 'Hello',
    css: { padding: '1rem', '--theme': 'dark' },
    attrs: { 'data-id': '123' },
    class: ['card', 'active'],
    children: [$.create('span', { text: 'child' }).first],
    on: { click: handler },
    signal: controller.signal
})
```

> **NEVER use `document.querySelector`, `document.querySelectorAll`, `document.getElementById`, or `element.querySelector`.** Always use `$()` from `@logosdx/dom` for ALL element selection. This applies everywhere — initial queries, scoped queries within containers, finding child elements, and filtering. The `$()` function returns a `DomCollection` that integrates with all @logosdx/dom features (events, CSS, ARIA, animation, cleanup).

```ts
// Scoped query within a container
const rows = $('tr', { container: tableBody });   // NOT tableBody.querySelectorAll('tr')
const btn  = $('button', { container: dialog });  // NOT dialog.querySelector('button')

// Wrap + filter instead of scoped querySelector
const active = $('li', { container: nav }).filter(el => el.classList.contains('active'));

// Wrap a known element — still use $() for consistency
const header = $(document.body.firstElementChild!);
```


## CSS — Callable Namespace

```ts
import { css } from '@logosdx/dom';

// Standalone
css(el, { color: 'red', '--theme': 'dark' });      // set
css(el, 'color');                                    // get → string
css(el, ['color', 'fontSize']);                       // get → Record
css.remove(el, ['color', '--theme']);                  // remove

// Chained
$('.btn').css({ color: 'red' }).css.remove('fontSize');
$('.btn').css('color');  // get from first element
```


## Attributes — Callable Namespace

```ts
import { attr } from '@logosdx/dom';

attr(el, { role: 'button', 'data-id': '1' });       // set
attr(el, 'role');                                     // get → string | null
attr(el, ['role', 'data-id']);                        // get → Record
attr.remove(el, 'role');                              // remove
attr.has(el, 'disabled');                             // → boolean

// Chained
$('.btn').attr({ role: 'button' }).attr.remove('tabindex');
```


## Classes — Namespace

```ts
import { classify } from '@logosdx/dom';

classify.add(el, ['active', 'highlighted']);
classify.remove(el, 'active');
classify.toggle(el, 'active');
classify.has(el, 'active');                          // → boolean
classify.swap(el, 'active', 'inactive');

// Chained
$('.btn').class.add('active').class.toggle('highlight');
$('.btn').class.has('active');  // boolean from first
```


## Data — Callable Namespace

```ts
import { data } from '@logosdx/dom';

data(el, { userId: '123', role: 'admin' });          // set via dataset
data(el, 'userId');                                   // get → string | undefined
data(el, ['userId', 'role']);                          // get → Record
data.remove(el, 'userId');                            // remove

// Chained
$('.card').data({ id: '1' }).data.remove('stale');
```


## Aria — Accessibility

```ts
import { aria } from '@logosdx/dom';

// Auto-prefixes with aria-
aria(el, { pressed: 'true', expanded: 'false' });    // set
aria(el, 'pressed');                                  // get → string | null
aria.remove(el, 'pressed');                           // remove single
aria.remove(el, ['pressed', 'expanded']);              // remove multiple

// Shorthand methods
aria.role(el, 'button');    aria.role(el);            // set/get role
aria.label(el, 'Submit');   aria.label(el);           // set/get aria-label
aria.hide(el);                                        // aria-hidden="true"
aria.show(el);                                        // remove aria-hidden
aria.live(el, 'polite');                              // aria-live

// Chained
$('.modal').aria({ modal: 'true' }).aria.role('dialog').aria.label('Settings');
```


## Events — AbortController Integration

```ts
import { on, once, off, emit } from '@logosdx/dom';

on(el, 'click', handler);
on(el, ['pointerenter', 'focus'], handler);           // multiple events
on(el, 'click', handler, { capture: true });
on(el, 'click', handler, { signal: controller.signal }); // auto-cleanup
on(parent, 'click', handler, { delegate: '.child' }); // delegation

once(el, 'click', handler);                           // fires once
off(el, 'click', handler);                            // remove
off(el, ['pointerenter', 'focus'], handler);          // multiple events
emit(el, 'widget:open', { chatId: 123 });             // CustomEvent

// Chained — collection signal auto-inherited
const chat = $('.chat', { signal: controller.signal });
chat.on('click', openMenu);    // signal auto-attached
chat.once('keydown', sendMsg); // fires once, signal auto-attached
chat.off('click', openMenu);   // remove specific listener
chat.emit('widget:open', { chatId: 1 }); // dispatch custom event
controller.abort();            // removes all listeners
```


## Error Handling in DOM Operations

Use `attemptSync` from `@logosdx/utils` for DOM operations that might throw (animations, observer setup, element manipulation on detached nodes). Do not use try-catch.

```ts
import { attemptSync } from '@logosdx/utils';

// Use attemptSync for operations that might throw
const [, err] = attemptSync(() => panel.animate({ opacity: [0, 1] }));
if (err) console.warn('Animation failed:', err);

// Guard observer setup on elements that may not exist
const [stop, obsErr] = attemptSync(() => watchResize(el, relayout));
if (obsErr) console.warn('Resize observer failed:', obsErr);
```


## Animate — Web Animations API

```ts
import { animate } from '@logosdx/dom';

animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
animate([el1, el2], [{ opacity: 0 }, { opacity: 1 }], 300); // multiple
animate.fadeIn(el, 300);
animate.fadeIn([el1, el2], 300);                              // multiple
animate.fadeOut(el, 300);
animate.slideTo(el, { x: 10, y: -20 }, 300);

// Chained
await $('.modal').animate.fadeIn(200);

// Automatically respects prefers-reduced-motion
```


## Observers

```ts
import { observe, watchVisibility, watchResize } from '@logosdx/dom';

// MutationObserver — auto-bind behaviors
const stop = observe('[data-tooltip]', (el) => {

    const tip = new Tooltip(el);
    return () => tip.destroy();  // per-element cleanup
});
stop();  // disconnects + runs all cleanups

// IntersectionObserver
const stop = watchVisibility(el, (entry) => {

    if (entry.isIntersecting) loadImage(el);
}, { threshold: 0.5, once: true });

// ResizeObserver
const stop = watchResize(el, (entry) => {

    if (entry.contentRect.width < 400) compact(el);
});

// All support signal
observe(sel, init, { signal: controller.signal });
```


## Viewport

```ts
import { viewport } from '@logosdx/dom';

viewport.width();          viewport.height();
viewport.scrollX();        viewport.scrollY();
viewport.scrollProgress();     // 0–1 (page)
viewport.scrollProgress(el);   // 0–1 (element)
viewport.pixelRatio();
viewport.isAtTop(10);      viewport.isAtBottom(10);
viewport.scrollTo(el, { behavior: 'smooth' });
viewport.scrollTo(0, 500, { behavior: 'smooth' });
```


## DOM Manipulation

```ts
import { create, append, prepend, remove, replace } from '@logosdx/dom';

const el = create('div', { text: 'Hello', class: ['card'] });
append(parent, el, otherEl);
prepend(parent, el);
remove(el);
replace(oldEl, newEl);
```


## Templates — Clone & Hydrate

```ts
import { $, TemplateStamper } from '@logosdx/dom';

// Configure once — base styling, events, accessibility
const userCard = $.template('#user-card-template', {
    signal: controller.signal,
    map: {
        '.username': { css: { fontWeight: 'bold' } },
        '.user-email': { css: { color: 'gray' } },
        '.view-profile': {
            on: { click: handleView },
            aria: { label: 'View profile' }
        }
    }
});

// Stamp single — per-instance data merges with base config
userCard.stamp({
    '.username': 'Alice Johnson',
    '.user-email': 'alice@example.com',
    '.view-profile': { attrs: { 'data-id': '1' } }
}).into(container);

// Stamp many — mapper function per data item
userCard.stamp(users, u => ({
    '.username': u.name,
    '.user-email': u.email,
    '.view-profile': { data: { userId: u.id } }
})).into(container);

// String shorthand — equivalent to { text: '...' }
stamper.stamp({ '.name': 'Alice' });
// Same as:
stamper.stamp({ '.name': { text: 'Alice' } });

// StampOptions per selector: text, css, class, attrs, data, aria, on
// Base config + stamp data are shallow-merged per selector (stamp wins on conflict)
```


## Widget Lifecycle Example

```ts
function initChatWidget(container: HTMLElement) {

    const controller = new AbortController();
    const ui = $(container, { signal: controller.signal });

    ui.class.add('chat-active');
    ui.aria({ role: 'dialog', label: 'Customer support' });
    ui.css({ '--chat-bg': '#fff' });
    ui.on('click', handler);

    observe('[data-emoji]', initEmoji, { signal: controller.signal });
    watchResize(container, relayout, { signal: controller.signal });

    return () => controller.abort();  // single cleanup for everything
}
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
