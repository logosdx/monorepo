---
title: Selection
description: $() selector, DomCollection, and element creation
---

# Selection


The `$` function queries the DOM and returns a `DomCollection` — a lightweight wrapper around an array of elements with chainable methods.

```typescript
import { $, DomCollection } from '@logosdx/dom';
```

## Querying


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

## Properties & Iteration


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

## Element Creation


```typescript
import { create } from '@logosdx/dom';

// Standalone — returns HTMLElement
const el = create('div', {
    text: 'Hello',
    css: { padding: '1rem', '--theme': 'dark' },
    attrs: { 'data-id': '123' },
    class: ['card', 'active'],
    children: [create('span', { text: 'child' })],
    on: { click: handler },
    signal: controller.signal
});

// $.create — returns DomCollection wrapping the created element
const card = $.create('div', {
    text: 'Hello',
    css: { padding: '1rem' },
    class: ['card'],
});
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

## Signal Inheritance


When a `DomCollection` is created with a signal, all chained operations that support signals automatically inherit it:

```typescript
const controller = new AbortController();
const chat = $('.chat', { signal: controller.signal });

chat.on('click', openMenu);    // signal auto-attached
chat.once('keydown', sendMsg); // signal auto-attached

controller.abort();            // removes ALL listeners
```

An explicit per-call signal takes precedence over the collection signal.
