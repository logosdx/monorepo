---
title: Events
description: AbortController-integrated event handling with delegation
---

# Events


AbortController-integrated event handling with delegation support.

```typescript
import { on, once, off, emit } from '@logosdx/dom';
```

## Basic Usage


```typescript
// Single event
on(el, 'click', handler);

// Multiple events
on(el, ['pointerenter', 'focus'], handler);

// Multiple elements
on([el1, el2], 'click', handler);

// Options
on(el, 'click', handler, { capture: true });
on(el, 'click', handler, { signal: ctrl.signal }); // auto-cleanup on abort
```

## Event Delegation


```typescript
on(parent, 'click', handler, { delegate: '.child' });
```

The handler only fires when the event target (or an ancestor up to `parent`) matches the delegate selector.

## Once


```typescript
once(el, 'click', handler);   // fires once, auto-removes
```

## Remove


```typescript
// Single event
off(el, 'click', handler);

// Multiple events
off(el, ['pointerenter', 'focus'], handler);
```

**Note:** `off()` does not work with delegated listeners — use `signal` instead for cleanup.

## Custom Events


```typescript
// Bubbles by default
emit(el, 'widget:open', { chatId: 123 });
```

## Signal Lifecycle


When a `DomCollection` is created with a signal, all event methods automatically inherit it:

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
