---
type: Index
---

<wiki-type>repo</wiki-type>
<scan-sha>a566c4bbff85f71f4f00bfd03631e06791ed732f</scan-sha>
<wiki-schema>1</wiki-schema>

# Project signals

## Framework & runtime

- Language: TypeScript 5.9, Node 22/24 (CI), pnpm 10 workspaces
- Build: SWC (via `@swc/cli`/`@swc/core`); outputs ESM (`.mjs`), CJS (`.js`), UMD, `.d.ts`
- Test: Vitest (dual project: jsdom unit + Playwright/Chromium browser)
- Docs: VitePress 2.0.0-alpha.16 + TypeDoc; deployed to `logosdx.dev`
- Release: Changesets (`@changesets/cli`) with `release` branch publish flow

## Build / test / lint

| Purpose | Command | Source |
|---------|---------|--------|
| Build all packages | `pnpm build` | [`scripts/build.mjs`](../../scripts/build.mjs) |
| Dev watch mode | `pnpm watch` | [`scripts/watch/index.mjs`](../../scripts/watch/index.mjs) |
| Full test suite | `pnpm test` | runs `cd tests; pnpm test` |
| Test watch mode | `pnpm tdd` | [`tests/package.json`](../../tests/package.json) |
| CI test mode | `pnpm test:ci` | run from [`tests/`](../../tests) dir |
| Specific test file | `pnpm test filepart` | filename substring match |
| Coverage | `pnpm test:coverage` | V8 provider |
| New package scaffold | `pnpm new` | [`scripts/new-pkg.zsh`](../../scripts/new-pkg.zsh) |
| Build docs | `pnpm build:docs` | [`scripts/docs.zsh`](../../scripts/docs.zsh) |
| Docs dev server | `pnpm docs:dev` | VitePress |
| Publish release | `pnpm release` | builds all + `changeset publish` |

CI gate: `main.yml` runs build → lint → `pnpm test:ci` on all PRs and master pushes.

## Language breakdown

| Language | LOC | Files | % |
|----------|-----|-------|---|
| TypeScript | 84,774 | 311 | 65% |
| Markdown | 31,211 | 88 | 24% |
| YAML | 8,251 | 8 | 6% |
| JavaScript | 1,540 | 7 | 1% |
| HTML | 1,167 | 3 | 0% |
| JSON | 972 | 41 | 8% |
| CSS | 328 | 2 | 0% |

## DevOps & CI

- CI provider: GitHub Actions. Two primary workflows: `main.yml` (CI on PR/push) and `publish.yml` (npm publish on `release` branch push).
- Release flow: merge feature → master → Changesets bot opens "Version Packages" PR → merge → merge master to `release` branch → `publish.yml` runs tests + `changeset publish` via OIDC → triggers `docs.yml`.
- Docs deploy: GitHub Pages with legacy Jekyll build type; `_config.yml` injected at deploy time to expose `.well-known/` directory.
- Claude AI integration: `claude-ci-failure.yml`, `claude-comment.yml`, `claude-pr.yml` handle automated AI review and failure notification.

## Domains

| Domain | Repo paths | One-liner | Detail |
|--------|------------|-----------|--------|
| utils | [`packages/utils/`](../../packages/utils) | Foundation layer — attempt tuples, flow control, validation, data structures | [`docs/wiki/utils.md`](utils.md) |
| observer | [`packages/observer/`](../../packages/observer) | Event bus with regex matching, queues, generators, relay | [`docs/wiki/observer.md`](observer.md) |
| fetch | [`packages/fetch/`](../../packages/fetch) | HTTP client with resilience policies, plugins, cookie jar | [`docs/wiki/fetch.md`](fetch.md) |
| dom | [`packages/dom/`](../../packages/dom) | Type-safe browser DOM utilities, templates, animations | [`docs/wiki/dom.md`](dom.md) |
| state-machine | [`packages/state-machine/`](../../packages/state-machine) | Reducer-based FSM with history, guards, StateHub | [`docs/wiki/state-machine.md`](state-machine.md) |
| storage | [`packages/storage/`](../../packages/storage) | Typed localStorage/sessionStorage wrapper with events | [`docs/wiki/storage.md`](storage.md) |
| localize | [`packages/localize/`](../../packages/localize) | i18n with path-typed keys, ICU pluralization, Intl, CLI extractor | [`docs/wiki/localize.md`](localize.md) |
| hooks | [`packages/hooks/`](../../packages/hooks) | Lifecycle hook engine with priority chains and ctx.fail() | [`docs/wiki/hooks.md`](hooks.md) |
| react | [`packages/react/`](../../packages/react) | React context factories + useQuery/useMutation API hooks | [`docs/wiki/react.md`](react.md) |
| redis-bus | [`packages/redis-bus/`](../../packages/redis-bus) | Redis Streams message bus — README only, no implementation yet | [`docs/wiki/redis-bus.md`](redis-bus.md) |
| testing | [`tests/`](../../tests) | Vitest dual-project suite (jsdom unit + Playwright browser) | [`docs/wiki/testing.md`](testing.md) |
| tooling | [`scripts/`](../../scripts), [`.github/workflows/`](../../.github/workflows), [`.changeset/`](../../.changeset), [`internals/`](../../internals), [`skills/`](../../skills), [`.claude/skills/`](../../.claude/skills) | Build, CI, release, docs infrastructure | [`docs/wiki/tooling.md`](tooling.md) |

## Cross-cutting

- **Test layout**: [`tests/src/`](../../tests/src) mirrors package names. All test imports use relative paths to `packages/*/src/index.ts` — never package names. Smoke tests in [`tests/src/smoke/`](../../tests/src/smoke) run in Chromium; unit tests run in jsdom.
- **Skills location**: [`skills/logosdx/`](../../skills/logosdx) is the monorepo's canonical skill folder. Not `~/.claude/skills/`. The `SKILL.md` routes by task to individual `references/*.md` files.
- **Dependency direction**: All packages depend on `utils`. `react` optionally depends on all others. No circular dependencies.
- **`@logosdx/kit`**: The orchestrator package was discontinued and removed from the repo (2026-07-05); untracked remnants sit in `tmp/remove/`.
- **Implementation specs**: `docs/spec/<topic>.md` holds post-implementation contracts/logs (e.g. [`docs/spec/config-update-fns.md`](../spec/config-update-fns.md) for the utils config rework); [`docs/design/`](../design) holds pre-implementation conceptual docs.
- **Deterministic substrate**: `.claude/project/deterministic-signals.md`
- **Domain partitioning basis**: Domains map to npm packages (vertical slices). `testing` and `tooling` group the cross-cutting test suite and infrastructure respectively.
