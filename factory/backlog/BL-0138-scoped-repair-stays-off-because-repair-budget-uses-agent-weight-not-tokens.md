---
id: BL-0138
type: bug
area: build-engine
title: "WP-08's scopedRepair defaults to false because repairBudgetFactor's COST() is agent-weight, not tokens, and starves the patch ladder on 1-WO FRDs"
status: open
severity: p2
opened: 2026-09-22
closed:
source: "docs/proposals/37-fast-change-path-and-implement-cost.md speed sprint, package WP-08 (branch wp-08-scoped-repair)"
closes:
links: []
---

## Problem
Speed-sprint package **WP-08** ("reparación dirigida + jaula `scope:partial` + freno 3x") ships with
`scopedRepair` defaulting to `false`. The reason, per the package's own design: the repair-loop brake
(`repairBudgetFactor`) is computed from `COST()` — a per-agent WEIGHT (a rough proxy for how expensive a
given agent invocation is), not a measure of actual tokens spent. On an FRD with a single work order (the
common case for a targeted fix), the escalation ladder `patch-1 → diagnose → patch-2` costs roughly 9
COST()-units by this weighting, but the brake's budget for a 1-WO FRD computes to only 6 — so the brake
trips and cuts the ladder short BEFORE it reaches `patch-2`, on FRDs where a real per-token accounting
would have had budget to spare. Shipping `scopedRepair: true` as the default under this budget model would
systematically under-repair small FRDs, so the package correctly left it off — but that leaves the
package's whole benefit (targeted, cheaper repair loops) unrealized by default.

## Root cause
`repairBudgetFactor` was built against `COST()`, the same per-agent WEIGHT function used for pre-flight
concurrency/cost ESTIMATES elsewhere in the engine (a reasonable reuse when no real signal existed). It
was never rebuilt against WP-09's new instrumentation (`durationMs`/token usage per agent, landed the same
sprint) because WP-09 and WP-08 are sibling packages in the same tanda with no dependency edge between
them — WP-08 shipped first and had nothing else to budget against.

## Fix plan
Two independent paths, either sufficient on its own (pick after WP-09/I-1 data is available to compare):
1. **Real-token accounting.** Once WP-09's per-agent `durationMs`/cost instrumentation is available AT
   RUN TIME (not just post-hoc in `wf_*.json`), have `repairBudgetFactor` read actual tokens spent
   so far in the run's repair loop instead of the static `COST()` weight, and re-derive the 1-WO-FRD
   budget from real spend rather than the agent-count proxy.
2. **Absolute minimum floor.** Independently of (1), set an absolute minimum repair budget (e.g. `≥ 9`
   COST()-units, matching the ladder's own worst-case cost) that the per-FRD-size formula can never drop
   below — cheap, does not require WP-09 wiring, and directly closes the 6-vs-9 gap this item documents.
Either change flips `scopedRepair`'s default candidacy back to `true` for small FRDs; re-validate against
WP-08's own test fixtures before flipping the default.

## Tests (prove the fix — TDD, RED → GREEN)
RED = today, a 1-WO FRD fixture that needs the full `patch-1 → diagnose → patch-2` ladder trips the brake
after `patch-1 → diagnose` (budget 6 < cost 9), confirmed by a `repairBudgetFactor` unit assertion.
GREEN (path 1) = the same fixture, budgeted from real per-agent token spend, completes the ladder. GREEN
(path 2) = the same fixture, budgeted with the absolute floor applied, completes the ladder. Control: a
fixture that SHOULD trip the brake (a genuinely runaway repair loop, e.g. 5+ ladder rungs) must still trip
it under either fix — the floor/real-accounting change narrows the false trip, it does not remove the
brake.

## Done when
`scopedRepair` can default to `true` for FRDs the corrected budget covers without starving the ladder
(proven by the RED→GREEN fixture); the runaway-loop control fixture still trips the brake; the chosen
path (real-token accounting vs absolute floor, or both) is recorded in `plugin/docs/decision-log.md`
citing WP-08 and WP-09; plugin version bumped per DR-034.

## Out of scope
Redesigning the `scope:partial` cage or the 3x brake multiplier themselves (WP-08's own scope, already
shipped and correct) — this item only fixes the budget INPUT the brake compares against.

## Corroborating observation (2026-09-21, owner-stated, unverified)
Independently of this item's own root-cause analysis, the owner voiced the same-shaped complaint from the
outside: on a RED gate, `implement`'s repair loop feels like it "rehace demasiadas cosas" (redoes too much)
instead of diagnosing and fixing the specific failure or exploring an alternative — a hypothesis, not yet
confirmed against `track.jsonl` + `~/.claude/dashboard-events.ndjson`. This item's own fix (WP-08's targeted
`--only`/`--files`-scoped repair, currently defaulting off because of the budget bug this item tracks) is
exactly the mechanism that would address the owner's framing once `scopedRepair` can safely default to
`true`. Worth re-checking the owner's hypothesis against real run data once this item's fix lands and
`scopedRepair` flips on, to confirm the perceived over-correction goes away rather than assuming it does.
