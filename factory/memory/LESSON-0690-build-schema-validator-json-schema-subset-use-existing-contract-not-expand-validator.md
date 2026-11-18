---
id: LESSON-0690
type: pattern
domain: build-engine
tags: [json-schema, validation, schema-subset, scope-discipline]
context: considering adding a JSON Schema keyword (e.g. minItems) to the build engine's own schema validator to express a local constraint
trigger: use this when a build-engine fix seems to need a JSON Schema keyword the engine's validator does not currently support
source: "funko-tracker br-2026-11-16-01, BL-0329 fix work — minItems was considered to express 'this array must be non-empty' and rejected as unsupported by the engine's validator, which deliberately implements only a subset of JSON Schema; the constraint was instead expressed through the existing array-type contract plus a command-level validation check."
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0329]
---

**Situation:** fixing a local build-engine bug seemed to call for a stricter JSON Schema constraint
(`minItems`, to assert a field's array must not be empty). The engine's own schema validator rejects
`minItems` — it deliberately supports only a chosen subset of JSON Schema keywords, not the full spec.
Expanding the validator to add one keyword for one local fix was rejected in favor of expressing the same
constraint through the mechanism already in place: the existing array-type contract plus an explicit
command-level validation check.

**Lesson:** a deliberately narrowed schema validator is a scope decision, not an oversight — widening it
to accommodate one local need reopens surface area (and future compatibility burden) across every schema
it validates, for a constraint that a narrower, already-existing enforcement point (a command-level check)
can express just as well. Before adding a new keyword/capability to a shared validator for a one-off case,
check whether the existing contract design already has a cheaper, more scoped place to enforce it.

**Apply next time:** when a local fix seems to need a new JSON Schema keyword in this engine's validator,
default to expressing the constraint via the existing array/field-type contract plus a command-level
validation check instead of expanding the schema validator itself; only widen the validator when the
constraint genuinely cannot be expressed any other way and is needed across multiple call sites.
