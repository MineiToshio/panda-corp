---
id: BL-0210
type: change
area: build-engine
title: "gate-test-repair's extra opus reviewer pass (BL-0001) is real, measured overhead (12.1 min / 6.544 $ / 81 calls on canary F1's FRD-02) that no D2/E2/F1 cost or timing comparison currently budgets for"
status: open
severity: p2
opened: 2026-09-26
closed:
source: "docs/reviews/canary-f1-report.md §5 point 1 (canary F1, wf run, FRD-02)"
closes:
links: [BL-0201, BL-0001]
---

## Problem
Canary F1's FRD-02 gate triggered `gate-test-repair` (BL-0001's DR-073 two-cause fallback mechanism): the
patch agent flagged the `exclusion-bounded-writes` drift probe as internally unsatisfiable, because FRD-02's
own "Does NOT include" spec bullet is stale against four OTHER, already-approved FRDs that now legitimately
write outside `lib/discard/` + `lib/favorite/`. `gate-test-repair` ran a full SECOND opus reviewer pass to
resolve this (12.1 minutes, 6.544 $, 81 calls) — a pass absent from both D2's and E2's pipelines on the same
code. The mechanism worked CORRECTLY (it redirected the finding at the stale spec, filed a
`type: change` card rather than blocking or mis-patching the code) but its cost was not visible anywhere in
the canary's own headline cost/time comparison tables (§1.4-1.5 "Gate by gate" / "Per verified WO"), because
those tables were built assuming the per-FRD gate step list that predates `gate-test-repair` triggering.

Any future canary (or the owner) comparing F1's reported per-WO cost/time against D2/E2/G-series baselines
without knowing `gate-test-repair` fired invisibly would understate what a run that HITS this fallback
actually costs — a stale-spec collision is not rare (it is exactly the kind of drift the whole-FRD drift
finder, BL-0203, and this same canary corpus are designed to surface).

## Root cause
`gate-test-repair` is a real, conditionally-triggered engine step (BL-0001, DR-073) whose cost was never
added as its own line item to the canary measurement scripts/reports — `usage-rollup.mjs` presumably rolls
it into the FRD's total, but the PER-STEP breakdown canary reports quote (§1.2 "Phases", §1.4 "Gate by gate")
apparently does not name it as a distinct phase the way `find:drift`, `evidence:`, or the reopen ladder
already are.

## Fix plan
- `plugin/scripts/usage-rollup.mjs` (or whichever script produces the canary report's per-phase breakdown):
  confirm whether `gate-test-repair:<frd>` is already distinguishable as its own labeled cost line in the
  rollup's raw output; if it is (and the gap is only in how canary REPORTS render the phase table), no engine
  change is needed — only the reporting convention (see below). If it is NOT separately attributable (folded
  into a generic "Review" phase bucket alongside the ordinary gate/repair spend), add it as its own named
  phase bucket so a future canary's cost table can show it distinctly.
- Establish the reporting convention (a note in `docs/reviews/canary-f-plan.md`'s sibling planning template,
  or `factory/standards/build-orchestration.md`'s canary-methodology section): any future canary report's
  cost/time comparison table must call out whether `gate-test-repair` fired for any FRD in the run, and by
  how much, rather than letting it silently inflate (or, if it didn't fire in the baseline run being compared
  against, silently advantage) one side of the comparison.

## Tests (prove the fix — TDD, RED → GREEN)
- If `usage-rollup.mjs` needs a new phase bucket: a unit test with a fixture run containing a
  `gate-test-repair:<frd>` labeled spend, asserting the rollup's output attributes it to its own named
  bucket, not folded into a generic review total.
- Not independently automatable if the fix is purely a documentation/reporting-convention change (say so):
  the convention itself is enforced by future canary authors following the updated template, not by a
  script.

## Done when
- [ ] Confirmed (with evidence: read `usage-rollup.mjs`'s source) whether `gate-test-repair` cost is already
      separately attributable in the raw rollup data.
- [ ] Either the rollup script change lands with its test, or the reporting-convention doc update lands
      (state which, with the evidence for the choice, in this file before closing).

## Out of scope
- Changing `gate-test-repair`/DR-073's own mechanism (it worked correctly here) — this item is about cost
  VISIBILITY for future comparisons, not the mechanism's behavior.
