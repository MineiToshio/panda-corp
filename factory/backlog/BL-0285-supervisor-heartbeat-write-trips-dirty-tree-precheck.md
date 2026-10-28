---
id: BL-0285
type: bug
area: build-engine
title: "implement SOP's supervisor_heartbeat write into status.yaml trips the baseline dirty-tree precheck, escalating needlessly (BL-0124/BL-0160 class, third recurrence)"
status: open
severity: p2
opened: 2026-10-28
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-23 (agent-inferred): the implement SOP has the supervisor write supervisor_heartbeat into status.yaml, but the baseline precheck then sees status.yaml dirty and escalates; heartbeat writes and the dirty-tree check disagree"
closes:
links: [BL-0124, BL-0160, LESSON-0426]
---

## Problem
The `implement` SOP has the live supervisor write `supervisor_heartbeat` into the project's
`.pandacorp/status.yaml` on its own cadence (a liveness signal). Separately, the baseline self-heal's
dirty-tree precheck (the same mechanism class BL-0124 and BL-0160 already fixed for the LEASE-renewal
write path) inspects `git status` and, on seeing `status.yaml` modified, escalates to a full
baseline-repair cycle — even though the only change is the supervisor's own legitimate, expected
heartbeat write. This is observed on mission-control during a live `implement` run, via the heartbeat
write path specifically (not the lease-renewal path BL-0124/BL-0160 already excluded).

## Root cause
_(to confirm during the fix — stated as a working hypothesis, not yet verified against the live code
path.)_ BL-0124's exclusion (`leasedStatusOnly`, shipped as commit `e52bdfc1`, plugin 9.103.0) and
BL-0160's bare-path tightening were scoped to the specific write shape produced by the engine's own
lease-renewal mechanism. The SOP's supervisor heartbeat write may go through a DIFFERENT code path/timing
than the one those two fixes exercise, so the dirty-tree precheck's exclusion never matches it — the same
class of gap BL-0160 found in BL-0124's own regression coverage (a fix that works for the shape its tests
cover, but not for every real shape that touches the same field).

## Fix plan
1. Reproduce: run `implement` long enough for the supervisor to write `supervisor_heartbeat`, then trigger
   (or observe) the baseline dirty-tree precheck while that write is the ONLY dirty path, and confirm
   whether it escalates.
2. Compare the exact `dirtyPaths`/write shape the heartbeat write produces against the `leasedStatusOnly`
   exclusion BL-0124/BL-0160 already ship — determine whether the heartbeat write goes through the SAME
   lease-aware path (and the exclusion has a gap) or a genuinely separate path never covered by either fix.
3. Extend the SAME exclusion logic (not a parallel, second special-case) to also recognize a
   supervisor-heartbeat-only `status.yaml` diff as non-dirty for precheck purposes, under the same
   "valid active lease/run" condition BL-0124 already requires — never a blanket `.pandacorp/` exemption.
4. State plainly in this item's close-out whether this was a BL-0124/BL-0160 regression, a distinct gap,
   or the same root cause reached via a new write path — per the precedent BL-0160 itself set.

## Tests (prove the fix — TDD, RED → GREEN)
Extend the existing `WP04a/b/c` + `BL-0160a/b/c/d` regression suite (`plugin/scripts/test-pandacorp-build.mjs`)
with a new scenario: a project with a valid active run/lease whose ONLY dirty path is `status.yaml`,
produced specifically via the supervisor's heartbeat-write code path (not the lease-renewal path the
existing scenarios already cover). RED = precheck escalates; GREEN = it does not. Control: a dirty path on
any OTHER file, or a heartbeat write WITHOUT a valid active run, must still escalate.

## Done when
- The new regression scenario passes GREEN; the existing WP04/BL-0160 scenarios remain GREEN (no
  regression).
- This item's close-out states which of the three hypotheses in "Root cause" was confirmed.
- `bash plugin/scripts/run-engine-tests.sh` green twice; plugin version bumped (PATCH); decision-log entry
  added linking BL-0124 and BL-0160.

## Out of scope
Any change to what counts as a "valid active lease/run" (that contract is BL-0124/BL-0079's scope,
already shipped) — this item only extends the exclusion to cover the heartbeat write's shape.
