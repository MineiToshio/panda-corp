---
id: BL-0135
type: change
area: build-engine
title: "Run the three speed-sprint live canaries (A/B/C) and record their verdicts before the sprint's claims are trusted"
status: open
severity: p1
opened: 2026-09-22
closed:
source: "docs/proposals/37-fast-change-path-and-implement-cost.md, Adenda 2026-09-21 §Canario"
closes:
links: [BL-0124, BL-0129, BL-0044]
---

## Problem
The 2026-09 implement-speed sprint (packages WP-00..WP-11, E2, E3, F1; landing as plugin 9.103.0) ships
with every unit-level engine-harness scenario green, but its headline claims — a ≈3-4x wall-clock win on
`implement`, an oracle that does not regress on real defects, and a genuine ≥3-way concurrency win on a
multi-WO build — are ONLY provable live, against a real project. `implement-speed-sprint.md`'s own
"NO PUDE VERIFICAR" list names the single most likely silent failure: whether `/pandacorp:upgrade`
actually propagates the new engine to the canary project before it runs (if not, the canary measures the
OLD engine and every number is meaningless). None of the three canaries below has been executed yet.

## Fix plan
Execute all three canaries, in order, on the sprint's merged state (after `integration-speed-sprint-a`
lands as plugin 9.103.0), and record each verdict (pass/fail against its own acceptance bar, plus the
raw numbers) in `plugin/docs/decision-log.md`.

1. **Canary A — the headline.** A synthetic FRD, 2 non-UI work orders chained by `dependsOn` (the exact
   shape of FRD-24), run in a disposable Mission Control worktree, measured via `usage-rollup.mjs`
   (extended for this sprint, WP-09) joined against the run's `wf_*.json` `workflowProgress[]`.
   **Acceptance:** ≤1,200 s with a red gate in the loop / ≤950 s clean, `agentCount ≤ 18`, zero
   `foundation-gate`/`visual-qa` passes (the build touches no UI). **Rollback trigger:** improvement
   < 2x after packages A+B+C land → stop and re-measure before shipping further packages.
2. **Canary B — the oracle (mandatory before trusting WP-06's `gateEvidence: digested` default).** A
   blind A/B, `gateEvidence: explore` vs `gateEvidence: digested`, over a corpus of 5 seeded defects: the
   real red from FRD-24, plus 4 synthetic — an unmet acceptance criterion, a missing authz check, a
   near-duplicate component (DR-057), and a DR-115 single-source-of-truth violation. **Acceptance:**
   `digested` must match `explore` on every row for CORRECTION-class findings (no regression on any of
   the 5). **Rollback trigger:** a single CORRECTION-class finding lost by `digested` → revert the
   default to `explore`. Part of this run is free (the offline harness from BL-0063 already covers some
   fixtures) — use it before spending a live run.
3. **Canary C — the concurrency win.** A 6-WO / 2-FRD build with disjoint artifacts (candidate: the
   `portada-seal-…` card already sitting in `mission-control/.pandacorp/inbox/changes/`).
   **Acceptance:** ≤45 min wall clock, `concurrency_max ≥ 3` actually observed (not just configured).
4. **Prerequisite, verify FIRST:** confirm `/pandacorp:upgrade` on the canary project(s) actually pulls
   the new engine (compare the project's copy's line count / version stamp against the source — the
   sprint's own note flags a 2,146 vs 2,361+ line gap as the likely silent-failure mode). A canary run
   against a stale engine copy is worse than no canary — it produces a false pass.

## Tests (prove the fix — TDD, RED → GREEN)
Not applicable in the unit-test sense — this item's proof IS the three live canary runs themselves. Each
canary's acceptance bar above is the pass/fail oracle. A "test" here is: re-run `bash
plugin/scripts/run-engine-tests.sh` immediately before each canary (the sprint's own pre-flight,
zero-cost) to rule out a broken engine confounding the measurement.

## Done when
All three canaries have run at least once against the confirmed-current engine; each verdict (numbers +
pass/fail) is recorded in `plugin/docs/decision-log.md`; any rollback trigger that fired has its
corresponding default reverted per this item's Fix plan; BL-0124 and BL-0129's "live build pending
canary" notes are updated to point at the actual run.

## Out of scope
Building the canaries' fixtures or harness code (already shipped by WP-09/BL-0063/the sprint itself) —
this item is the EXECUTION and the recorded verdict, not new machinery.
