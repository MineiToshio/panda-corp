---
id: LESSON-0200
type: anti-pattern
domain: content-modeling
tags: [content-schema, positional-data, index-matched, silent-desync, structured-edit]
context: content fields defined as parallel arrays matched by POSITION (index) rather than an explicit key, and structured edits to a literal array made via index arithmetic
trigger: use this when a content schema pairs two arrays by position (e.g. captions matched to images by index) or when editing a structured literal array (removing/reordering entries) by counting positions
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-06/2026-09-07 (agent-inferred, one facet owner-stated)"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** two related traps around positional structured data on the same project. (1) A case
study's caption list was matched to its image list purely by array index; reordering or re-mapping images
silently left captions describing screens no longer present — a content defect no test catches, only
found because the owner spotted it on the live page. (2) Splicing entries out of a TypeScript literal
array using index arithmetic silently ate an ADJACENT entry and left stray trailing tokens, surfacing only
as an opaque vitest `PARSE_ERROR`, not as a content bug.

**Lesson:** positional/index-matched correspondence between two structured lists is fragile — the
correspondence has no enforcement and degrades silently the moment either list's ORDER changes
independently of the other, or an edit is made by counting positions instead of matching content.

**Apply next time:** (a) when a schema pairs data by position, re-map BOTH sides together in the same
change, and prefer identifiers that name the content itself (not a former intent) so a mismatch is
visually obvious. (b) When editing a structured literal array, delete by matching whole BLOCKS (not index
arithmetic) and re-verify the resulting element list (e.g. `grep -n 'slug: "'`) before running anything
else.
