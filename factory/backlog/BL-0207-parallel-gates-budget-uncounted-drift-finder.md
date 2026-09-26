---
id: BL-0207
type: change
area: build-engine
title: "the launcher's parallelGates maxAgents sizing advice (15 x FRDs) doesn't add the drift finder's own unit, and with parallelGates now default-on the run can saturate maxAgents one reopen short of finishing"
status: open
severity: p2
opened: 2026-09-26
closed:
source: "docs/reviews/canary-f2-report.md §4.4 (canary F2, wf_8bab7752-702)"
closes:
links: [BL-0201, BL-0203, BL-0173]
---

## Problem
Canary F2 (4 FRDs, `parallelGates:true, gateSlots:2, gateEvidence:'digested', driftFinder:true, maxAgents:60`)
ended with the engine's own log line "Agent ceiling reached (60 ≥ maxAgents 60) but no work remains
(F5/BL-0177)" — the whole run's `maxAgents:60` weight was spent exactly as the run finished. The report notes:
"A 4-FRD, gates-only replay with the finder used the whole `maxAgents: 60` weight. One more reopen would have
ended the run as an agent-cap stop." `plugin/scripts/launch-implement.sh`'s own sizing advice (15 x the FRDs
to gate, e.g. 60 for 4 FRDs) already accounts for the gate link (~6 units: probe + digested collector + opus
review + release) and a reopen ladder (~7-9 units), but its comment explicitly names the finder as an EXTRA
unit only when `gateEvidence:'digested'` — it does not surface that in the printed sizing math, so an owner
following the printed formula alone under-budgets by ~1 unit per FRD whenever the digested finder is
also on (its default state, since `driftFinder` defaults on under `digested` — and `parallelGates` itself
now defaults on too, v9.116.0, making this combination the common case, not an edge case).

## Root cause
The launcher's sizing formula and warning text (`plugin/scripts/launch-implement.sh`, the `PARALLEL_GATES`
budget block) is written for the gate + landing + reopen-ladder cost alone; it was not updated when BL-0203
added the drift finder as a per-gate-link cost (`+1` sonnet unit under `gateEvidence:'digested'`, confirmed by
the engine's own `gateCostEstimate` comment: `1 + (GATE_EVIDENCE === 'digested' ? 1 : 0) + (DRIFT_FINDER ? COST('sonnet') : 0) + …`).
The launcher's advisory text never reads `GATE_EVIDENCE`/`DRIFT_FINDER`, so it can't reflect the extra unit.

## Fix plan
- `plugin/scripts/launch-implement.sh`: when the launch reaches its parallel-gates sizing block, factor in
  whether `--gate-evidence digested` (or its default) and `--drift-finder` (explicit or implied default: on
  under digested) are in effect, and bump the per-FRD floor accordingly (e.g. 15 → 16-17 x FRDs when the
  finder is active) — or, simpler and more robust to future per-gate cost changes, read the floor from the
  same constant/formula the engine itself uses (`gateCostEstimate`) instead of a hand-maintained "15" in two
  places (DRY, `clean-code.md`).
- Add an explicit WARNING at 80% of `maxAgents` consumed with gates/FRDs still pending — the engine already
  computes `agentSpawned` vs `MAX_AGENTS`; log a one-line advisory the moment remaining budget can no longer
  cover one more reopen ladder for a pending FRD, so an owner watching the log sees the risk before the run
  silently agent-caps.

## Tests (prove the fix — TDD, RED → GREEN)
- Extend `plugin/scripts/test-build-run-id.mjs`'s parallel-gates sizing tests: a run with `--gate-evidence
  digested` (finder on by default) and `maxAgents` at the OLD floor (15 x FRDs) still warns (the new,
  finder-aware floor is higher); a run with `--gate-evidence explore --drift-finder off` at the old floor
  does NOT warn (no finder cost to add).
- An engine unit test (`test-pandacorp-build.mjs`) asserting a log line fires once remaining budget drops
  below one reopen-ladder's cost with FRDs still ungated.

## Done when
- [ ] The launcher's sizing floor accounts for the drift finder's cost whenever it is active (explicit or
      default-on).
- [ ] A near-exhaustion advisory log exists and is tested.
- [ ] `plugin/skills/implement/SKILL.md`'s `parallelGates`/`driftFinder` table rows are updated to state the
      combined floor.

## Out of scope
- Changing the cost-weighted budget model itself (`COST()`, `gateCostEstimate`) — this item only makes the
  EXISTING model's number reach the owner's launch-time sizing decision, and adds an in-run early warning.
