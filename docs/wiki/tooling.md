---
type: Domain
---

# tooling

## What it does

Covers the build system, CI pipelines, release workflow, documentation infrastructure, and developer skills for the monorepo. Packages build independently via SWC to ESM/CJS/UMD/types; docs deploy to GitHub Pages via VitePress; releases use Changesets on a `release` branch.

## Artifacts

- [`.claude/skills/release-workflow/SKILL.md`](../../.claude/skills/release-workflow/SKILL.md) — skill for automating the npm release cycle (changesets, PR flow, publish)
- [`.claude/skills/release-workflow/release.mjs`](../../.claude/skills/release-workflow/release.mjs) — automated release script (244 LOC): pushes branch, creates PR to master, waits for CI, merges, waits for Version Packages PR, merges to release

## CLI code

- [`scripts/build.mjs`](../../scripts/build.mjs) — main build script (547 LOC); builds all packages via SWC to ESM/CJS/UMD + TypeDoc types
- [`scripts/watch/index.mjs`](../../scripts/watch/index.mjs) — dev watch mode (364 LOC)
- [`scripts/watch/helpers.mjs`](../../scripts/watch/helpers.mjs) — watch helpers (231 LOC)
- [`scripts/build-docs.mjs`](../../scripts/build-docs.mjs) — docs pre-build script (137 LOC): generates `llms.txt`, copies `.md` to `public/llm/`, then runs VitePress
- [`scripts/docs.zsh`](../../scripts/docs.zsh) — docs deploy script (115 LOC): generates `_config.yml` with `.well-known` include for Jekyll, deploys to GitHub Pages
- [`scripts/new-pkg.zsh`](../../scripts/new-pkg.zsh) — new package scaffolding script (105 LOC)
- [`scripts/ralph-wiggum.sh`](../../scripts/ralph-wiggum.sh) — misc dev helper script (327 LOC)
- [`scripts/vite.config.ts`](../../scripts/vite.config.ts) — Vite config for scripts (37 LOC)
- [`scripts/Dockerfile`](../../scripts/Dockerfile) — Docker image for CI/build (57 LOC)
- [`internals/empty-pkg/`](../../internals/empty-pkg) — template for new packages (src/index.ts, .swcrc, package.json, tsconfig.json)
- [`.changeset/config.json`](../../.changeset/config.json) — Changesets configuration

## Docs

- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — release documentation and workflow (192 LOC)
- [`docs/CLAUDE.md`](../CLAUDE.md) — docs folder guidance (315 LOC)
- [`docs/documentation-guideline.md`](../documentation-guideline.md) — documentation standards (747 LOC)
- [`docs/.vitepress/config.mts`](../.vitepress/config.mts) — VitePress site config (208 LOC)
- [`docs/.vitepress/theme/`](../.vitepress/theme) — custom VitePress theme (index.ts, style.css, components/)
- [`.github/workflows/main.yml`](../../.github/workflows/main.yml) — CI: build, lint, test on PR/push to master; creates Version Packages PR on master push via `changesets/action`
- [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml) — Publish: triggers on `release` branch push; runs tests, publishes to npm via OIDC (no auth token), then triggers docs workflow
- [`.github/workflows/docs.yml`](../../.github/workflows/docs.yml) — Docs deploy workflow
- [`.github/workflows/claude-ci-failure.yml`](../../.github/workflows/claude-ci-failure.yml) — Claude AI failure notification workflow (195 LOC)
- [`.github/workflows/claude-comment.yml`](../../.github/workflows/claude-comment.yml) — Claude AI PR comment workflow
- [`.github/workflows/claude-pr.yml`](../../.github/workflows/claude-pr.yml) — Claude AI PR review workflow

## Coupling

- [`scripts/build.mjs`](../../scripts/build.mjs) builds all packages in [`packages/`](../../packages) — adding a new package requires registering it with the build script.
- VitePress [`docs/.vitepress/config.mts`](../.vitepress/config.mts) has hardcoded nav/sidebar entries — new package docs require updating this file.
- Publish CI uses OIDC trusted publishing (npm); deletes the injected `NODE_AUTH_TOKEN` as a workaround for `actions/setup-node` issue #1440.
- `@changesets/cli` is a root `dependencies` (not devDependencies) entry.

## Conventions worth knowing

- Release branch: features land on `master` → Changesets bot opens "Version Packages" PR → merge to `master` → merge `master` to `release` → CI publishes.
- All packages share a single `.swcrc` configuration (identical SHA across packages: `c358238`).
- Package tsconfigs all extend from [`tsconfig.json`](../../tsconfig.json) at the root.
- Build outputs: `.mjs` (ESM), `.js` (CJS), `.d.ts` (types), UMD browser globals named `LogosDx.[PackageName]`.
- [`docs/public/.well-known/context7.json`](../public/.well-known/context7.json) exposes the Context7 integration manifest.
- [`docs/public/llms-full.txt`](../public/llms-full.txt) (4601 LOC) is the full LLM-readable docs bundle generated at build time.
