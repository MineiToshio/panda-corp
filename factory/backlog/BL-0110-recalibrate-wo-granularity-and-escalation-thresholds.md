---
id: BL-0110
type: change
area: standards
title: "Recalibrate DR-100's work-order granularity and DR-073/DR-107's escalation thresholds with Claude-5-era data"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-03 + R-04"
closes:
links: []
---

## Problem
Two thresholds were fitted to the previous model generation and have never been re-measured.
(1) `factory/standards/build-orchestration.md:53-68` targets *"~25–50 min / ~1.5–4k LOC per WO"* with a
ceiling *"above ~4k LOC / ~45 min"*, fitted by DR-100 against a 7k-LOC work order that took 5 gate attempts
and 20 h. (2) `.claude/engines/pandacorp-build.js:696-703` escalates to opus on `difficulty:high` or
`reopen_count >= 1`, with `MAX_REOPENS = 3` at `:71`, fitted by DR-073 (MC Phase-2 WO-07-005 churned 4 gate
cycles) and DR-107 (80% of first-gate fails had ≤6-min fixes). Impact: fewer, larger WOs would amortize the
fixed ~9-min gate cost better `[expected, not demonstrated]` — and blind loosening reproduces the 7k-LOC
incident.

## Fix plan
**Do not loosen speculatively — re-measure with DR-100's own methodology.**
1. One real `powerful` build on a fresh project with the ceiling raised to ~8k LOC / 70 min; compare
   gate-reject rate and wall-clock against the DR-100 baseline.
2. Compare the `reopen_count` distribution across the next N Claude-5-era FRD gates against the DR-107
   baseline **before** touching `MAX_REOPENS` or the escalation trigger. The mechanism stays either way —
   only the numbers are in question.
3. Land whichever thresholds the data supports via `/pandacorp:learn` (they live in a standard and the
   registry), not by editing the engine alone.

## Tests (prove the fix — TDD, RED → GREEN)
The two comparisons above, with sample sizes stated. A threshold change with N too small to mean anything is
a RED, not a GREEN.

## Done when
Both comparisons are recorded; `build-orchestration.md` and `registry.yaml` carry either new numbers with
their evidence or an explicit "re-measured, unchanged" note; `factory/decision-log.md` noted.

## Out of scope
Removing `MAX_REOPENS` as a single hard ceiling (§9 item 7) and the split-gate policy R-56 (measure, do not
move — needs N ≥ 6 re-gates).
