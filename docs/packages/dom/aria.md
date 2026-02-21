---
title: Aria
description: Accessibility-first namespace with auto-prefixing
---

# Aria


Accessibility-first namespace. All attribute names are auto-prefixed with `aria-`.

```typescript
import { aria } from '@logosdx/dom';
```

## Set and Get


```typescript
// Set multiple attributes
aria(el, { pressed: 'true', expanded: 'false' });

// Get single
aria(el, 'pressed');                                 // → string | null

// Get multiple
aria(el, ['pressed', 'expanded']);                   // → Record
```

## Remove


```typescript
// Remove single
aria.remove(el, 'pressed');

// Remove multiple
aria.remove(el, ['pressed', 'expanded']);
```

## Shorthand Methods


```typescript
// Role (sets `role`, not `aria-role`)
aria.role(el, 'button');    aria.role(el);   // set / get

// Label
aria.label(el, 'Submit');   aria.label(el);  // set / get

// Visibility
aria.hide(el);                               // aria-hidden="true"
aria.show(el);                               // removes aria-hidden

// Live regions
aria.live(el, 'polite');                     // aria-live
```

## Chaining


```typescript
$('.modal')
    .aria({ modal: 'true' })
    .aria.role('dialog')
    .aria.label('Settings');
```
