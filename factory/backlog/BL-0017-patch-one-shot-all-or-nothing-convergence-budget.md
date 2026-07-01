---
id: BL-0017
type: bug
area: build-engine
title: "DR-073 one-shot patch + all-or-nothing fallback discards whole work orders over trivial self-introduced reds"
status: done
severity: p1
opened: 2026-07-01
closed: 2026-07-01
source: "owner/conversation — implement-speed audit of the personal-page-v2 build (2026-07-01)"
closes: "DR-107 (patch self-repair budget + evidence-preserving revert + in-run retry)"
links: [BL-0001, DR-073, DR-107, DR-072, DR-070]
---

## Problem
In the personal-page-v2 build (~14h45m wall-clock, 2026-06-30/07-01), WO-01-004 (App Shell) was discarded
and rebuilt from scratch TWICE:
- **Incident 1 (16:51, commit `e4aa8ce`):** the gate found findings, the one-shot patch could not green, and
  `revertAndReopen` deleted the ENTIRE build — 1,397 lines / 22 files — for a rebuild the next pass.
- **Incident 2 (19:08, commit `dc21605`):** the patch was a 1-LINE i18n fix + 2 new test files; the patch's
  OWN new `e2e/a11y.spec.ts` carried a trivial TS2345 (`string | undefined`). The contract ("if you cannot
  green it, change NOTHING") forbade fixing it → full revert again, `reopen_count` 1→2 — and the revert
  DELETED the green 6/6 a11y spec that WO-01-004's `## Status Note` referenced, which the reviewer had to
  re-author blind a pass later.
Impact: FRD-01 needed 3 gates; the two reverts cost ~2-2.5h wall-clock plus a large share of the run's
tokens. Every reopen was deferred to the NEXT pass, re-paying the run's fixed overhead (baseline + full
re-plan over every FRD + rollup sync + safe-points).

## Root cause
Three compounding contracts in `pandacorp-build.js`:
(1) `attemptPatch` had exactly one shot and a binary give-up ("change NOTHING") — a red introduced by the
patch's own edits, however trivial, ended the patch; (2) `revertAndReopen` reverted every file of the WO
including reviewer-authored/Status-Note-referenced TEST files (coverage destroyed, not just rejected code);
(3) a reopened WO always waited for the NEXT run, so one bounded fault cost a whole extra pass of fixed
overhead.

## Fix plan
All in `plugin/templates/shared/.claude/workflows/pandacorp-build.js`, mirrored in
`factory/standards/build-orchestration.md` §6 + `plugin/skills/implement/SKILL.md` (per-FRD loop):
1. **Patch self-repair budget:** `attemptPatch` may fix a failure its OWN edits introduced and re-gate, up
   to 2 internal cycles; on give-up it UNDOES its own edits (tree exactly as found) and returns a
   discriminated `cause` (see BL-0001 for the `gate-test-defective` route).
2. **Evidence-preserving revert:** `revertAndReopen` MOVES reviewer-authored / Status-Note-referenced new
   test files to `.pandacorp/run/preserved-tests/<wo-id>/` instead of `git rm`; the `buildWO` builder prompt
   restores them as the rebuild's RED baseline.
3. **In-run retry:** after a revert, rebuild the reopened WOs once in the SAME run from the clean green base
   (opus — `reopen_count>=1`) and re-gate; bounded (one per FRD per run; skipped at the agent ceiling or the
   reopen cap; no second patch cycle on the retry's gate). `reopen_count` stays the single budget.

## Tests (prove the fix — TDD, RED → GREEN)
No engine unit-test harness exists (BL-0004 accepted residue) — proven by inspection + syntax check
(`node --check` on the wrapped script body) at ship time, and empirically on the next real build: the
signature to watch is a gate reject converging via `patch (self-repaired)` or `in-run retry` log lines
instead of a next-pass rebuild, and `.pandacorp/run/preserved-tests/` appearing on any revert that touches
reviewer test files.

## Done when
DR-107 exists in `factory/decisions/registry.yaml` (with DR-073 marked refined-by); the engine implements
the three mechanisms; `build-orchestration.md` §6 + `implement` SKILL.md describe them; plugin MINOR +
`OVERLAY_VERSION` bumped (the engine is an overlay file). All true as of 2026-07-01 (plugin v9.40.0,
OVERLAY 8.54.0).

## Out of scope
The e2e gate scoping (BL-0018 / DR-106); richer builder context packs and cheap-model mechanical steps
(phase 3 of the same audit plan); Party-tab event emission (phase 4).
