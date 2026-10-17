---
id: LESSON-0351
type: pattern
domain: data-modeling
tags: [erd, logical-model, provenance, cardinality, diagram, mermaid]
context: proposing or reviewing a logical/ERD model viewer (or any generated diagram) that visualizes a designed schema against the actually-implemented one
trigger: use this when designing or reviewing a logical data-model/ERD viewer that renders a schema diagram from project artifacts
source: "factory/memory/_inbox.md agent-inferred note — Mission Control logical-data-model-viewer research, 2026-10-16 (Mermaid ER syntax + the logical-data-model-viewer proposal)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** proposing an ERD/logical-model viewer, the research separated two things that look
identical in a rendered diagram but are not: the DESIGNED model (what the blueprint/architecture says the
schema should be) and the EVIDENCE of the IMPLEMENTED schema (what the committed model definitions actually
contain). A narrative summary of the model does not prove any specific field or cardinality exists; a
nullable foreign key in the implemented schema does not prove the parent's minimum participation is
actually 1 (it could be optional in practice even if the design intends mandatory).

**Lesson:** a plausible-looking diagram is not evidence of the real schema. Cardinalities rendered from a
narrative description, or inferred loosely from column nullability, can silently misrepresent the actual
constraint. A viewer (or an agent) that presents a schema diagram as "the current state" without showing
where each fact came from is presenting a guess as a fact.

**Apply next time:** when building or reviewing a model/schema diagram, keep cardinalities EXPLICIT (never
inferred narratively) and show provenance/verification per edge or field — trace each relationship to the
specific migration/definition/constraint that establishes it, and flag anything derived rather than read
directly from the implemented artifact. Never let a nullable FK stand in for "this relationship is
optional" without checking the actual minimum-participation intent.
