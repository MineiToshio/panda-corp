---
id: BL-0318
type: bug
area: build-engine
title: "Do not count bootstrap-written wiring files as a worker's changes in a unit report"
status: done
severity: p0
opened: 2026-11-13
closed: 2026-11-13
source: "owner, funko-tracker run br-2026-11-14-01 (handback/u-build-wo-01-017.md)"
closes: "plugin 10.4.4 — report excludes manifest-proven, unchanged bootstrap outputs; unblock lifts bootstrap-only code hand-backs"
links: [DR-157, DR-150, BL-0316]
---

## Problem
In funko-tracker run `br-2026-11-14-01`, unit `u-build-wo-01-017` (43 files of correct work) was rejected and finally
handed back as "fallo de código" with no budget left, only because `.claude/launch.json` and `e2e/server-env.json` were
modified in the unit worktree, missing from `report.files` and outside the build allowlist. Those two tracked files are
rewritten by the project's `.pandacorp/worktree-bootstrap.sh` (worktree ports/env), never by the worker; the same two
diffs appeared in every patch/build worktree of recent runs.

## Root cause
The bootstrap marks its outputs `skip-worktree` so `git status` ignores them, but the bit does not survive in every unit
worktree (in the failing one, `git ls-files -v` showed no `S` flag; the later sparse-checkout setup of unit worktrees is
the likely culprit, since sparse checkout owns that bit). `report` (`evaluateDone`) treats every path in
`git status --porcelain` as the worker's change, so a bootstrap output became a report mismatch and an allowlist
violation, i.e. a worker failure.

## Fix plan
`worktree-sweep.mjs` exports `bootstrapOwnedUnchanged(worktree)`: the bootstrap manifest's `generated_files`
(identity-bound: path, `.git` identity and gitdir must match, same proof DR-157 cleanup already trusts), restricted to the
bootstrap's own file set (`.claude/launch.json`, `e2e/server-env.json`, `.env.local`) and to files whose current bytes
still hash to the recorded value. `report.mjs` drops those modified paths from the unit's changes before the
report/allowlist checks; the commit stays pathspec-limited, so they are never committed. A worker edit to one of them
changes the hash and it counts again; a missing or foreign manifest excuses nothing.

Recovery of units already handed back by this bug: `failure/unblock.mjs` also accepts a `code` hand-back when every
reason of that attempt's rejection (`attempt-<n>.json`, the untruncated record) names a bootstrap-written file; the unit
returns at the same attempt like an env-infra one, journaled `unblocked {cause:"code", bootstrap_only:true}`.

## Tests (prove the fix — TDD, RED → GREEN)
`test-build-v2-report.mjs` BL-0318: manifest-proven unchanged launch.json → committed without it (fails on previous
main); adversarial: worker edit after the bootstrap, no manifest, a manifest for another path, and a non-bootstrap path
listed in a manifest are all still rejected. `test-build-v2-unblock.mjs` BL-0318: the pure predicate, a bootstrap-only code
hand-back lifted at the same attempt, a mixed rejection refused, and a journal reason that looks bootstrap-only refused
when the attempt record says otherwise.

## Done when
Tests green, engine and cleanup suites green, CLI reference updated, plugin bumped, decision log recorded.

## Out of scope
Restoring the skip-worktree bit after sparse checkout (the report fix makes it irrelevant for verdicts).
