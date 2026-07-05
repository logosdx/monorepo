---
type: Domain
---

# localize

## What it does

`@logosdx/localize` provides internationalization with full TypeScript type safety. It supports path-based message retrieval using `PathLeaves<T>`, locale switching with fallbacks, ICU-style pluralization, `Intl.*` formatting, template string interpolation, scoped namespaces, async locale loading, and a CLI type extractor.

## Artifacts

- [`skills/logosdx/references/localize.md`](../../skills/logosdx/references/localize.md) — skill reference (454 LOC) covering translations, pluralization, Intl formatting, namespaces, async loading, type extractor

## CLI code

- [`packages/localize/src/manager.ts`](../../packages/localize/src/manager.ts) — `LocaleManager` class (309 LOC); core i18n engine
- [`packages/localize/src/plural.ts`](../../packages/localize/src/plural.ts) — ICU pluralization logic (88 LOC)
- [`packages/localize/src/intl.ts`](../../packages/localize/src/intl.ts) — `Intl.*` formatting integration (79 LOC)
- [`packages/localize/src/helpers.ts`](../../packages/localize/src/helpers.ts) — shared helpers (165 LOC)
- [`packages/localize/src/scoped.ts`](../../packages/localize/src/scoped.ts) — scoped namespace support (46 LOC)
- [`packages/localize/src/extractor.ts`](../../packages/localize/src/extractor.ts) — type extraction logic (152 LOC)
- [`packages/localize/src/cli.ts`](../../packages/localize/src/cli.ts) — CLI entry point for running the type extractor (101 LOC)
- [`packages/localize/src/types.ts`](../../packages/localize/src/types.ts) — type definitions (59 LOC)
- [`packages/localize/src/index.ts`](../../packages/localize/src/index.ts) — barrel exports

## Docs

- [`docs/packages/localize/index.md`](../packages/localize/index.md) — overview
- [`docs/packages/localize/api.md`](../packages/localize/api.md) — API reference
- [`docs/packages/localize/async-loading.md`](../packages/localize/async-loading.md) — async locale loading
- [`docs/packages/localize/events.md`](../packages/localize/events.md) — locale change events
- [`docs/packages/localize/intl.md`](../packages/localize/intl.md) — Intl formatting integration
- [`docs/packages/localize/namespaces.md`](../packages/localize/namespaces.md) — namespace scoping
- [`docs/packages/localize/pluralization.md`](../packages/localize/pluralization.md) — ICU pluralization
- [`docs/packages/localize/translations.md`](../packages/localize/translations.md) — translation management
- [`docs/packages/localize/type-extractor.md`](../packages/localize/type-extractor.md) — CLI type extractor docs

## Coupling

- Depends on `@logosdx/utils` for flow control, validation helpers.
- `@logosdx/react` wraps `LocaleManager` via `createLocalizeContext` in [`packages/react/src/localize.ts`](../../packages/react/src/localize.ts).
- Tests in [`tests/src/localize.ts`](../../tests/src/localize.ts) (835 LOC) and [`tests/src/localize-extractor.ts`](../../tests/src/localize-extractor.ts) (426 LOC).
- [`tests/src/smoke/localize.test.ts`](../../tests/src/smoke/localize.test.ts) runs browser smoke tests.
- Example app locale files at [`example/locales/en.json`](../../example/locales/en.json), `es.json`, `fr.json`.

## Conventions worth knowing

- Path-based message retrieval uses `PathLeaves<T>` — the type system enforces valid translation keys at compile time.
- The CLI type extractor ([`packages/localize/src/cli.ts`](../../packages/localize/src/cli.ts)) generates TypeScript types from locale JSON files.
- `LocaleManager` emits change events on locale switch; consumers subscribe for reactive UI updates.
- Scoped namespaces allow subsystems to own their own translation keys without polluting the global namespace.
