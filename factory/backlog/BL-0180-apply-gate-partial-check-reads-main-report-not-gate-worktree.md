---
id: BL-0180
type: bug
area: build-engine
title: "applyGate's WP-08 partial-scope cage reads the MAIN tree's gate-report.json on the concurrent (C2) gate path, not the gate worktree's — checks an unrelated file"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md §5, finding L1 (line 193) — collateral finding of the parallel-FRD-gates audit, filed per that memo's own recommendation ('Fold the fix into §1.3-5, or file it as its own BL')"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js applyGate() WP-08 cage — 7eb3c30f-era code, fixed post-83c32888"
links: []
---

## Problem
`applyGate(frd, reviewIds, testFiles, sourceDir)` is the sole MAIN-tree writer that persists a PASSED
FRD gate (stamps `VERIFIED`, advances `last_green_sha`, commits). Before doing so it runs a WP-08
"cage": the agent prompt tells it to read `.pandacorp/run/gate-report.json` — a bare, CWD-relative
path — and refuse to stamp anything if that report's `scope` field is `"partial"` (a `--only`/`--files`
scoped `verify.sh` run, which certifies nothing).

That bare path resolves against the agent's own working directory, which is documented, in the same
function's leading comment, to be **the MAIN tree** ("Runs on the MAIN tree (no workFrom)"). On the
concurrent (C2, DR-118) gate path — `harvestGateResults()` calling `applyGate(f.frd, reviewIds,
gate.testFiles, GATE_WORKTREE)` at `pandacorp-build.js:2965` — the gate that actually produced the
PASS verdict ran inside `GATE_WORKTREE` (`.pandacorp/run/gate-worktree`), a separate detached
checkout, and its `gate-report.json` was written there, not on main. Main's own copy of that same
relative filename (if one exists at all) belongs to an unrelated run.

Evidence (docs/proposals/38 §5, finding L1, confirmed live in the canary tree): main's report showed
`scope: "full"` (an unrelated close-out run, 21:51) while the worktree's own report showed `scope:
"since"` (the actual gate that just passed, 20:43). Effect: on the C2 path the "partial" cage checks
an unrelated file — a `--only`/`--files` scoped gate that should have been refused could read a
green/full main-side report instead and slip through, or (less harmful but still wrong) a legitimate
`since`/`full` gate could be second-guessed against a stale/irrelevant main-side snapshot.

## Root cause
`sourceDir` already carries the exact information needed (it is `GATE_WORKTREE` on the concurrent
path, `null` on every legacy path where the gate ran in place on main — confirmed by grepping all 5
call sites of `applyGate`), and is already used a few lines above to port the reviewer's test files
(`${sourceDir}/<path>` → `<path>`). The WP-08 cage instruction was simply never updated to use the
same `sourceDir` when it was added — it kept the bare path that was only ever correct for the
sourceDir:null (legacy, gate-ran-on-main) case.

## Fix plan
In `applyGate()` (`plugin/templates/shared/.claude/engines/pandacorp-build.js`, mirrored verbatim at
`mission-control/.claude/engines/pandacorp-build.js`):
1. Compute `gateReportPath = sourceDir ? `${sourceDir}/.pandacorp/run/gate-report.json` :
   '.pandacorp/run/gate-report.json'` alongside the existing `port` computation.
2. Point the WP-08 cage instruction at `gateReportPath` instead of the hardcoded literal.
3. No change to `APPLY_GATE_SCHEMA`, `isPartialReport()`, or `refusePartial()` — the defect is purely
   in which file the agent is told to read; the refusal mechanism itself was already correct.
4. Keep the legacy (`sourceDir: null`) behavior byte-identical (bare path) — there the gate ran on
   main in place, so main's own report IS the right one; this is not a general "always prefer the
   worktree" change.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`, marker `// ---- BL-0180 ----`:
- **BL-0180a** — a normal single-FRD PASS taking the default concurrent (C2) gate path asserts the
  `apply-gate:` prompt contains `gate-worktree/.pandacorp/run/gate-report.json`, not the bare path.
  Confirmed RED before the fix (prompt contained the bare `.pandacorp/run/gate-report.json` with no
  `gate-worktree/` prefix); GREEN after.
- **BL-0180b** — a regression guard on the LEGACY path (forced via a reject-then-patch-then-verify
  sequence so `applyGate` is called with `sourceDir: null`): asserts the prompt still reads the bare
  main-tree path and is explicitly NOT pointed at a `gate-worktree/` path. Passed both before and after
  (no regression).

`node plugin/scripts/test-pandacorp-build.mjs` — 186/186 passed (was 184; +2 new). Full suite
`bash plugin/scripts/run-engine-tests.sh` — 25/25 suites, 0 failed, run clean after the fix.

## Done when
- [x] `applyGate()`'s WP-08 cage reads `${sourceDir}/.pandacorp/run/gate-report.json` when `sourceDir`
  is set (the C2 concurrent path), and the unchanged bare path otherwise.
- [x] `plugin/templates/shared/.claude/engines/pandacorp-build.js` and
  `mission-control/.claude/engines/pandacorp-build.js` stay byte-identical (`cmp` clean).
- [x] `test-pandacorp-build.mjs` BL-0180a/b green; full `run-engine-tests.sh` green (25/25).
- [x] Plugin version bumped (9.109.0 → 9.110.0, PATCH per DR-034 — a build-engine bug fix, no
  skill/agent behavior change) as part of the same release that lands this item.

## Out of scope
The broader "parallel FRD gates" proposal (docs/proposals/38, Decision 1 — a pool of N gate
worktrees) is a separate, owner-gated decision; this item only fixes the report-path defect that
proposal's audit surfaced as a collateral finding (L1), independent of whether parallel gates ever
ship. The proposal's Decision 2 (BL-0178, the pre-existing-drift oracle policy) is likewise untouched
here.
