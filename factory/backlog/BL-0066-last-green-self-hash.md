---
id: BL-0066
type: bug
area: build-engine
title: "Make last_green_sha an honest ancestor snapshot instead of an impossible self-hash"
status: done
severity: p0
opened: 2026-07-11
closed: 2026-07-11
source: "installed R10 canary audit — LAST_GREEN_ORDERING self-hash defect"
closes: "BL-0066 two-commit green-snapshot contract + plugin 9.93.0 + overlay 8.74.0"
links: [DR-050, DR-113]
---

## Problem

The injected Claude build engine tells the serialized gate applier to commit the verified feature,
read that commit's SHA, write it to `last_green_sha`, and then amend the same commit. An amend creates
a different commit object, so the recorded SHA names the pre-amend commit that is no longer an
ancestor of the final branch. Recovery and review-worktree consumers can therefore follow an orphan
while `safe_to_test: true` claims the pointer is trustworthy.

## Root cause

A Git commit cannot contain its own SHA. `LAST_GREEN_ORDERING` attempted to manufacture that fixed
point with `git commit --amend`, but changing `status.yaml` necessarily changes the tree and therefore
the commit hash. The deterministic state API also accepted any SHA-shaped string without proving the
commit existed on the current branch.

## Fix plan

1. Replace amend ordering with two commits: commit A is the independently verified snapshot; commit B
   publishes `last_green_sha: A` and `safe_to_test: true`, so A is a stable ancestor of HEAD.
2. Make `stampLastGreen` fail closed unless the candidate resolves to a commit and is an ancestor of
   current HEAD; set `safe_to_test` only after those checks pass.
3. Add real Git regression tests for the valid two-commit chain, nonexistent SHA, and orphan SHA.
4. Update the build contract, implement skill, Manual, and decision logs; bump the injected overlay and
   plugin versions and regenerate manifests.

## Tests (prove the fix — TDD, RED → GREEN)

- `plugin/scripts/test-build-state.mjs` creates real repositories and proves the published SHA exists,
  remains an ancestor after the metadata commit, and cannot be an orphan/nonexistent SHA.
- `plugin/scripts/test-pandacorp-build.mjs` rejects the old amend instruction and requires the explicit
  snapshot-then-pointer two-commit protocol.
- Run the build-engine corpus, state/CLI corpus, manifest drift checks, backlog validator, and plugin
  validator.

## Done when

- No canonical engine instruction uses amend to publish `last_green_sha`.
- `stampLastGreen` proves commit existence and ancestry before setting `safe_to_test: true`.
- Git-backed regressions and the full relevant validators are green.
- Overlay is 8.74.0, plugin is 9.93.0, canonical docs and Manual agree.

## Out of scope

Promoting R10/R11, changing lease semantics, or redefining which independent reviewer may declare a
snapshot green.
