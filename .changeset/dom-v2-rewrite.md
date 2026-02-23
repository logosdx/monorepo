---
"@logosdx/dom": major
---

## Breaking Changes

### Complete v2 rewrite with `$` selector API

The DOM package has been completely rewritten with a new chainable API built around the `$` selector function and `DomCollection` class. The previous API surface has been replaced entirely.

**Before:**
```ts
import { createElWith } from '@logosdx/dom';

const el = createElWith('div', {
    attrs: { id: 'container' },
    css: { backgroundColor: 'blue' },
    events: { click: handler }
});
```

**After:**
```ts
import { $ } from '@logosdx/dom';

$('div')
    .attr.set('id', 'container')
    .css.set({ backgroundColor: 'blue' })
    .events.on('click', handler);
```

## Added

* `feat(dom):` Add `$` selector with `DomCollection` chainable callable namespaces
* `feat(dom):` Add `css` module with get/set/remove and custom properties
* `feat(dom):` Add `attr`, `class`, `data`, and `aria` modules
* `feat(dom):` Add `events`, DOM manipulation, and `animate` modules
* `feat(dom):` Add `observe`, `watch`, and viewport modules
* `feat(dom):` Add `TemplateStamper` with `$.template()` and `DomCollection.into()`
* `feat(dom):` Add `StampOptions`, `StampMap`, and `TemplateConfig` types

## Fixed

* `fix(dom):` Add generic type argument to `DomCollection` in `TemplateStamper`
