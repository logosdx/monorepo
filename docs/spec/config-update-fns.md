# Spec: config-update-fns


No pre-approved spec existed for this work — it ran as an inline-brief
`/subagent-implementation` loop. The task: validate, fix, test, and document the rework of
`makeNestedConfig` (`packages/utils/src/config/index.ts`) that replaced TTL memoization
with a parse-once state cache and added three update functions to the returned
`NestedConfig<C, F>` object: `updateFlatConfig`, `updateParsedConfig`,
`setDeepInParsedConfig`. Canonical behavior is documented in
`docs/packages/utils/data.md` and `skills/logosdx/references/utils.md`; contract details
live in the JSDoc on `NestedConfig`.


## Checkpoints


| # | Checkpoint | Files/areas | Verifies | Status |
|---|------------|-------------|----------|--------|
| CP-1 | Validate/fix makeNestedConfig rework; behavior-locking tests for cache, invalidation, override accumulation, layering | `packages/utils/src/config/index.ts`, `tests/src/utils/misc.ts` | `pnpm test misc` (133 ✓), `tsc --noEmit -p packages/utils` | ✅ shipped (`db32468`) |
| CP-2 | Guard non-object overrides (F-3/F-4); refresh both doc surfaces | `packages/utils/src/config/index.ts`, `tests/src/utils/misc.ts`, `docs/packages/utils/data.md`, `skills/logosdx/references/utils.md` | full suite (2338 ✓), doc claims cross-checked against source | ✅ shipped (`44295b5`, `fe4096f`) |


## Change log


- 2026-07-05 — created post-implementation as the durable record of the loop (no prior
  spec to amend).


## Implementation log


### shipped — 2026-07-05

Built across 2 iterations of /subagent-implementation. Commits (chronological):

- `db32468` — feat(utils)!: config update fns + state cache (7 brief findings fixed, 12
  behavior-locking tests; breaking: `opts.memoizeOpts` removed)
- `44295b5` — fix(utils): reject non-object config overrides (nullish override wiped
  accumulated parsed overrides; assert guards + strengthened test)
- `fe4096f` — docs(utils): document config update fns (docs/packages/utils/data.md +
  skills/logosdx/references/utils.md)

**Out-of-scope work performed during this build:**

- none

**Unforeseens — surprises that emerged during implementation:**

- Tests resolve `@logosdx/utils` via the workspace symlink to `packages/utils/dist/` at
  runtime — the tests/tsconfig.json path alias covers type-checking only. Source edits
  require `pnpm --filter @logosdx/utils run build` before `pnpm test`.
- Reviewer found real silent-state-corruption (`updateParsedConfig(null)` discarding all
  accumulated overrides via merge()'s primitive-source short-circuit) that the original
  bad-input test could not detect; fixed in iteration 2.

**Deferred items still open:**

- F-1: cached `allConfigs()` returns a shared mutable reference (document read-only vs
  clone-on-return) — pending user triage.
- F-2/F-6: `DeepNotOptional` in types.ts unused + its JSDoc example doesn't compile
  (user's own uncommitted edit) — pending user triage.
- F-5: `setDeepMany` gained `value as PathValue<T, typeof path>` cast (user's own
  uncommitted edit) — pending user triage.
