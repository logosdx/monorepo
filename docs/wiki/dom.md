---
type: Domain
---

# dom

## What it does

`@logosdx/dom` provides type-safe browser DOM utilities for element creation, CSS and attribute management, event handling with cleanup, animations, ARIA roles, MutationObserver integration, viewport detection, and template rendering.

## Artifacts

- [`skills/logosdx/references/dom.md`](../../skills/logosdx/references/dom.md) — skill reference (355 LOC) covering DOM manipulation, CSS, attributes, events, behaviors

## CLI code

- [`packages/dom/src/collection.ts`](../../packages/dom/src/collection.ts) — `DomCollection` class (384 LOC); jQuery-like collection API
- [`packages/dom/src/template.ts`](../../packages/dom/src/template.ts) — template rendering (154 LOC)
- [`packages/dom/src/events.ts`](../../packages/dom/src/events.ts) — event binding with cleanup (115 LOC)
- [`packages/dom/src/animate.ts`](../../packages/dom/src/animate.ts) — animation utilities (96 LOC)
- [`packages/dom/src/aria.ts`](../../packages/dom/src/aria.ts) — ARIA attribute management (147 LOC)
- [`packages/dom/src/attr.ts`](../../packages/dom/src/attr.ts) — attribute manipulation (85 LOC)
- [`packages/dom/src/class.ts`](../../packages/dom/src/class.ts) — class management (90 LOC)
- [`packages/dom/src/css.ts`](../../packages/dom/src/css.ts) — style/CSS utilities (96 LOC)
- [`packages/dom/src/data.ts`](../../packages/dom/src/data.ts) — dataset utilities (68 LOC)
- [`packages/dom/src/dom.ts`](../../packages/dom/src/dom.ts) — core DOM helpers (113 LOC)
- [`packages/dom/src/helpers.ts`](../../packages/dom/src/helpers.ts) — shared helpers (109 LOC)
- [`packages/dom/src/observe.ts`](../../packages/dom/src/observe.ts) — MutationObserver integration (81 LOC)
- [`packages/dom/src/viewport.ts`](../../packages/dom/src/viewport.ts) — viewport detection (84 LOC)
- [`packages/dom/src/watch.ts`](../../packages/dom/src/watch.ts) — DOM watch utilities (98 LOC)
- [`packages/dom/src/types.ts`](../../packages/dom/src/types.ts) — type definitions (75 LOC)
- [`packages/dom/src/index.ts`](../../packages/dom/src/index.ts) — barrel exports (91 LOC)

## Docs

- [`docs/packages/dom/index.md`](../packages/dom/index.md) — overview
- [`docs/packages/dom/animate.md`](../packages/dom/animate.md) — animation API
- [`docs/packages/dom/aria.md`](../packages/dom/aria.md) — ARIA management
- [`docs/packages/dom/events.md`](../packages/dom/events.md) — event handling
- [`docs/packages/dom/observers.md`](../packages/dom/observers.md) — MutationObserver integration
- [`docs/packages/dom/selection.md`](../packages/dom/selection.md) — element selection
- [`docs/packages/dom/styling.md`](../packages/dom/styling.md) — CSS and styling
- [`docs/packages/dom/templates.md`](../packages/dom/templates.md) — template rendering

## Coupling

- Depends on `@logosdx/utils` for validation and flow control helpers.
- No dependency on `@logosdx/observer` (has its own event binding pattern).
- Tests in [`tests/src/dom/`](../../tests/src/dom) cover all 14 modules (animate, aria, attr, class, collection, css, data, dom, events, observe, template, viewport, watch, index).
- [`tests/src/smoke/dom.test.ts`](../../tests/src/smoke/dom.test.ts) runs browser smoke tests via Playwright/Chromium.

## Conventions worth knowing

- All event-binding utilities return cleanup functions — callers must call cleanup on unmount or component destroy.
- `DomCollection` is the central collection class; the `$()` selector creates a `DomCollection`.
- DOM tests run in jsdom environment; smoke tests run in a real Chromium browser via Playwright.
