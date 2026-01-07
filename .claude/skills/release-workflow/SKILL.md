---
name: release-workflow
description: "Use when releasing changes to npm. Automates changeset creation, PR workflow, and publish to release branch."
---

# Release Workflow


## Quick Start

    # From a feature branch with changes ready:
    /release-workflow


## Critical Rules

1. **Must be on feature branch** - Not master/main/release. Create branch first if needed.
2. **Session reports drive changesets** - Reads `tmp/reports/new/` for context.
3. **Two-phase process** - First: changesets + commit. Second: automated PR flow.
4. **Script handles git/github** - `release.mjs` automates CI waits and merges.


## Workflow

1. Read session reports from `tmp/reports/new/` to understand changes
2. Invoke `/changeset-writer` skill to create changesets
3. Invoke `/git-committer` skill to commit all changes
4. Run `pnpm zx .claude/skills/release-workflow/release.mjs` to automate:
   - Push branch, create PR to master
   - Wait for CI, merge PR (squash)
   - Wait for Version Packages PR, merge it
   - Merge master to release, wait for publish


## Manual Steps (if script fails)

| Step | Command |
|------|---------|
| Push & PR | `git push -u origin HEAD && gh pr create --base master --fill` |
| Watch CI | `gh run watch $(gh run list -b BRANCH -L1 --json databaseId -q '.[0].databaseId')` |
| Merge PR | `gh pr merge --squash --delete-branch` |
| Version PR | `gh pr list --search "Version Packages"` then `gh pr merge NUM --squash` |
| To release | `git checkout release && git merge master && git push` |


## References

- [release.mjs](release.mjs) - Automated workflow script
