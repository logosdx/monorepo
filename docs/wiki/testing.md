---
type: Domain
---

# testing

## What it does

The [`tests/`](../../tests) workspace runs the full validation suite for all packages. It uses Vitest with two project configs: a `unit` project running in jsdom, and a `browser` project running smoke tests in headless Chromium via Playwright. Unit tests import each package under test via relative paths to its `src/`, but that source's own `@logosdx/*` imports resolve to the dependency's built `dist/`, and smoke tests load `packages/<pkg>/dist/browser/` outright. A touched package must be rebuilt before a test run proves anything.

## Artifacts

(none — no skills or commands specific to this domain)

## CLI code

- [`tests/vitest.config.ts`](../../tests/vitest.config.ts) — dual-project vitest config (unit: jsdom + forks; browser: Playwright/Chromium)
- [`tests/src/_helpers.ts`](../../tests/src/_helpers.ts) — shared helpers: `setup`, `teardown`, `mockHelpers`, `calledExactly`, `calledMoreThan`, `runTimers`, `nextTick`, Sinon `sandbox`
- [`tests/src/setup.ts`](../../tests/src/setup.ts) — global setup file (runs before each test file)
- [`tests/src/_playground.ts`](../../tests/src/_playground.ts) — scratch file, excluded from test runs
- [`tests/src/utils/`](../../tests/src/utils) — unit tests for `@logosdx/utils` (flow-control, data-structures, misc, units, validation); `misc.ts` includes behavior-locking coverage for `makeNestedConfig`'s state cache and update functions (cache invalidation, override accumulation/layering order, non-object override guards)
- [`tests/src/dom/`](../../tests/src/dom) — unit tests for `@logosdx/dom`
- [`tests/src/fetch/`](../../tests/src/fetch) — unit tests for `@logosdx/fetch` (engine, cookies, policies, options, properties, serializers, state, adapters); [`tests/src/fetch/engine/configuration.test.ts`](../../tests/src/fetch/engine/configuration.test.ts) and [`tests/src/fetch/engine/plugin-resolution.test.ts`](../../tests/src/fetch/engine/plugin-resolution.test.ts) cover the plugin `reconfigure` mechanism (`config.set()` rebuilding policy state) and policy-ownership rules (config-key vs `plugins:` array conflicts); [`tests/src/fetch/executor/retry.test.ts`](../../tests/src/fetch/executor/retry.test.ts) covers `attemptTimeout` firing when retrying is disabled (`retry: false` / `maxAttempts: 0`)
- [`tests/src/observable/`](../../tests/src/observable) — unit tests for `@logosdx/observer` (engine, queue, relay)
- [`tests/src/react/`](../../tests/src/react) — unit tests for `@logosdx/react`
- [`tests/src/storage/`](../../tests/src/storage) — unit tests for `@logosdx/storage`
- [`tests/src/hooks.ts`](../../tests/src/hooks.ts) — unit tests for `@logosdx/hooks`, including direct coverage for `addPipe()`/`pipe()`/`pipeSync()` (onion middleware, priority ordering, cast-free typed registration)
- [`tests/src/localize.ts`](../../tests/src/localize.ts) — unit tests for `@logosdx/localize`
- [`tests/src/localize-extractor.ts`](../../tests/src/localize-extractor.ts) — unit tests for the localize type extractor
- [`tests/src/state-machine.ts`](../../tests/src/state-machine.ts) — unit tests for `@logosdx/state-machine`
- [`tests/src/slides/`](../../tests/src/slides) — jsdom unit tests for `@logosdx/slides` (`Deck`, fragments, `keys.ts`, notes, `upgrade.ts`, `url.ts`)
- [`tests/src/slides/_helpers.ts`](../../tests/src/slides/_helpers.ts) — `stubDeckLayout()`: registers its own `beforeEach`/`afterEach`, stubs `IntersectionObserver` and `Element.prototype.scrollIntoView` (jsdom has neither), clears `location.hash`, and returns `intersect`/`arrive` to report which slide sits under the deck's center plus `pressKey`, `tick`, `shownIds`, `activeIds`; the fixture root must be `#deck`
- [`tests/src/smoke/`](../../tests/src/smoke) — browser smoke tests run against Chromium (dom, fetch, hooks, localize, observer, slides, state-machine, storage, utils)
- [`tests/src/smoke/setup.ts`](../../tests/src/smoke/setup.ts) — browser setup file; puts three helpers on `window`, all reading `/@fs/<__PACKAGES_ROOT__>/<pkg>/dist/browser/<file>`: `__fetchPackageAsset(pkg, file, init?)` returns the file text, `__loadBundle(pkg, doc = document)` runs `bundle.js` as a blob `<script>` in the given document (an iframe's document works), and `__loadStylesheet(pkg, file)` injects the CSS as a `<style>` (it sends `accept: text/css`, since Vite otherwise answers a `.css` URL with its JS HMR module)
- [`tests/src/smoke/globals.d.ts`](../../tests/src/smoke/globals.d.ts) — types `window.LogosDx` as the `LogosDxBundles` interface (currently `Slides: { Deck }`), so smoke tests reach a bundle's namespace without casts
- [`tests/src/smoke/bundle-scope.test.ts`](../../tests/src/smoke/bundle-scope.test.ts) — for every package's IIFE bundle: loading it into a blank blob-URL iframe adds no page global besides `LogosDx` (`setImmediate`/`clearImmediate` polyfills from `@logosdx/utils` excepted); `bundle.js` is exactly `this.LogosDx = this.LogosDx || {}; this.LogosDx.<Namespace> = <expression>` with nothing trailing; and it loads beside a page's own top-level `const s` and `function h` without a redeclaration error
- [`tests/src/smoke/slides.test.ts`](../../tests/src/smoke/slides.test.ts) — loads `slides.css` and the slides bundle in Chromium at an 800x600 viewport; covers CSS-only layout, navigation (active tracking, keys, interrupted moves), fragments and URL hash, and speaker notes; emulates `prefers-reduced-motion` via `cdp()`
- [`tests/src/smoke/slides-init.test.ts`](../../tests/src/smoke/slides-init.test.ts) — loading the slides bundle auto-creates a `Deck` for a `<slides>` element (sets `data-ready`, a second `new Deck()` throws `already live`) and leaves `<slides manual>` untouched
- [`tests/src/_memory-tests/`](../../tests/src/_memory-tests) — memory leak detection harness with scenarios and UI; run via `pnpm memory`
- [`tests/benchmark/`](../../tests/benchmark) — performance benchmarks (priority-queue, queue)

## Docs

- [`tests/CLAUDE.md`](../../tests/CLAUDE.md) — test conventions, import strategy, mock patterns, 9-strategy testing framework

## Coupling

- All test files import packages via relative paths (e.g., `../../../../packages/utils/src/index.ts`) — not package names. Any source restructuring breaks test imports.
- Smoke tests read `packages/<pkg>/dist/browser/` through Vite's `/@fs/` route (`__PACKAGES_ROOT__` is defined in [`tests/vitest.config.ts`](../../tests/vitest.config.ts)); `bundle-scope.test.ts` iterates a hardcoded package-to-namespace map, so a new package's bundle needs an entry there.
- Memory tests use `--expose-gc` and the custom harness in [`tests/src/_memory-tests/harness.ts`](../../tests/src/_memory-tests/harness.ts).

## Conventions worth knowing

- Test naming: `describe('@logosdx/[package-name]', ...)` or `describe('module: feature', ...)`.
- Vitest globals are enabled — no need to import `describe`, `it`, `expect`.
- `calledExactly(fn, count, msg)` helper from `_helpers.ts` is the preferred call-count assertion.
- Pool is `forks` (isolated processes per test file) — no shared state between test files.
- Test commands: `pnpm test` (full suite), `pnpm tdd` (watch mode), `pnpm test:ci` (CI mode with GitHub Actions reporter, run from [`tests/`](../../tests) directory).
