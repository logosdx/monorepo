---
type: Domain
---

# testing

## What it does

The [`tests/`](../../tests) workspace runs the full validation suite for all packages. It uses Vitest with two project configs: a `unit` project running in jsdom, and a `browser` project running smoke tests in headless Chromium via Playwright. Tests import packages via relative paths to validate source directly without going through the build.

## Artifacts

(none — no skills or commands specific to this domain)

## CLI code

- [`tests/vitest.config.ts`](../../tests/vitest.config.ts) — dual-project vitest config (unit: jsdom + forks; browser: Playwright/Chromium)
- [`tests/src/_helpers.ts`](../../tests/src/_helpers.ts) — shared helpers: `setup`, `teardown`, `mockHelpers`, `calledExactly`, `calledMoreThan`, `runTimers`, `nextTick`, Sinon `sandbox`
- [`tests/src/setup.ts`](../../tests/src/setup.ts) — global setup file (runs before each test file)
- [`tests/src/_playground.ts`](../../tests/src/_playground.ts) — scratch file, excluded from test runs
- [`tests/src/utils/`](../../tests/src/utils) — unit tests for `@logosdx/utils` (flow-control, data-structures, misc, units, validation); `misc.ts` includes behavior-locking coverage for `makeNestedConfig`'s state cache and update functions (cache invalidation, override accumulation/layering order, non-object override guards)
- [`tests/src/dom/`](../../tests/src/dom) — 14 unit test files for `@logosdx/dom`
- [`tests/src/fetch/`](../../tests/src/fetch) — unit tests for `@logosdx/fetch` (engine, cookies, policies, options, properties, serializers, state, adapters)
- [`tests/src/observable/`](../../tests/src/observable) — unit tests for `@logosdx/observer` (engine, queue, relay)
- [`tests/src/react/`](../../tests/src/react) — unit tests for `@logosdx/react` (10 files)
- [`tests/src/storage/`](../../tests/src/storage) — unit tests for `@logosdx/storage`
- [`tests/src/hooks.ts`](../../tests/src/hooks.ts) — unit tests for `@logosdx/hooks` (1462 LOC)
- [`tests/src/localize.ts`](../../tests/src/localize.ts) — unit tests for `@logosdx/localize` (835 LOC)
- [`tests/src/localize-extractor.ts`](../../tests/src/localize-extractor.ts) — unit tests for the localize type extractor (426 LOC)
- [`tests/src/state-machine.ts`](../../tests/src/state-machine.ts) — unit tests for `@logosdx/state-machine` (1499 LOC)
- [`tests/src/smoke/`](../../tests/src/smoke) — browser smoke tests run against Chromium (dom, fetch, hooks, localize, observer, state-machine, storage, utils)
- [`tests/src/_memory-tests/`](../../tests/src/_memory-tests) — memory leak detection harness with scenarios and UI; run via `pnpm memory`
- [`tests/benchmark/`](../../tests/benchmark) — performance benchmarks (priority-queue, queue)

## Docs

- [`tests/CLAUDE.md`](../../tests/CLAUDE.md) — test conventions, import strategy, mock patterns, 9-strategy testing framework

## Coupling

- All test files import packages via relative paths (e.g., `../../../../packages/utils/src/index.ts`) — not package names. Any source restructuring breaks test imports.
- Memory tests use `--expose-gc` and the custom harness in [`tests/src/_memory-tests/harness.ts`](../../tests/src/_memory-tests/harness.ts).

## Conventions worth knowing

- Test naming: `describe('@logosdx/[package-name]', ...)` or `describe('module: feature', ...)`.
- Vitest globals are enabled — no need to import `describe`, `it`, `expect`.
- `calledExactly(fn, count, msg)` helper from `_helpers.ts` is the preferred call-count assertion.
- Pool is `forks` (isolated processes per test file) — no shared state between test files.
- Two test commands: `pnpm test` (full suite), `pnpm tdd` (watch mode), `pnpm test:ci` (CI mode with GitHub Actions reporter, run from [`tests/`](../../tests) directory).
