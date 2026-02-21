---
title: Animate
description: Web Animations API with presets and reduced-motion support
---

# Animate


Wraps the Web Animations API with presets. Automatically respects `prefers-reduced-motion` — returns a no-op finished animation when the user prefers reduced motion.

```typescript
import { animate } from '@logosdx/dom';
```

## Custom Keyframes


```typescript
animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
animate([el1, el2], [{ opacity: 0 }, { opacity: 1 }], 300);  // multiple elements
```

## Presets


All presets accept a single element or an array of elements.

```typescript
animate.fadeIn(el, 300);
animate.fadeIn([el1, el2], 500);
animate.fadeOut(el, 300);
animate.slideTo(el, { x: 10, y: -20 }, 300);
```

## Return Value


All animate functions return `Animation[]` — one per element. Use this to await completion:

```typescript
const animations = animate.fadeIn([el1, el2]);
await Promise.all(animations.map(a => a.finished));
```

## Chaining


```typescript
await Promise.all($('.modal').animate.fadeIn(200));
```

## Reduced Motion


When `prefers-reduced-motion: reduce` is active, all animate calls return a no-op `Animation` that is already finished. No visual animation runs — your `await` calls resolve immediately.
