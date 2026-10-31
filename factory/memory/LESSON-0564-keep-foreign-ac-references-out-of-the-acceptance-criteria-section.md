---
id: LESSON-0564
type: gotcha
domain: build-engine
tags: [commit-wo, ac-citation, work-order-authoring, acceptance-criteria, false-positive]
context: a work order's "## Acceptance Criteria" section text mentions another WO's or a sibling's AC id for explanatory context, not as one of ITS OWN acceptance criteria
trigger: "use this when authoring/editing a work order and you need to reference an AC id that belongs to a DIFFERENT work order for context — before writing that reference inside the Acceptance Criteria section itself"
source: "mission-control factory/memory/_inbox.md 2026-10-30 (agent-inferred); WO-11-003/WO-02-020 — commit-wo's AC extraction (build-mech-lib.mjs woAcIds) scans the entire Acceptance Criteria section body for any AC-id-shaped token, so an explanatory reference to a foreign AC inside that section is treated as one of THIS WO's own ACs and triggers ac-uncited if no test cites it"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0293, LESSON-0008]
---

**Situation:** a work order's "## Acceptance Criteria" section needed to reference a sibling WO's AC id
purely for context (e.g. "this extends the computation also used by AC-02-020.3, owned by WO-02-020").
`commit-wo`'s AC-citation floor extracts EVERY AC-id-shaped token found anywhere in that section's text,
not just the ids that are actually this WO's own assigned criteria — so the foreign reference was treated
as one of this WO's own ACs, and because no test in this WO cites that foreign id, the commit was refused
(`ac-uncited`).

**Lesson:** the mechanistic AC-extraction in the build engine reads the whole "## Acceptance Criteria"
section body as a flat text scan, with no distinction between "this is one of my own criteria" and "this
mentions someone else's id for context" (the same class of trap as LESSON-0008's line-anchored-parsing
lesson — a naive scan over a region finds ANY matching token, not just the structurally-correct ones).
Until the extraction itself is fixed (tracked separately, BL-0293), any AC id written inside that section
is at risk of being claimed as the WO's own.

**Apply next time:** when a work order needs to mention another WO's AC id for context, put that
reference in "## Out of Scope" (or any section other than "## Acceptance Criteria"), never inside the
Acceptance Criteria section body itself — keep that section limited to the ids actually assigned to THIS
work order. This avoids the false `ac-uncited` refusal without needing the engine fix to land first.
