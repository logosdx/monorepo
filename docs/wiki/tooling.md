---
type: Domain
---

# tooling

## What it does

Covers the build system, CI pipelines, release workflow, documentation infrastructure, and developer skills for the monorepo. Packages build independently via SWC (ESM/CJS/types) plus a Vite IIFE browser bundle; docs deploy to GitHub Pages via VitePress; releases use Changesets, publishing from `master` when a package version bump lands.

## Artifacts

- [`.claude/skills/release-workflow/SKILL.md`](../../.claude/skills/release-workflow/SKILL.md) — skill for automating the npm release cycle (changesets, PR flow, publish)
- [`.claude/skills/release-workflow/release.mjs`](../../.claude/skills/release-workflow/release.mjs) — automated release script: pushes branch, creates PR to master, waits for CI, merges, waits for Version Packages PR, merges it, then waits for the `publish.yml` run on `master` (no release branch)
- [`skills/logosdx/SKILL.md`](../../skills/logosdx/SKILL.md) — canonical LogosDX skill; its `description` trigger list and task routing table name every package, `slides` included (`Deck`, `<slides>`/`<slide>`/`<notes>` markup)
- [`skills/logosdx/references/REFERENCE.md`](../../skills/logosdx/references/REFERENCE.md) — package-to-reference index; [`skills/logosdx/references/slides.md`](../../skills/logosdx/references/slides.md) is the `@logosdx/slides` reference

## CLI code

- [`scripts/build.mjs`](../../scripts/build.mjs) — main build script; builds all packages via SWC to ESM/CJS, a Vite IIFE browser bundle, and `.d.ts` types. After the Vite step it copies every `src/*.css` of the package into `dist/browser/`, because Vite empties its `outDir` and the IIFE build emits no CSS
- [`scripts/watch/index.mjs`](../../scripts/watch/index.mjs) — dev watch mode
- [`scripts/watch/helpers.mjs`](../../scripts/watch/helpers.mjs) — watch helpers
- [`scripts/build-docs.mjs`](../../scripts/build-docs.mjs) — docs pre-build script: generates `llms.txt` from its `packageDescriptions` map (a new package, such as `slides`, needs an entry), copies `.md` to `public/llm/`, then runs VitePress
- [`scripts/docs.zsh`](../../scripts/docs.zsh) — docs deploy script: generates `_config.yml` with `.well-known` include for Jekyll, deploys to GitHub Pages
- [`scripts/new-pkg.zsh`](../../scripts/new-pkg.zsh) — new package scaffolding script
- [`scripts/ralph-wiggum.sh`](../../scripts/ralph-wiggum.sh) — misc dev helper script
- [`scripts/vite.config.ts`](../../scripts/vite.config.ts) — Vite config for the browser bundle: IIFE `dist/browser/bundle.js`, entry `src/browser.ts` when that file exists, else `src/index.ts`; target `es2022`, because lower targets make esbuild emit helpers outside an IIFE with a dotted global name; `process.env.NODE_ENV` defined as `"production"`, because library mode leaves `process.env` for the consumer's bundler and a CDN page has no `process`
- [`scripts/Dockerfile`](../../scripts/Dockerfile) — Docker image for CI/build
- [`internals/empty-pkg/`](../../internals/empty-pkg) — template for new packages (src/index.ts, .swcrc, package.json, tsconfig.json)
- [`.changeset/config.json`](../../.changeset/config.json) — Changesets configuration

## Docs

- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — release documentation and workflow
- [`docs/CLAUDE.md`](../CLAUDE.md) — docs folder guidance
- [`docs/documentation-guideline.md`](../documentation-guideline.md) — documentation standards
- [`docs/.vitepress/config.mts`](../.vitepress/config.mts) — VitePress site config
- [`docs/.vitepress/theme/`](../.vitepress/theme) — custom VitePress theme (index.ts, style.css, components/)
- [`.github/workflows/main.yml`](../../.github/workflows/main.yml) — CI: build, lint, test on PR/push to master; creates Version Packages PR on master push via `changesets/action`
- [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml) — Publish: on `master` push, a `detect` job checks whether any `packages/*/package.json` `"version"` field changed; if so it builds and publishes to npm via OIDC (no auth token), then triggers docs workflow. Also handles `beta` pre-release publishes and manual `workflow_dispatch`
- [`.github/workflows/docs.yml`](../../.github/workflows/docs.yml) — Docs deploy workflow
- [`.github/workflows/claude-ci-failure.yml`](../../.github/workflows/claude-ci-failure.yml) — Claude AI failure notification workflow
- [`.github/workflows/claude-comment.yml`](../../.github/workflows/claude-comment.yml) — Claude AI PR comment workflow
- [`.github/workflows/claude-pr.yml`](../../.github/workflows/claude-pr.yml) — Claude AI PR review workflow

## Coupling

- [`scripts/build.mjs`](../../scripts/build.mjs) builds all packages in [`packages/`](../../packages) — adding a new package requires registering it with the build script.
- VitePress [`docs/.vitepress/config.mts`](../.vitepress/config.mts) has hardcoded nav/sidebar entries — new package docs require updating this file.
- Publish CI uses OIDC trusted publishing (npm); deletes the injected `NODE_AUTH_TOKEN` as a workaround for `actions/setup-node` issue #1440.
- `@changesets/cli` is a root `dependencies` (not devDependencies) entry.

## Conventions worth knowing

- Release flow: features land on `master` → Changesets bot opens "Version Packages" PR → merge to `master` → the version bump on `master` triggers CI to publish. No `release` branch.
- All packages share a single `.swcrc` configuration (identical SHA across packages: `c358238`).
- Package tsconfigs all extend from [`tsconfig.json`](../../tsconfig.json) at the root.
- Build outputs: `.mjs` (ESM), `.js` (CJS), `.d.ts` (types), IIFE browser bundle at `dist/browser/bundle.js` exposing the global `LogosDx.[PackageName]`, plus any `src/*.css` copied alongside it.
- [`docs/public/.well-known/context7.json`](../public/.well-known/context7.json) exposes the Context7 integration manifest.
- [`docs/public/llms-full.txt`](../public/llms-full.txt) is the full LLM-readable docs bundle generated at build time.
