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
promotion: none
confidence: high
times_applied: 1
applied_in: [mission-control]
links: [DR-047, DR-017]
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
