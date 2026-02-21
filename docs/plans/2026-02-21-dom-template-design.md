# @logosdx/dom Template Stamper Design

**Date**: 2026-02-21
**Package**: `@logosdx/dom`
**Status**: Approved


## Problem

HTML `<template>` elements are a native browser feature for reusable markup, but using them requires verbose imperative code — `cloneNode(true)`, `querySelector` per field, manual `textContent` assignment, event binding, etc. The @logosdx/dom package already provides a clean declarative API for creating elements (`$.create()`) but has no equivalent for cloning and hydrating templates.


## Design

### Core Concept: Configure Once, Stamp Many

`$.template()` returns a `TemplateStamper` that caches a template element and a base configuration map. Each `stamp()` call clones the template, merges per-instance data over the base config, and returns a `DomCollection`.

### API Surface

```ts
// 1. Create stamper — accepts selector or element
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

// 2. Stamp single — per-instance data merges with base config
userCard.stamp({
    '.username': 'Alice Johnson',
    '.user-email': 'alice@example.com',
    '.view-profile': { attrs: { 'data-id': '1' } }
}).into(container);

// 3. Stamp many — mapper function per data item
userCard.stamp(users, u => ({
    '.username': u.name,
    '.user-email': u.email,
    '.view-profile': { data: { userId: u.id } }
})).into(container);
```

### Map Entry Options

Each selector in the map can be a **string shorthand** (equivalent to `{ text: '...' }`) or a full **StampOptions** object:

```ts
interface StampOptions {
    text?: string;
    css?: Record<string, string>;
    class?: string[];
    attrs?: Record<string, string>;
    data?: Record<string, string>;
    aria?: Record<string, string>;
    on?: Record<string, EvListener>;
}

type StampMap = Record<string, string | StampOptions>;
```

This mirrors the declarative shape of `CreateOptions` but applies to existing elements inside the cloned template.

### Template Configuration

```ts
interface TemplateConfig extends SignalOptions {
    map?: StampMap;
}
```

### TemplateStamper Class

```ts
class TemplateStamper {
    constructor(source: string | HTMLTemplateElement, config?: TemplateConfig);
    stamp(map: StampMap): DomCollection;
    stamp<T>(data: T[], mapper: (item: T) => StampMap): DomCollection;
}
```

### DomCollection Addition: `.into()`

```ts
// New method on DomCollection
into(container: Element): this;
// Appends all elements into container, returns this for chaining
```


## Merge Behavior

When `stamp()` is called, per-instance map entries are shallow-merged per selector over the base config:

- String values in stamp expand to `{ text: '...' }` before merging
- Stamp values override base values for the same property
- Non-overlapping properties from both base and stamp are preserved
- Example: base `{ css: { color: 'gray' } }` + stamp `{ text: 'Alice' }` → both apply


## Edge Cases

| Case | Behavior |
|------|----------|
| Template with multiple root children | All become part of the returned DomCollection |
| Selector in map doesn't match anything in clone | Silently skip (optional elements) |
| Empty stamp `stamper.stamp({})` | Returns clone with only base config applied |
| Merge conflict (base has `text`, stamp has `text`) | Stamp wins |


## File Structure

```
packages/dom/src/
├── template.ts          # TemplateStamper class + stamp logic
├── collection.ts        # Add .into() method
├── types.ts             # Add StampOptions, StampMap, TemplateConfig
└── index.ts             # Export TemplateStamper, add $.template
```


## Internals

1. `$.template(source, config?)` — resolves selector to `<template>` element, stores element + base map in `TemplateStamper`
2. `stamp(map)` — clones `template.content` via `cloneNode(true)`, normalizes string values to `{ text }`, merges stamp map over base map per selector, applies each entry using existing standalone functions (`css()`, `attr()`, `aria()`, `data()`, `on()`, `classify.add()`, `.textContent`), wraps root element(s) in `DomCollection`
3. `stamp(data, mapper)` — maps each item through mapper, calls single-stamp for each, collects all root elements into one `DomCollection`
4. Signal from config propagates to all `on()` calls during stamping
5. `.into(container)` — calls `append(container, ...this.elements)`, returns `this`
