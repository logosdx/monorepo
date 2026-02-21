# @logosdx/dom Template Stamper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `$.template()` API that creates reusable `TemplateStamper` instances for cloning and hydrating HTML `<template>` elements with a declarative, configure-once-stamp-many pattern.

**Architecture:** New `TemplateStamper` class in `template.ts` that caches a `<template>` element and base config map. `stamp()` clones, merges per-instance data over base config, applies options using existing standalone functions (`css`, `attr`, `aria`, `data`, `on`, `classify`), and returns a `DomCollection`. A new `.into()` method on `DomCollection` handles DOM insertion.

**Tech Stack:** TypeScript, Vitest (JSDOM), existing @logosdx/dom standalone functions

**Design Doc:** `docs/plans/2026-02-21-dom-template-design.md`

---

### Task 1: Add types (StampOptions, StampMap, TemplateConfig)

**Files:**
- Modify: `packages/dom/src/types.ts`

**Step 1: Add the new types at the end of types.ts**

```ts
/** Options for hydrating a single element inside a stamped template clone */
export interface StampOptions {
    text?: string;
    css?: Record<string, string>;
    class?: string[];
    attrs?: Record<string, string>;
    data?: Record<string, string>;
    aria?: Record<string, string>;
    on?: Record<string, EvListener>;
}

/** Map of CSS selectors to hydration options (string shorthand = { text }) */
export type StampMap = Record<string, string | StampOptions>;

/** Configuration for $.template() — base map + signal */
export interface TemplateConfig extends SignalOptions {
    map?: StampMap;
}
```

**Step 2: Commit**

```bash
git add packages/dom/src/types.ts
git commit -m "feat(dom): add StampOptions, StampMap, and TemplateConfig types"
```

---

### Task 2: Add `.into()` to DomCollection — TDD

**Files:**
- Create: `tests/src/dom/template.test.ts`
- Modify: `packages/dom/src/collection.ts`

**Step 1: Write the failing test for `.into()`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { DomCollection } from '../../../packages/dom/src/collection.ts';
import { create } from '../../../packages/dom/src/dom.ts';

describe('@logosdx/dom: DomCollection.into', () => {

    afterEach(() => {

        document.body.innerHTML = '';
    });

    it('should append all elements into container', () => {

        const container = create('div');
        document.body.appendChild(container);

        const el1 = create('span', { text: 'one' });
        const el2 = create('span', { text: 'two' });
        const collection = new DomCollection([el1, el2]);

        const result = collection.into(container);

        expect(container.children.length).toBe(2);
        expect(container.children[0]).toBe(el1);
        expect(container.children[1]).toBe(el2);
        expect(result).toBe(collection);
    });

    it('should return this for chaining', () => {

        const container = create('div');
        const el = create('span');
        const collection = new DomCollection([el]);

        const result = collection.into(container);

        expect(result).toBe(collection);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test template`
Expected: FAIL — `collection.into is not a function`

**Step 3: Implement `.into()` on DomCollection**

Add this method to `DomCollection` class in `collection.ts`, after the `emit` method (around line 338):

```ts
    into(container: Element): this {

        for (const el of this.#elements) {

            container.appendChild(el);
        }

        return this;
    }
```

**Step 4: Run test to verify it passes**

Run: `pnpm test template`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/dom/src/collection.ts tests/src/dom/template.test.ts
git commit -m "feat(dom): add .into() method to DomCollection"
```

---

### Task 3: Implement TemplateStamper — single stamp TDD

**Files:**
- Create: `packages/dom/src/template.ts`
- Modify: `tests/src/dom/template.test.ts`

**Step 1: Write the failing tests for single stamp**

Append to `tests/src/dom/template.test.ts`:

```ts
import { TemplateStamper } from '../../../packages/dom/src/template.ts';

describe('@logosdx/dom: TemplateStamper', () => {

    afterEach(() => {

        document.body.innerHTML = '';
    });

    function createTemplate(id: string, html: string): HTMLTemplateElement {

        const tmpl = document.createElement('template');
        tmpl.id = id;
        tmpl.innerHTML = html;
        document.body.appendChild(tmpl);
        return tmpl;
    }

    describe('constructor', () => {

        it('should accept a CSS selector string', () => {

            createTemplate('t1', '<div class="card"><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t1');
            const result = stamper.stamp({});

            expect(result.length).toBe(1);
            expect(result.first!.classList.contains('card')).toBe(true);
        });

        it('should accept an HTMLTemplateElement directly', () => {

            const tmpl = createTemplate('t2', '<div class="card"></div>');
            const stamper = new TemplateStamper(tmpl);
            const result = stamper.stamp({});

            expect(result.length).toBe(1);
        });

        it('should throw if selector does not match a template', () => {

            expect(() => new TemplateStamper('#nonexistent')).toThrow();
        });
    });

    describe('stamp: single', () => {

        it('should set text via string shorthand', () => {

            createTemplate('t3', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t3');

            const result = stamper.stamp({ '.name': 'Alice' });

            expect(result.first!.querySelector('.name')!.textContent).toBe('Alice');
        });

        it('should set text via StampOptions object', () => {

            createTemplate('t4', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t4');

            const result = stamper.stamp({ '.name': { text: 'Bob' } });

            expect(result.first!.querySelector('.name')!.textContent).toBe('Bob');
        });

        it('should apply css from StampOptions', () => {

            createTemplate('t5', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t5');

            const result = stamper.stamp({ '.name': { css: { color: 'red' } } });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.style.color).toBe('red');
        });

        it('should apply class from StampOptions', () => {

            createTemplate('t6', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t6');

            const result = stamper.stamp({ '.name': { class: ['active'] } });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.classList.contains('active')).toBe(true);
        });

        it('should apply attrs from StampOptions', () => {

            createTemplate('t7', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t7');

            const result = stamper.stamp({ '.name': { attrs: { 'data-id': '1' } } });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.getAttribute('data-id')).toBe('1');
        });

        it('should apply data-* attributes from StampOptions', () => {

            createTemplate('t8', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t8');

            const result = stamper.stamp({ '.name': { data: { userId: '42' } } });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.dataset.userId).toBe('42');
        });

        it('should apply aria attributes from StampOptions', () => {

            createTemplate('t9', '<div><button class="btn"></button></div>');
            const stamper = new TemplateStamper('#t9');

            const result = stamper.stamp({ '.btn': { aria: { label: 'Submit' } } });
            const btn = result.first!.querySelector('.btn') as HTMLElement;

            expect(btn.getAttribute('aria-label')).toBe('Submit');
        });

        it('should bind event listeners from StampOptions', () => {

            createTemplate('t10', '<div><button class="btn">Click</button></div>');
            const stamper = new TemplateStamper('#t10');
            const handler = vi.fn();

            const result = stamper.stamp({ '.btn': { on: { click: handler } } });
            document.body.appendChild(result.first!);
            const btn = result.first!.querySelector('.btn') as HTMLElement;
            btn.click();

            expect(handler).toHaveBeenCalledOnce();
        });

        it('should skip selectors that do not match any element in clone', () => {

            createTemplate('t11', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#t11');

            const result = stamper.stamp({ '.nonexistent': 'Hello', '.name': 'Alice' });

            expect(result.first!.querySelector('.name')!.textContent).toBe('Alice');
        });

        it('should handle templates with multiple root children', () => {

            createTemplate('t12', '<span>one</span><span>two</span>');
            const stamper = new TemplateStamper('#t12');

            const result = stamper.stamp({});

            expect(result.length).toBe(2);
        });
    });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test template`
Expected: FAIL — `TemplateStamper` not found or not implemented

**Step 3: Implement TemplateStamper in template.ts**

Create `packages/dom/src/template.ts`:

```ts
import { css } from './css.ts';
import { attr } from './attr.ts';
import { classify } from './class.ts';
import { data } from './data.ts';
import { aria } from './aria.ts';
import { on } from './events.ts';
import { DomCollection } from './collection.ts';
import type { StampOptions, StampMap, TemplateConfig, EvListener, SignalOptions } from './types.ts';

/**
 * Normalize a stamp map entry — string shorthand becomes { text }.
 */
function normalize(entry: string | StampOptions): StampOptions {

    return typeof entry === 'string' ? { text: entry } : entry;
}

/**
 * Shallow-merge two StampOptions — stamp values override base.
 */
function mergeOptions(base: StampOptions, stamp: StampOptions): StampOptions {

    return { ...base, ...stamp };
}

/**
 * Apply StampOptions to a single element using standalone DOM functions.
 */
function applyOptions(el: HTMLElement, opts: StampOptions, signal?: AbortSignal): void {

    if (opts.text) el.textContent = opts.text;
    if (opts.class) classify.add(el, opts.class);
    if (opts.css) css(el, opts.css);
    if (opts.attrs) attr(el, opts.attrs);
    if (opts.data) data(el, opts.data);
    if (opts.aria) aria(el, opts.aria);

    if (opts.on) {

        for (const [event, handler] of Object.entries(opts.on)) {

            on(el, event, handler as EvListener,
                signal ? { signal } : undefined);
        }
    }
}

/**
 * Reusable template stamper — configure once, stamp many.
 *
 * Caches an HTML `<template>` element and a base configuration map.
 * Each `stamp()` call clones the template, merges per-instance data
 * over the base config, and returns a {@link DomCollection}.
 *
 * @example
 *     const card = new TemplateStamper('#user-card', {
 *         map: {
 *             '.username': { css: { fontWeight: 'bold' } },
 *             '.view-btn': { on: { click: handler } }
 *         }
 *     });
 *
 *     card.stamp({ '.username': 'Alice' }).into(container);
 *
 *     card.stamp(users, u => ({
 *         '.username': u.name
 *     })).into(container);
 */
export class TemplateStamper {

    #template: HTMLTemplateElement;
    #baseMap: StampMap;
    #signal: AbortSignal | undefined;

    constructor(source: string | HTMLTemplateElement, config?: TemplateConfig) {

        if (typeof source === 'string') {

            const el = document.querySelector<HTMLTemplateElement>(source);

            if (!el || !(el instanceof HTMLTemplateElement)) {

                throw new Error(`Template not found: ${source}`);
            }

            this.#template = el;
        }
        else {

            this.#template = source;
        }

        this.#baseMap = config?.map ?? {};
        this.#signal = config?.signal;
    }

    stamp(map: StampMap): DomCollection;
    stamp<T>(data: T[], mapper: (item: T) => StampMap): DomCollection;
    stamp<T>(
        mapOrData: StampMap | T[],
        mapper?: (item: T) => StampMap
    ): DomCollection {

        if (Array.isArray(mapOrData) && mapper) {

            const elements: HTMLElement[] = [];

            for (const item of mapOrData) {

                const collection = this.#stampOne(mapper(item));

                for (const el of collection.elements) {

                    elements.push(el);
                }
            }

            return new DomCollection(elements,
                this.#signal ? { signal: this.#signal } : undefined);
        }

        return this.#stampOne(mapOrData as StampMap);
    }

    #stampOne(instanceMap: StampMap): DomCollection {

        const clone = this.#template.content.cloneNode(true) as DocumentFragment;

        const allSelectors = new Set([
            ...Object.keys(this.#baseMap),
            ...Object.keys(instanceMap)
        ]);

        for (const selector of allSelectors) {

            const el = clone.querySelector<HTMLElement>(selector);
            if (!el) continue;

            const base = this.#baseMap[selector]
                ? normalize(this.#baseMap[selector])
                : {};
            const instance = instanceMap[selector]
                ? normalize(instanceMap[selector])
                : {};

            applyOptions(el, mergeOptions(base, instance), this.#signal);
        }

        const elements = Array.from(clone.children) as HTMLElement[];

        return new DomCollection(elements,
            this.#signal ? { signal: this.#signal } : undefined);
    }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test template`
Expected: All PASS

**Step 5: Commit**

```bash
git add packages/dom/src/template.ts tests/src/dom/template.test.ts
git commit -m "feat(dom): implement TemplateStamper with single stamp support"
```

---

### Task 4: Test base config merge + signal propagation

**Files:**
- Modify: `tests/src/dom/template.test.ts`

**Step 1: Write tests for merge behavior and signals**

Append inside the `@logosdx/dom: TemplateStamper` describe block:

```ts
    describe('stamp: base config merge', () => {

        it('should apply base config when stamp provides no override', () => {

            createTemplate('m1', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#m1', {
                map: { '.name': { css: { color: 'red' } } }
            });

            const result = stamper.stamp({ '.name': 'Alice' });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.textContent).toBe('Alice');
            expect(span.style.color).toBe('red');
        });

        it('should let stamp values override base values', () => {

            createTemplate('m2', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#m2', {
                map: { '.name': { text: 'Default' } }
            });

            const result = stamper.stamp({ '.name': 'Override' });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.textContent).toBe('Override');
        });

        it('should merge non-overlapping properties from both', () => {

            createTemplate('m3', '<div><span class="name"></span></div>');
            const stamper = new TemplateStamper('#m3', {
                map: { '.name': { css: { fontWeight: 'bold' }, class: ['base'] } }
            });

            const result = stamper.stamp({ '.name': { text: 'Alice', attrs: { 'data-id': '1' } } });
            const span = result.first!.querySelector('.name') as HTMLElement;

            expect(span.textContent).toBe('Alice');
            expect(span.style.fontWeight).toBe('bold');
            expect(span.classList.contains('base')).toBe(true);
            expect(span.getAttribute('data-id')).toBe('1');
        });

        it('should apply base config selectors not present in stamp', () => {

            createTemplate('m4', '<div><span class="name"></span><span class="email"></span></div>');
            const stamper = new TemplateStamper('#m4', {
                map: {
                    '.name': { css: { fontWeight: 'bold' } },
                    '.email': { css: { color: 'gray' } }
                }
            });

            const result = stamper.stamp({ '.name': 'Alice' });
            const email = result.first!.querySelector('.email') as HTMLElement;

            expect(email.style.color).toBe('gray');
        });
    });

    describe('stamp: signal propagation', () => {

        it('should propagate signal to event listeners', () => {

            createTemplate('s1', '<div><button class="btn">Click</button></div>');
            const controller = new AbortController();
            const stamper = new TemplateStamper('#s1', { signal: controller.signal });
            const handler = vi.fn();

            const result = stamper.stamp({ '.btn': { on: { click: handler } } });
            document.body.appendChild(result.first!);
            const btn = result.first!.querySelector('.btn') as HTMLElement;

            btn.click();
            expect(handler).toHaveBeenCalledOnce();

            controller.abort();
            btn.click();
            expect(handler).toHaveBeenCalledOnce();
        });
    });
```

**Step 2: Run tests**

Run: `pnpm test template`
Expected: All PASS (implementation already handles these cases)

**Step 3: Commit**

```bash
git add tests/src/dom/template.test.ts
git commit -m "test(dom): add base config merge and signal propagation tests"
```

---

### Task 5: Test array stamp (stamp many)

**Files:**
- Modify: `tests/src/dom/template.test.ts`

**Step 1: Write tests for array stamping**

Append inside the `@logosdx/dom: TemplateStamper` describe block:

```ts
    describe('stamp: array (stamp many)', () => {

        it('should stamp multiple items from data array', () => {

            createTemplate('a1', '<div class="card"><span class="name"></span></div>');
            const stamper = new TemplateStamper('#a1');

            const users = [{ name: 'Alice' }, { name: 'Bob' }];
            const result = stamper.stamp(users, u => ({ '.name': u.name }));

            expect(result.length).toBe(2);
            expect(result.at(0)!.querySelector('.name')!.textContent).toBe('Alice');
            expect(result.at(1)!.querySelector('.name')!.textContent).toBe('Bob');
        });

        it('should apply base config to all stamped items', () => {

            createTemplate('a2', '<div class="card"><span class="name"></span></div>');
            const stamper = new TemplateStamper('#a2', {
                map: { '.name': { css: { fontWeight: 'bold' } } }
            });

            const users = [{ name: 'Alice' }, { name: 'Bob' }];
            const result = stamper.stamp(users, u => ({ '.name': u.name }));
            const span0 = result.at(0)!.querySelector('.name') as HTMLElement;
            const span1 = result.at(1)!.querySelector('.name') as HTMLElement;

            expect(span0.textContent).toBe('Alice');
            expect(span0.style.fontWeight).toBe('bold');
            expect(span1.textContent).toBe('Bob');
            expect(span1.style.fontWeight).toBe('bold');
        });

        it('should return empty collection for empty data array', () => {

            createTemplate('a3', '<div class="card"></div>');
            const stamper = new TemplateStamper('#a3');

            const result = stamper.stamp([], () => ({}));

            expect(result.length).toBe(0);
        });

        it('should chain .into() after array stamp', () => {

            createTemplate('a4', '<div class="card"><span class="name"></span></div>');
            const container = create('div');
            document.body.appendChild(container);

            const stamper = new TemplateStamper('#a4');
            const users = [{ name: 'Alice' }, { name: 'Bob' }];

            stamper.stamp(users, u => ({ '.name': u.name })).into(container);

            expect(container.children.length).toBe(2);
        });
    });
```

**Step 2: Run tests**

Run: `pnpm test template`
Expected: All PASS

**Step 3: Commit**

```bash
git add tests/src/dom/template.test.ts
git commit -m "test(dom): add array stamp tests for TemplateStamper"
```

---

### Task 6: Wire up exports — $.template and package exports

**Files:**
- Modify: `packages/dom/src/index.ts`

**Step 1: Write a failing test for $.template**

Append to the test file, in a new top-level describe:

```ts
import { $ } from '../../../packages/dom/src/index.ts';

describe('@logosdx/dom: $.template', () => {

    afterEach(() => {

        document.body.innerHTML = '';
    });

    function createTemplate(id: string, html: string): HTMLTemplateElement {

        const tmpl = document.createElement('template');
        tmpl.id = id;
        tmpl.innerHTML = html;
        document.body.appendChild(tmpl);
        return tmpl;
    }

    it('should create a TemplateStamper via $.template()', () => {

        createTemplate('e1', '<div><span class="name"></span></div>');

        const stamper = $.template('#e1', {
            map: { '.name': { css: { fontWeight: 'bold' } } }
        });

        const result = stamper.stamp({ '.name': 'Alice' });

        expect(result.first!.querySelector('.name')!.textContent).toBe('Alice');
    });

    it('should accept a template element directly', () => {

        const tmpl = createTemplate('e2', '<div><span class="name"></span></div>');

        const stamper = $.template(tmpl);
        const result = stamper.stamp({ '.name': 'Bob' });

        expect(result.first!.querySelector('.name')!.textContent).toBe('Bob');
    });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test template`
Expected: FAIL — `$.template is not a function`

**Step 3: Add $.template and exports to index.ts**

Add import at top of `packages/dom/src/index.ts`:

```ts
import { TemplateStamper } from './template.ts';
import type { TemplateConfig } from './types.ts';
```

Add after `$.create` definition (after line 52):

```ts
/**
 * Create a reusable {@link TemplateStamper} for an HTML `<template>` element.
 *
 * @example
 *     const card = $.template('#user-card', {
 *         map: { '.name': { css: { fontWeight: 'bold' } } }
 *     });
 *     card.stamp({ '.name': 'Alice' }).into(container);
 */
$.template = function templateFn(
    source: string | HTMLTemplateElement,
    config?: TemplateConfig
): TemplateStamper {

    return new TemplateStamper(source, config);
} as (
    source: string | HTMLTemplateElement,
    config?: TemplateConfig
) => TemplateStamper;
```

Add to re-exports section:

```ts
export { TemplateStamper } from './template.ts';
export type { StampOptions, StampMap, TemplateConfig } from './types.ts';
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test template`
Expected: All PASS

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All existing tests still pass

**Step 6: Commit**

```bash
git add packages/dom/src/index.ts
git commit -m "feat(dom): wire up $.template() and TemplateStamper exports"
```

---

### Task 7: Build verification

**Step 1: Run the build**

Run: `pnpm build`
Expected: Build succeeds with no errors

**Step 2: If build fails, fix type issues and re-run**

**Step 3: Commit any build-related fixes**

---

### Task 8: Update documentation

**Files:**
- Modify: `skills/logosdx/references/dom.md` (add Template section)
- Modify: `docs/cheat-sheet.md` (add template example if appropriate)

**Step 1: Add Template Stamper section to `skills/logosdx/references/dom.md`**

Add after the DOM Manipulation section (before Widget Lifecycle Example):

```md
## Templates — Clone & Hydrate

```ts
import { $, TemplateStamper } from '@logosdx/dom';

// Configure once — base styling, events, accessibility
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

// Stamp single — per-instance data merges with base config
userCard.stamp({
    '.username': 'Alice Johnson',
    '.user-email': 'alice@example.com',
    '.view-profile': { attrs: { 'data-id': '1' } }
}).into(container);

// Stamp many — mapper function per data item
userCard.stamp(users, u => ({
    '.username': u.name,
    '.user-email': u.email,
    '.view-profile': { data: { userId: u.id } }
})).into(container);

// String shorthand — equivalent to { text: '...' }
stamper.stamp({ '.name': 'Alice' });
// Same as:
stamper.stamp({ '.name': { text: 'Alice' } });

// StampOptions per selector: text, css, class, attrs, data, aria, on
// Base config + stamp data are shallow-merged per selector (stamp wins on conflict)
```
```

**Step 2: Commit**

```bash
git add skills/logosdx/references/dom.md docs/cheat-sheet.md
git commit -m "docs(dom): add template stamper documentation"
```

---

### Task 9: Final verification

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Run build**

Run: `pnpm build`
Expected: Clean build

**Step 3: Review git log to verify all commits are clean**

Run: `git log --oneline -10`
