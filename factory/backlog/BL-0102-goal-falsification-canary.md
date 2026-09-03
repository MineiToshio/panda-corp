---
id: BL-0102
type: change
area: build-engine
title: "Run the /goal falsification canary and close R-17 permanently if the predicted outcome holds"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-17 (already dead as an adoption, §10.1)"
closes:
links: []
---

## Problem
`/goal` was proposed as a partial replacement for the hand-rolled supervisor
(`plugin/skills/implement/SKILL.md:70,77,91`) and **died on the primary source**: `docs/en/goal` states the
evaluator is skipped while a subagent or background shell is running (the build is a background Workflow for
its entire duration), that it *"does not call tools"*, that check-ins back off 30 m → 1 h → 2 h, and that
at most **three** idle check-ins run per goal. What survives is a narrow optional use — a turn-continuation
nudge in an **attended** session only. Impact: L. The value of this item is closing the question with
evidence instead of leaving it re-litigable.

## Fix plan
On ONE supervised build with `maxFrds 1`, set `/goal "the run has ended with phase: release or a BLOCKED
reason recorded in status.yaml"` **alongside** the existing supervisor (never replacing any part of it), and
record (a) how many times the evaluator ran while the Workflow was in flight, and (b) whether any check-in
was delivered between minute 30 and the run's end. **Docs predict (a) ≈ 0 and (b) at most one.** If that
holds, write the result into `plugin/docs/decision-log.md` and close R-17 permanently.

## Tests (prove the fix — TDD, RED → GREEN)
The two recorded counts from one supervised build.

## Done when
The counts are recorded with the build they came from; `plugin/docs/decision-log.md` states whether `/goal`
is adopted as an attended nudge or closed; the supervisor contract is unchanged either way.

## Out of scope
Any change to the heartbeat, the `ScheduleWakeup` lease renewal or the termination judgement — §10.1
established `/goal` substitutes for none of them.
