---
id: BL-0182
type: bug
area: build-engine
title: "Every C2 gate verdict (pass, reopen, block) leaves the gate worktree dirty, and the next chained gate probes it before anything cleans it, so the run decays to the legacy synchronous gate path"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md, Red-team addendum (2026-09-25) §A3 finding X1 (evidence e2/e3/e12); canary D2 wf_faf48b18-881"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js launchGate/releaseGateWorktree/applyGate (C2 gate-worktree lifecycle, DR-118) — fixed in e8a27fbf"
links: [BL-0175, BL-0180, BL-0183, BL-0184, BL-0067]
---

## Problem
The concurrent gate path (C2, DR-118) runs each FRD's review-only gate in one persistent detached
worktree (`.pandacorp/run/gate-worktree`), with gates serialized on `gateWorktreeChain`. Before a gate
starts, `ensureGateWorktree` reuses the worktree only if `git status --porcelain` there is empty;
otherwise it marks the worktree `failed` and the whole rest of the run falls back to the legacy
synchronous gate path on main.

Every verdict left the worktree dirty:
- **PASS**: `applyGate` COPIED the reviewer's test files from the worktree to main and never cleaned the
  source (red-team e3).
- **Reopen**: the reviewer's RED-proven tests stayed there (the patch ladder runs on main; see BL-0184).
- **Block**: BL-0175 added a salvage step, but it lives in `persistGateBlock`, which the main loop only
  reaches after `settleGates(true)` — the next chained gate's `ensureGateWorktree` had already fired the
  instant the previous review returned (red-team e2: canary D2's second `gate-worktree` spawn at 01:46:19,
  `persist-block:frd-02` at 01:46:32).

So after the first verdict of a run the next gate at a different pin found the worktree dirty and C2
went legacy for the rest of the run — which is how canary D2 ran all its gates, and why Mission
Control's real gate worktree is still dirty today (red-team e12).

## Root cause
Cleaning was not part of the gate's lifecycle. The only cleanup (BL-0175) was attached to ONE verdict
kind and ran on the main loop's schedule, not the worktree chain's, so the next gate's precondition was
evaluated before the previous gate's cleanup.

## Fix plan
1. New `releaseGateWorktree(frd, gate)` (MECH, label `gate-release:<frd>`): list
   `git -C <wt> status --porcelain=v1 --untracked-files=all` (the `--untracked-files=all` matters: plain
   `--porcelain` collapses a new directory to one `?? dir/` line, verified with git on 2026-09-25), copy
   each path into `.pandacorp/run/gate-evidence/<frd>/<same repo-root-relative path>` with its sha256,
   copy the gitignored `gate-report.json` there too, clean EXACTLY those paths (`clean -f --` /
   `checkout --`, never a blanket clean, BL-0067), and re-list as the postcondition (`remaining` must be
   `[]`).
2. `launchGate` runs the gate and its release as ONE link of `gateWorktreeChain`
   (`try { frdGate } finally { release }`), so the next chained gate's precondition is evaluated only
   after the release, for every verdict including a crash. The salvage result rides on the verdict as
   `gate.reviewerEvidence`.
3. `harvestGateResults` ports a PASS from the evidence dir (git's own list, not the reviewer-declared
   one) to the repo-root-relative path on main; `applyGate` reads the WP-08 cage report from the
   evidence dir, where no later chained gate can overwrite it before the (main-loop-paced) apply runs.
4. `persistGateBlock`'s BL-0175 salvage keeps running as a backstop, now also with
   `--untracked-files=all`.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`, marker `// ---- BL-0182..0184 ----`, scenarios
`BL-0182a-pass|reopen|blocked|crash`: two FRDs gated at different pins with a STATEFUL worktree model
(the gate writes its test file into the tree, the probe refuses a dirty tree like the real check, the
release salvages and cleans). Each asserts that the second gate still runs in the worktree (never the
legacy path), that the release ran after the first gate and before the second probe, that the worktree
ends clean, and (pass) that the apply ports the salvaged file from the evidence dir. Also updated for
the new spawn: `WP03a` (MECH site count 16 → 19), `WP03e` (fixture spawns 18 → 19), scenario `22`
(maxAgents 16 → 17, same capHit point), `BL-0180a` (the report is now read from the evidence dir), and
the `gate-release:` default in `test-build-engine.mjs`.

## Done when
- [x] RED against the pre-fix engine (`git show main:…/pandacorp-build.js`): all four `BL-0182a-*`
  fail, with the second gate on the legacy path, as in D2. GREEN after the fix.
- [x] `bash plugin/scripts/run-engine-tests.sh`: 25/25 suites (`test-pandacorp-build.mjs` 197/197).
- [x] `mission-control/.claude/engines/pandacorp-build.js` byte-identical to the template (`cmp`).

## Out of scope
The plugin/overlay version bump and the decision-log entry (the release batch owns them). Cleaning the
worktrees that are ALREADY dirty (MC's real `gate-worktree`, red-team e12) — the engine refuses them
loudly now (BL-0183) but never deletes evidence; that stays a one-time manual salvage. A live run
proving C2 stays concurrent across a whole multi-FRD run (canary E in the addendum) is not verified here.
