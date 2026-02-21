---
title: Templates
description: Clone and hydrate HTML templates with a declarative, configure-once-stamp-many pattern
---

# Templates


HTML `<template>` elements are a native browser feature for reusable markup — but using them requires verbose imperative code. `$.template()` wraps this into a clean declarative API: configure your template once with base styling, events, and accessibility, then stamp out instances with per-item data.

```typescript
import { $ } from '@logosdx/dom';
```

## Quick Start


Given this HTML:

```html
<template id="user-card">
    <div class="card">
        <h3 class="username"></h3>
        <p class="email"></p>
        <button class="view-profile">View Profile</button>
    </div>
</template>

<div id="user-list"></div>
```

Stamp out user cards:

```typescript
const userCard = $.template('#user-card');

const users = [
    { name: 'Alice Johnson', email: 'alice@example.com' },
    { name: 'Bob Smith', email: 'bob@example.com' }
];

userCard.stamp(users, u => ({
    '.username': u.name,
    '.email': u.email,
})).into(document.querySelector('#user-list')!);
```

That's it — two cards appear in the DOM, each filled with user data.

## Configure Once, Stamp Many


The real power is separating **template configuration** (styling, events, accessibility) from **per-instance data** (text, IDs). Configure once, stamp many times:

```typescript
const userCard = $.template('#user-card', {
    signal: controller.signal,
    map: {
        '.username': { css: { fontWeight: 'bold' } },
        '.email': { css: { color: 'gray' } },
        '.view-profile': {
            on: { click: handleViewProfile },
            aria: { label: 'View profile' }
        }
    }
});

// Each stamp merges per-instance data over the base config
userCard.stamp({
    '.username': 'Alice Johnson',
    '.email': 'alice@example.com',
    '.view-profile': { data: { userId: '1' } }
}).into(container);

userCard.stamp({
    '.username': 'Bob Smith',
    '.email': 'bob@example.com',
    '.view-profile': { data: { userId: '2' } }
}).into(container);
```

Both cards get bold usernames, gray emails, click handlers, and aria labels — but each has its own text and data attributes.

## Stamp Options


Each selector in the map can be a **string shorthand** or a full **options object**:

```typescript
// String shorthand — sets textContent
stamper.stamp({ '.username': 'Alice' });

// Equivalent to:
stamper.stamp({ '.username': { text: 'Alice' } });
```

The full options mirror what you already know from `create()`:

```typescript
stamper.stamp({
    '.username': {
        text: 'Alice Johnson',
        css: { color: 'navy', fontWeight: 'bold' },
        class: ['highlighted'],
        attrs: { title: 'Primary user' },
        data: { userId: '42' },
        aria: { label: 'User name' },
        on: { click: handleNameClick }
    }
});
```

| Property | Type | Description |
|----------|------|-------------|
| `text` | `string` | Sets `textContent` |
| `css` | `Record<string, string>` | Inline styles (supports `--custom` properties) |
| `class` | `string[]` | CSS classes to add |
| `attrs` | `Record<string, string>` | HTML attributes |
| `data` | `Record<string, string>` | `data-*` attributes (camelCase keys) |
| `aria` | `Record<string, string>` | `aria-*` attributes |
| `on` | `Record<string, EvListener>` | Event listeners |

## Merge Behavior


When `stamp()` is called, per-instance values are shallow-merged over the base config **per selector**:

```typescript
const card = $.template('#card', {
    map: {
        '.title': { css: { fontWeight: 'bold' }, class: ['heading'] },
    }
});

// Base css + class are preserved, stamp adds text
card.stamp({ '.title': 'Hello World' });
// Result: bold text, 'heading' class, textContent = 'Hello World'

// Stamp can override base properties
card.stamp({ '.title': { text: 'Override', css: { fontWeight: 'normal' } } });
// Result: fontWeight overridden, 'heading' class still applied
```

- Non-overlapping properties from both base and stamp are preserved
- Stamp values win on conflict
- Base selectors not present in the stamp still apply
- Selectors that don't match any element in the clone are silently skipped

## Stamping Arrays


Pass a data array and a mapper function to stamp multiple items at once:

```typescript
const users = [
    { name: 'Alice', email: 'alice@example.com', id: '1' },
    { name: 'Bob', email: 'bob@example.com', id: '2' },
    { name: 'Carol', email: 'carol@example.com', id: '3' },
];

userCard.stamp(users, user => ({
    '.username': user.name,
    '.email': user.email,
    '.view-profile': { data: { userId: user.id } }
})).into(container);
```

The returned `DomCollection` contains all stamped root elements — one per array item.

## Inserting Into the DOM


`stamp()` returns a `DomCollection`. Use `.into()` to append all stamped elements into a container:

```typescript
// Chain directly
userCard.stamp({ '.username': 'Alice' }).into(container);

// Or hold a reference for further operations
const cards = userCard.stamp(users, u => ({ '.username': u.name }));
cards.class.add('fade-in');
cards.into(container);
```

`.into()` appends elements and returns the collection for further chaining.

## Signal Lifecycle


When the stamper is created with a signal, all event listeners bound during stamping are automatically cleaned up on abort:

```typescript
const controller = new AbortController();

const card = $.template('#user-card', {
    signal: controller.signal,
    map: {
        '.view-profile': { on: { click: handleView } }
    }
});

card.stamp({ '.username': 'Alice' }).into(container);

// Later: removes all event listeners from all stamped elements
controller.abort();
```

## Template Sources


`$.template()` accepts a CSS selector or a template element directly:

```typescript
// CSS selector
const card = $.template('#user-card');

// Direct element reference
const tmplEl = document.querySelector<HTMLTemplateElement>('#user-card');
const card = $.template(tmplEl!);
```

## Type Definitions


```typescript
import type {
    StampOptions,      // { text, css, class, attrs, data, aria, on }
    StampMap,          // Record<string, string | StampOptions>
    TemplateConfig,    // { signal?, map? }
} from '@logosdx/dom';

import { TemplateStamper } from '@logosdx/dom';
```
