---
id: BL-0197
type: bug
area: build-engine
title: "a landing left the final FRD's frd.md/blueprint.md VERIFIED flip uncommitted and committed its timelines AFTER the last-green pointer"
status: done
severity: p1
opened: 2026-09-26
closed: 2026-09-26
source: "canary E2 report §4.4 and §4 (BL-0179 row) — transcript agent-a8d161c1f223a32e8 (apply-gate:frd-05-work-orders)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js landingCommitProtocol + SYNC_ROLLUPS_COMMIT in applyGate/certifyPatched + SYNC_ROLLUPS_COMMIT backstop — 7c741f90"
links: [BL-0172, BL-0066, BL-0179]
---

## Problem
After canary E2, `frd-05-work-orders/frd.md` and `blueprint.md` held an uncommitted `IN_REVIEW → VERIFIED`. The
apply-gate transcript shows sync-rollups returning `corrected: 2`, then a commit that staged the test and the WO file
only. The same agent then committed `.pandacorp/track.jsonl`/`build-journal.jsonl` in a THIRD commit after the pointer
commit, so HEAD ended two bookkeeping commits past `last_green_sha`. notify-end's sync-rollups then changed nothing
(the disk was already right), so BL-0172's conditional commit never fired.

## Root cause
The apply-gate/certify-patch prompts put `LAST_GREEN_ORDERING` (commit A, then pointer B) BEFORE the event/journal
appends and ended with a vague "stage the ported test files, track and journal and commit"; a MECH agent following the
text in order commits A, B, then the appends. Staging of the rollup documents was implied, never commanded.

## Fix plan
1. `landingCommitProtocol` — the last step of every certifying landing: stage (A) with the literal
   `git -C <project> add -u -- docs/frds .pandacorp` (+ the literal reviewer-test stage), commit, check
   `git status --porcelain -- docs/frds` is empty, then B; nothing after B.
2. `SYNC_ROLLUPS_COMMIT` (BL-0172) right after sync-rollups in applyGate and certifyPatched, and it now also commits a
   rollup document an earlier step left modified (the notify-end backstop).
3. The WP-08 partial-report check moves BEFORE any stamp in apply-gate.

## Tests (prove the fix — TDD, RED → GREEN)
E2-3a executes the snapshot command on a nested fixture (the rewritten frd.md and status.yaml are staged) and checks the
ordering (last-green ordering after the journal lines and after the snapshot staging; "NO commit after"; WP-08 check
before the stamp); E2-3b checks certify-patch; E2-4a checks notify-end's backstop. All RED on 9.113.0.

## Done when
- [x] RED → GREEN, suites green (see BL-0194).
- [ ] **Not verified live.**
