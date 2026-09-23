---
id: BL-0138
type: bug
area: build-engine
title: "WP-08's scopedRepair defaults to false because repairBudgetFactor's COST() is agent-weight, not tokens, and starves the patch ladder on 1-WO FRDs"
status: done
severity: p2
opened: 2026-09-22
closed: 2026-09-22
source: "docs/proposals/37-fast-change-path-and-implement-cost.md speed sprint, package WP-08 (branch wp-08-scoped-repair)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js repairBudgetFactor/canAffordRepair — real-token second opinion (path 1) on top of the already-shipped absolute floor (path 2, commit fbeef8b3)"
links: [BL-0135]
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

## Resolution (2026-09-22)
Both fix-plan paths are now shipped, but the "Done when" criterion is met in a MODIFIED form: the
budget-accuracy root cause this item's title names is fully closed, but `scopedRepair` itself stays at
its existing default (`false`) — a deliberate, documented decision, not an oversight.

**Path 2 (absolute floor) was already shipped**, independently of this item's close-out, in commit
`fbeef8b3` ("close five REV2 gaps in the gate/repair/drain ladder", the sprint's own round-2 adversarial
review, D4/REV2-3): `REPAIR_BUDGET_FLOOR = 9` floors `repairBudget()` regardless of `factor × base`,
closing the exact 6-vs-9 gap this item's Problem section describes. `scopedRepair` was NOT flipped by
that commit — it only fixed the brake's own coupling to `args.scopedRepair` (REV2-3: the brake used to be
gated OFF by the same flag as the sonnet-fixer scoping) and added the floor.

**Path 1 (real-token accounting) is landed by this close-out**, re-scoped after verifying the actual
Workflow script API (the `workflow-authoring` skill reference, read before implementing): `agent()`
returns NO per-call token usage — the ONLY live signal is `budget.spent()`, a single un-partitioned
counter for the whole run. A per-FRD real-token REPAIR cost is trustworthy (every repair rung runs on a
quiesced, one-FRD-at-a-time tree), but a per-FRD real-token BUILD cost is trustworthy only when that
FRD's own wave built it alone — the engine's global-wave design (DR-050/BL-0021) deliberately builds
multiple FRDs concurrently, sharing the same counter, so WP-09's `durationMs`/token instrumentation
genuinely isn't available AT RUN TIME for the general case, exactly as this item's own Root Cause section
anticipated. `canAffordRepair` now consults a real-token ceiling (`REPAIR_BUDGET_FACTOR ×` the FRD's real
build tokens, when measurable) with OR semantics on top of the existing floored agent-weight ceiling — it
can only RESCUE a rung the floor would have refused, never refuse one the floor would allow, and falls
back to agent-weight with a fail-loud log (`repair brake on agent-weight, usage unavailable`) when a
multi-FRD wave makes the real number untrustworthy. Proven RED→GREEN in
`plugin/scripts/test-pandacorp-build.mjs` (`BL-0138-1` rescues a rung `WP08e` proves the floor alone
refuses; `BL-0138-3` is the required control — a genuinely expensive repair still trips the brake;
`BL-0138-4a` proves the fallback + its log; `BL-0138-2`/`BL-0138-5` are the unaffected-common-case and
default-unchanged checks).

**`scopedRepair` stays `false` — NOT flipped.** Re-reading the scoped-repair mechanism itself (the
`scope:"partial"` cage + its `--only`/`--files`-narrowed INTERNAL self-repair cycles, WP-08 (b)) surfaced
a risk the budget fix does nothing for: those internal cycles re-gate scoped to the sub-gates
`gate-report.json` named for the ORIGINAL failure, so a misdiagnosed or cross-file regression introduced
mid-repair could churn the internal budget against the wrong scope before the (always-unscoped) final
certification re-gate catches it — late, not wrong, but not the fast path WP-08 promises either. The
engine's own comment already states the real bar: "a tradeoff the owner should opt into on LIVE DATA" —
and the decision log confirms that data does not exist: both Canary A and Canary B ran with the default,
and BL-0138 itself is noted there as "confirmed still applicable"/"confirmed unused in this run" AFTER
the floor had already landed. Flipping a build-wide default on an unvalidated internal-loop risk, for a
backlog item chartered to fix the budget's INPUT measure (now done, twice over), would be disproportionate.

**Activation criterion for a future item** (mirrors the bar already used for `gateEvidence:'digested'`,
BL-0135): a dedicated canary run with `{"scopedRepair": true}` explicitly opted in, on a real
patch-1→diagnose→patch-2(+) escalation, confirming (a) the sub-gate classifier correctly targets the
actual failing sub-gate, (b) no case where the scoped `--files`-narrowed re-gate missed a regression the
final unscoped certification then had to catch late, and (c) the mechanical sonnet fixer rarely needs an
opus escalation. Until then this item's own budget fix stands on its own merits (it also helps the
UNSCOPED ladder — the floor and the token layer both apply regardless of `scopedRepair`).

**Impact:** `plugin/templates/shared/.claude/engines/pandacorp-build.js` (real-token layer:
`buildTokensByFrd`/`buildTokensReliable`/`repairTokensByFrd`/`recordWaveBuildTokens`/`tokenRepairBudget`/
`chargedRepair`, `canAffordRepair`'s OR check, two `budget`-shadowing local var renames), byte-identical
copy at `mission-control/.claude/engines/pandacorp-build.js` (`cmp` confirmed). Five new scenarios in
`plugin/scripts/test-pandacorp-build.mjs` (`// ---- BL-0138 ----`, appended at the end). Doc:
`factory/standards/build-orchestration.md` §"gate-report.json and scoped repair" paragraph updated to
describe both the floor and the real-token layer, and to separate the budget question (closed) from the
scoped-repair-default question (still open, criterion above). Plugin version bump + `plugin/docs/decision-log.md`
entry: left to the close-out agent per this session's own scope boundary (BL-0147 close-out work is
active on a sibling branch touching the same engine).

## Corroborating observation (2026-09-21, owner-stated, unverified)
Independently of this item's own root-cause analysis, the owner voiced the same-shaped complaint from the
outside: on a RED gate, `implement`'s repair loop feels like it "rehace demasiadas cosas" (redoes too much)
instead of diagnosing and fixing the specific failure or exploring an alternative — a hypothesis, not yet
confirmed against `track.jsonl` + `~/.claude/dashboard-events.ndjson`. This item's own fix (WP-08's targeted
`--only`/`--files`-scoped repair, currently defaulting off because of the budget bug this item tracks) is
exactly the mechanism that would address the owner's framing once `scopedRepair` can safely default to
`true`. Worth re-checking the owner's hypothesis against real run data once this item's fix lands and
`scopedRepair` flips on, to confirm the perceived over-correction goes away rather than assuming it does.
