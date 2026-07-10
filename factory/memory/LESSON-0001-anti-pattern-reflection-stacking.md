---
id: LESSON-0001
type: anti-pattern
domain: factory-engineering
tags: [self-learning, memory, harvesting, governance, poisoning]
context: harvesting lessons by stacking reflections-on-reflections instead of anchoring to concrete evidence
trigger: use this when designing or running the lesson harvester and deciding whether a reflection-style insight qualifies as a storable lesson
source: docs/proposals/09-self-learning-factory.md (deep-research 2026-06-15; ExpeL, arXiv:2308.10144)
provenance: agent-inferred
created: 2026-06-15
status: active
promotion: approved
confidence: high
times_applied: 3
applied_in: [mission-control, personal-page-v2, panda-corp]
links: [DR-047, DR-017, MEM-1, MEM-2]
---

**Situation:** When designing the factory's self-learning loop, the intuitive move is "have the agent
reflect on its experience and store the reflection." The ExpeL paper measured exactly this: adding a
layer of *reflections on top of* harvested success/failure pairs was **disadvantageous** — the
reflections hallucinate and mislead insight extraction. More experience is not unconditionally better.
A-MEM independently documents a memory-poisoning vulnerability in the same family of systems.

**Lesson:** A harvested lesson must be anchored to **concrete, falsifiable evidence** — a real bug, a
real library outcome, a real diff, a real reviewer finding — not to a model's free-form reflection
about what it "thinks" it learned. Store **candidates**, corroborate before trusting, and keep a human
gate on anything that propagates (this is Memory Poisoning, DR-017/OWASP-Agentic).

**Apply next time:** When building or running the harvester (Phase 1), each lesson must cite its
evidence in `source:` and start as `status: candidate`. Reject "lessons" that are reflections without
a concrete anchor. Do not let the memory grow by self-reflection; let it grow by verified experience.

**Auto-proposed for promotion** (2026-07-05): cited by 3 projects (mission-control, personal-page-v2, panda-corp) — measured by count-lesson-citations.sh.

**PROMOTED** (2026-07-09, owner-approved): codified as `factory/standards/memory-harvesting.md` — **MEM-1** (every `source:` names a checkable locator; anchorless prose is reject-at-harvest, never a candidate) and **MEM-2** (the store grows by verified experience; a reflection lesson cites only evidence-anchored `LESSON-NNNN` ids). MEM-1 ships **wired and fail-closed**: `plugin/scripts/validate-memory.sh` rejects an anchorless `source:`. The gate earned its keep on the same day it landed — it caught LESSON-0076, whose `source:` described a real incident with no locator (now anchored).

**Rationale:** this is the loop's own anti-poisoning invariant (DR-047's eval-gate already encodes half of it — cross-corroboration before `active` — but the OTHER half, reject-at-harvest for anchorless notes, currently lives only as agent instruction in this skill's step 1/README, never as a standard or a deterministic check). Three independent projects have now exercised the harvester and none violated it, which is exactly the recurrence signal DR-047 asks for before promoting a lesson to a rule — promoting closes the gap between "the librarian is told to do this" and "the factory verifies it was done."
