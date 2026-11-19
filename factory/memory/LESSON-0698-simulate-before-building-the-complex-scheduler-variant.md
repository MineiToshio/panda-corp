---
id: LESSON-0698
type: pattern
domain: build-engine
tags: [scheduler, allocator, simulation, design-validation, dr-162, simplicity]
context: deciding between a simple threshold/preference rule and a more complex pacing/budget-based design for a scheduler or resource allocator, before committing to build the complex one
trigger: use this when designing a scheduler/allocator and you are tempted to build a pacing/budget-weighted mechanism without first simulating whether a simpler rule already reaches the same outcome
source: "mission-control .pandacorp/run/lessons.md 2026-11-13, during the DR-162 shared-capacity-allocator design (agent-inferred): a simulation comparing a simple preference-plus-85%-threshold rule against a pacing-budget-based allocator found both completed the same set of tasks; the budget-based design's only added value was that its pacing raised respect for task-type preference, not throughput or completion."
provenance: agent-inferred
created: 2026-11-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-162]
---

**Situation:** while designing the cross-tool capacity allocator (DR-162), a pacing/budget-weighted
scheduling mechanism was proposed as more correct than a plain preference-ordering-plus-threshold rule.
Before building it, both designs were run against the same simulated workload.

**Lesson:** the simple rule (route by preference, fall back to the other tool only past an 85% usage
threshold) completed the identical set of tasks as the more complex pacing-budget design in simulation.
The complexity bought exactly one thing — a sharper respect for stated task-type preference in HOW tasks
were ordered — not more work finishing, not better throughput. A cheap simulation surfaced that the
complex design's benefit was narrower than its name suggested, before any of it was built.

**Apply next time:** before building a more elaborate scheduling/allocation mechanism over a simpler
rule-based one, simulate both against the same representative workload first and name PRECISELY what
the complex design buys (which metric improves, not just "it feels more correct"). If a simple
threshold/preference rule matches the complex design's task-completion outcome, ship the simple one and
only add the complexity for the specific, named benefit it actually demonstrated — never for a presumed
correctness gain that a cheap simulation can falsify first.
