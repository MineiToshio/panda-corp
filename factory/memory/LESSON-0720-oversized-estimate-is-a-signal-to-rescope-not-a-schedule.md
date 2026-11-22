---
id: LESSON-0720
type: pattern
domain: build-orchestration
tags: [scope, estimation, red-team, planning, owner-preference]
context: a coordinator/planner produces a multi-hour (or multi-day) worker-hour estimate for an implementation and the instinct is to accept it and start executing
trigger: use this when a plan/estimate for an implementation comes back far beyond a few hours of work, before deciding whether to start executing it
source: "panda-corp, factory/memory/_inbox.md 2026-11-22 (owner-stated): the coordinator for the implement-goal-based (p46) rollout accepted a 177-314 worker-hour plan estimate and started executing it instead of stopping to red-team the scope"
provenance: owner-stated
created: 2026-11-22
status: active
promotion: proposed   # 2026-11-22 (librarian harvest) — target: factory/standards/build-orchestration.md (a planning-gate default alongside DR-100/DR-131's right-sizing rules, at the WHOLE-implementation altitude rather than per-work-order)
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0424, LESSON-0390]
---

**Situation:** a coordinator planning a factory-internal rollout produced a plan whose own estimate was
177-314 worker-hours, and proceeded straight into execution on that estimate rather than treating the
number itself as a finding. The owner's explicit correction: a large implementation for this factory
should take roughly 1-2 hours, a few hours at most.

**Lesson:** an estimate that lands far beyond "a few hours" is not a schedule to accept and staff — it is
a signal that the scope itself is wrong (too large, too many concerns bundled together, or genuinely
over-complicated for what's being built) and needs to be RE-SCOPED or SIMPLIFIED before any execution
starts, the same way DR-100/DR-131 treat an oversized work order or FRD as a planning defect rather than
a number to schedule around. This generalizes LESSON-0424's "default to the minimum mandated gates, not
every checkpoint a phase could in principle run" one level up: it isn't only about capping review/gate
rounds once work is underway, it's about treating the INITIAL estimate itself as a stop-and-reconsider
trigger, before a single hour is spent.

**Apply next time:** when a plan's own estimate comes back well beyond a few hours (for this factory:
roughly 1-2 hours typical, a few hours as the outer bound for "large"), do not start executing on
schedule — stop and red-team the SCOPE first: can it be split into independently-shippable slices, is a
chunk of it actually optional/deferrable, is the complexity itself the symptom of trying to do too much at
once. Treat the oversized number as the finding, not as information to plan around.
