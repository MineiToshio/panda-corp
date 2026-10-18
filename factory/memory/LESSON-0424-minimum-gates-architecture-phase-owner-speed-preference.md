---
id: LESSON-0424
type: pattern
domain: build-orchestration
tags: [architecture-phase, gates, owner-preference, scope-change, speed]
context: the architecture phase ballooned to many hours because of two mid-phase scope changes, a 190-state design round, and extra audits stacked on top of the mandated gates
trigger: use this when planning or running a multi-gate phase (architecture, design, or similar) and deciding how many review/audit checkpoints to insert, especially right after a mid-phase scope change has already extended the timeline
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-17 (owner-stated) — the owner was frustrated that the architecture phase took many hours (two mid-phase scope changes + a 190-state design round + extra audits)"
provenance: owner-stated
created: 2026-10-18
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0274, LESSON-0390, LESSON-0246]
---

**Situation:** funko-tracker's architecture phase ran for many hours, driven by two mid-phase scope
changes, a 190-state design round, and additional audits layered on top of the phase's own mandated
gates. The owner flagged the total elapsed time as frustrating.

**Lesson:** this owner's default expectation (consistent with LESSON-0274's "optimize for
time-to-first-useful-result" and LESSON-0390's "don't keep re-auditing an already-sufficient hand-off")
is the MINIMUM mandatory gate set plus one fix pass, then ship — not every extra review/audit/owner
checkpoint a phase could in principle run, especially once a mid-phase scope change has already eaten
into the budget. Stacking additional checkpoints onto an already-extended phase compounds the owner's
frustration rather than buying confidence proportional to the extra time spent.

**Apply next time:** when running a multi-stage phase (architecture, design, or similar) for this owner,
default to the minimum mandated gates + a single fix pass. Any ADDITIONAL review/audit/owner checkpoint
beyond that mandated minimum should be explicitly non-blocking (deferred, async, or offered as optional)
rather than inserted into the critical path — and this applies with extra force once a mid-phase scope
change has already extended the phase once.
