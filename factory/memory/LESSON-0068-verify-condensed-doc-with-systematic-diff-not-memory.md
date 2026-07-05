---
id: LESSON-0068
type: gotcha
domain: documentation
tags: [documentation, refactoring, condensation, doc-migration]
context: condensing or restructuring a long canonical doc into a shorter/differently-organized one
trigger: use this when condensing, splitting, or restructuring a long canonical document and needing to confirm no operative content was lost
source: "panda-corp — CLAUDE.md to AGENTS.md condensation, caught by independent Codex verification pass, 2026-07-04"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0067, LESSON-0069]
---

**Situation:** condensing `CLAUDE.md` into the new tool-agnostic `AGENTS.md` (moving Claude-specific
content into a thinner layer), the builder asserted "nothing lost" from confidence/recollection — but an
independent verification pass found real operative facts had silently dropped: the `deploy_target` field,
the DR-085 hardening requirement, and a canonical-doc mapping table all went missing and had to be
restored.

**Lesson:** when inverting or condensing a long canonical document, a summary written from memory/
confidence ALWAYS loses operative facts — the ones that feel like "detail" to the summarizer but are
load-bearing rules to a future reader (a specific field name, a specific gate requirement, a specific
table). "I reviewed it and nothing important is missing" is not evidence; it is the same failure mode as
self-reported verification anywhere else in the factory. The check that actually catches this is a
systematic, fact-by-fact diff between the old and new document — not a holistic re-read.

**Apply next time:** whenever a canonical doc is condensed/restructured/migrated, do a literal line-by-line
or fact-by-fact comparison (a real diff, or an explicit checklist enumerating every rule/field/table in the
source doc and confirming each has a home in the new one) before declaring the migration complete — never
rely on a confident holistic re-read to catch what a summary silently drops.
