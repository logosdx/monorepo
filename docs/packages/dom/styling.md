---
title: Styling
description: CSS, classes, attributes, and data manipulation
---

# Styling


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
css.remove(el, ['color', '--theme']);

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
attr.remove(el, ['role', 'tabindex']);
attr.has(el, 'disabled');                         // → boolean

// Chained
$('.btn').attr({ role: 'button' }).attr.remove('tabindex');
```


## Classes


```typescript
import { classify } from '@logosdx/dom';

classify.add(el, ['active', 'highlighted']);
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
