---
title: Observers
description: MutationObserver, IntersectionObserver, ResizeObserver, and viewport utilities
---

# Observers


## `observe` — MutationObserver Auto-Binding


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
    root: container,              // limit observation scope (default: document.body)
    signal: controller.signal     // auto-cleanup
});
```

## `watchVisibility` — IntersectionObserver


```typescript
import { watchVisibility } from '@logosdx/dom';

const stop = watchVisibility(el, (entry) => {

    if (entry.isIntersecting) loadImage(el);
}, { threshold: 0.5, once: true });
```

## `watchResize` — ResizeObserver


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

### `scrollTo` Options

```typescript
viewport.scrollTo(el, {
    behavior: 'smooth',       // ScrollBehavior
    offset: -80,              // pixel offset (e.g. for fixed headers)
    scrollElement: container  // override scroll container (numeric form only)
});
```
