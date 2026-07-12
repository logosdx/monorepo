---
type: Steering
description: Authoritative steering for the signals/wiki inferrer when operating under docs/wiki/.
---

<!-- steering note: user hints to correct framework detection / domain grouping / build-test
 commands; the inferrer reads this file and treats its section content as authoritative -->

<!-- This note is an HTML comment deliberately: the old <steering note: ...> pseudo-tag is
 illegal Vue template syntax and broke any VitePress build that swept this directory. -->

## Framework

- TypeScript pnpm-workspace monorepo publishing the `@logosdx/*` packages. No NestJS, no turbo, no top-level `src/`.

## Domains

- Domains map 1:1 to `packages/<name>/` (vertical slices).
- `tests/` is the cross-cutting `testing` domain.
- `scripts/`, `.github/workflows/`, `.changeset/`, `internals/`, `skills/` group as the `tooling` domain.

## Build

- Build: `pnpm build` from the repo root (builds every package via `scripts/build.mjs`).
- Test: `pnpm test:ci` from `tests/` (`pnpm test` also runs once; `pnpm tdd` is watch mode).
- Tests resolve built `dist/`, not `src/` — a touched package must be rebuilt before a test run proves anything.

## Ignore for domains

- tmp/
- typedoc/ (generated)
- .worktrees/
