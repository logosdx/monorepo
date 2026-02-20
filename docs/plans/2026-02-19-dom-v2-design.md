# @logosdx/dom v2 Design

## Philosophy

A lightweight (~5KB), element-centric DOM utility for embeddable widgets. Instead of loading React, you load this and get a complete toolkit for building UI that lives on other people's sites. The API is chainable from `$()` selections, with every method also available as a standalone tree-shakeable import.


## Core: `$()` and `DomCollection`

`$()` returns a `DomCollection<T>` — a thin wrapper around `T[]` with chainable methods.

```ts
// Selection
const btns = $<HTMLButtonElement>('.btn')
const btns = $<HTMLButtonElement>('.btn', container)

// With AbortController signal — all events auto-inherit it
const chat = $('.chat-widget', { signal: controller.signal })

// Access raw elements
btns.elements    // HTMLButtonElement[]
btns.length      // number
btns.first       // HTMLButtonElement | undefined
btns.at(2)       // HTMLButtonElement | undefined

// Iteration (collection is iterable with for...of)
btns.each(el => { ... })              // returns DomCollection (chainable)
btns.map(el => el.textContent)        // string[]
btns.filter(el => !el.disabled)       // new DomCollection
```


## Element Creation

```ts
$.create('div', {
    text: 'Hello',
    css: { padding: '1rem', '--theme': 'dark' },
    attrs: { 'data-id': '123' },
    class: ['card', 'active'],
    children: [
        $.create('span', { text: 'child' })
    ],
    on: { click: handler },
    signal: controller.signal          // auto-attached to all events
})
// Returns DomCollection<HTMLDivElement>
```


## CSS

Callable namespace — call for get/set, use `.remove()` for removal.

```ts
btns.css({ color: 'red', fontSize: '16px' })          // set → returns this
btns.css({ '--theme': 'dark', '--gap': '8px' })        // CSS custom properties
btns.css('color')                                       // get → string (from first)
btns.css(['color', 'fontSize'])                         // get multiple → Record
btns.css.remove('color', 'fontSize')                    // remove → returns this
```

CSS custom properties (`--*`) are handled transparently via `setProperty`/`getPropertyValue`.


## Attributes

```ts
btns.attr({ 'aria-pressed': 'true', role: 'button' })  // set → returns this
btns.attr('aria-pressed')                               // get → string | null
btns.attr(['role', 'aria-pressed'])                     // get multiple → Record
btns.attr.remove('disabled', 'aria-pressed')            // remove → returns this
btns.attr.has('disabled')                               // boolean (from first)
```


## Classes

```ts
btns.class.add('active', 'highlighted')
btns.class.remove('active')
btns.class.toggle('active')
btns.class.has('active')                                // boolean (from first)
btns.class.swap('active', 'inactive')
```


## Data

```ts
btns.data('userId')                                     // get → string | null
btns.data({ userId: '123', role: 'admin' })             // set → returns this
btns.data(['userId', 'role'])                            // get multiple → Record
btns.data.remove('userId')                              // remove → returns this
```


## Aria (Accessibility)

Auto-prefixes `aria-` — you write `pressed`, it reads/writes `aria-pressed`.

```ts
btns.aria('pressed')                                    // get → string | null
btns.aria({ pressed: 'true', expanded: 'false' })       // set → returns this
btns.aria(['pressed', 'expanded'])                       // get multiple → Record
btns.aria.remove('pressed')                             // remove → returns this
btns.aria.role('button')                                // set role → returns this
btns.aria.role()                                        // get role → string | null
btns.aria.label('Submit form')                          // set aria-label → returns this
btns.aria.label()                                       // get → string | null
btns.aria.hide()                                        // aria-hidden="true" → returns this
btns.aria.show()                                        // removes aria-hidden → returns this
btns.aria.live('polite')                                // aria-live → returns this
```


## Events

AbortController integration for lifecycle management.

```ts
// Basic
btns.on('click', handler)
btns.on('click', handler, { capture: true })
btns.once('pointerdown', handler)

// Multiple events
btns.on(['pointerenter', 'focus'], showTooltip)

// Custom events
btns.emit('widget:open', { chatId: 123 })

// Cleanup
btns.off()                                              // all listeners on this collection
btns.off('click')                                       // all click listeners
btns.off('click', specificHandler)                       // specific handler

// Shared AbortController
const controller = new AbortController()
$('.open-btn').on('click', openChat, { signal: controller.signal })
$('.close-btn').on('click', closeChat, { signal: controller.signal })
controller.abort()                                      // kills both

// Event delegation
$('.chat-window').on('click', handler, { delegate: '.message' })

// Collection-level signal (auto-inherited by all .on() calls)
const chat = $('.chat-widget', { signal: controller.signal })
chat.on('click', openMenu)          // signal attached automatically
chat.on('keydown', sendMessage)     // same
```


## Animations

Thin wrapper over Web Animations API.

```ts
// Chained
$('.modal').animate(
    { opacity: [0, 1], transform: ['translateY(20px)', 'translateY(0)'] },
    { duration: 300, easing: 'ease-out' }
)

// Presets
$('.toast').animate.fadeIn(300)
$('.toast').animate.fadeOut(300)
$('.panel').animate.slideTo({ x: 0, y: -10 }, 300)

// Sequencing via promises
await $('.modal').animate.fadeIn(200)
await $('.content').animate.fadeIn(300)

// Standalone
const animation = animate(el, { opacity: [1, 0] }, { duration: 200, fill: 'forwards' })
await animation.finished

// Automatically respects prefers-reduced-motion (animations resolve instantly)
```

Returns native `Animation` object — `.pause()`, `.cancel()`, `.finished` all work.


## Observers

Standalone functions, each returns a cleanup function. All support `signal`.

```ts
// MutationObserver — auto-bind behaviors
const stop = observe('[data-tooltip]', (el) => {

    const tip = new Tooltip(el)
    return () => tip.destroy()
})
// Runs on existing matches + new ones as they appear

const stop = observe('[data-chat]', initChat, {
    root: container,
    signal: controller.signal
})

// IntersectionObserver — visibility tracking
const stop = watchVisibility(el, (entry) => {

    if (entry.isIntersecting) loadImage(el)
}, { threshold: 0.5, once: true })

// ResizeObserver — size changes
const stop = watchResize(el, (entry) => {

    const { width } = entry.contentRect
    if (width < 400) compact(el)
})
```


## Viewport

Standalone namespace for window-level measurements and scroll actions.

```ts
viewport.width()
viewport.height()
viewport.scrollX()
viewport.scrollY()
viewport.scrollProgress(el?)       // 0–1
viewport.pixelRatio()

viewport.scrollTo(el, { offset: -20, behavior: 'smooth' })
viewport.scrollTo(x, y, { behavior: 'smooth' })

viewport.isAtTop(threshold?)
viewport.isAtBottom(threshold?)
```


## DOM Manipulation

```ts
append(parent, child1, child2)
prepend(parent, child1)
remove(el)
replace(oldEl, newEl)
```


## Standalone Functions

Everything on the collection is also importable standalone (element as first arg):

```ts
import {
    $, css, attr, data, aria, classify,
    on, once, emit, off,
    animate,
    observe, watchVisibility, watchResize,
    viewport,
    create, append, prepend, remove, replace
} from '@logosdx/dom'

css(el, { color: 'red' })
css(el, 'color')
css.remove(el, 'color')
attr(el, { role: 'button' })
aria(el, { pressed: 'true' })
on(el, 'click', handler)
```


## Module Structure

```
@logosdx/dom
├── index.ts          # $, create, standalone functions, viewport namespace
├── collection.ts     # DomCollection class
├── css.ts            # css() + css.remove()
├── attr.ts           # attr() + attr.remove() + attr.has()
├── class.ts          # classify.add/remove/toggle/has/swap
├── data.ts           # data() + data.remove()
├── aria.ts           # aria() + aria.remove/role/label/hide/show/live
├── events.ts         # on, once, off, emit
├── animate.ts        # animate() + presets
├── observe.ts        # observe (MutationObserver)
├── watch.ts          # watchVisibility, watchResize
├── viewport.ts       # viewport namespace
├── dom.ts            # append, prepend, remove, replace, create
└── types.ts          # shared types
```


## What's Gone (vs v1)

| v1 | v2 Replacement |
|---|---|
| `behaviors.ts` (802 lines, global singleton) | `observe()` (~60 lines) |
| `HtmlCss`, `HtmlAttr`, `HtmlEvents` static classes | standalone functions + collection methods |
| `createElWith` closure cleanup | `$.create()` with signal support |
| `isInViewport`, `isScrolledIntoView`, `elementVisibility`, `isPartiallyVisible` | `watchVisibility()` |
| `cloneAndSubmitForm`, `onceReady`, `copyToClipboard` | dropped (too niche) |
| Browser-guard throw at import | individual functions guard internally |

Estimated: ~800–1000 lines, down from ~2,500. Tree-shakeable to just what you use.


## Widget Lifecycle Example

```ts
function initChatWidget(container: HTMLElement) {

    const controller = new AbortController()
    const ui = $(container, { signal: controller.signal })

    ui.class.add('chat-active')
    ui.aria({ role: 'dialog', label: 'Customer support chat' })
    ui.css({ '--chat-bg': '#fff' })

    const input = $.create('input', {
        attrs: { placeholder: 'Type a message...' },
        signal: controller.signal,
        on: { keydown: sendMessage }
    })

    ui.on('click', handler)

    observe('[data-emoji]', initEmojiPicker, { signal: controller.signal })
    watchResize(container, relayout, { signal: controller.signal })

    return () => controller.abort()  // single cleanup for everything
}
```
