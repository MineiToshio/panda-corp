---
id: LESSON-0233
type: gotcha
domain: data-modeling
tags: [zod, zod4, standard-schema, content-collections, refinement]
context: adding a cross-field validation (superRefine) to a Zod schema that is also consumed by a host expecting the Standard Schema interface (e.g. @content-collections/core's defineCollection)
trigger: use this when a Zod schema needs a cross-field invariant (superRefine/refine) and that schema is also consumed by a Standard-Schema-typed host (e.g. content-collections' defineCollection)
source: "personal-page-v2 .pandacorp/run/lessons.md (agent-inferred) — Zod 4 (4.4.3 verified live): z.object({...}).superRefine(...) returns a ZodObject that still carries ~standard (StandardSchemaV1), NOT a Zod-3-style ZodEffects wrapper. A cross-field pair invariant can be attached to a schema already consumed by a Standard-Schema host (@content-collections/core@0.15.2 types defineCollection({ schema: StandardSchemaV1 })) without touching the host config or losing the inferred document type. The Zod-3 reflex ('a refinement breaks .shape/the collection typing, so validate outside the schema') is stale and leads to a second, driftable validation site."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a project needed a cross-field validation invariant on a Zod schema that was also consumed
by a host library typed against the Standard Schema interface (`content-collections`' `defineCollection`),
and the instinct was to validate outside the schema to avoid "breaking" the host's typing — a Zod-3-era
reflex, since in Zod 3 wrapping a schema in `.refine()`/`.superRefine()` produces a `ZodEffects` wrapper
that can break code expecting `.shape` or the collection's inferred document type.

**Lesson:** in Zod 4 (verified 4.4.3), `z.object({...}).superRefine(...)` returns a `ZodObject` that still
carries `~standard` (`StandardSchemaV1`) — it does NOT wrap into a separate `ZodEffects`-style type as in
Zod 3. A cross-field invariant can be attached directly to a schema already consumed by a Standard-Schema
host (e.g. `@content-collections/core`'s `defineCollection({ schema: StandardSchemaV1 })`) without
touching the host's config and without losing the inferred document type. The old Zod-3 reflex of
validating outside the schema "to be safe" is stale under Zod 4 and just creates a second, driftable
validation site for no reason.

**Apply next time:** on Zod 4, attach cross-field refinements (`superRefine`/`refine`) directly to a
schema consumed by a Standard-Schema-typed host — verify the resulting type still satisfies
`StandardSchemaV1` before assuming it needs to move outside the schema.
