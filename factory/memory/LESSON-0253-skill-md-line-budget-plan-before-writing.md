---
id: LESSON-0253
type: gotcha
domain: documentation
tags: [skill-md, line-budget, structural-test, gate, context-budget]
context: adding operational detail to a stage/section of a SKILL.md (or similar procedural doc) that is covered by a hard line-count structural test
trigger: use this when about to add detail to a SKILL.md stage and the file is enforced by a structural test with a hard line cap
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-20 (agent-inferred) — scripts/blog-generator/_tests/skillV2.structure.test.ts enforces SKILL.md <= 310 lines; adding operational detail directly to a stage REDs the gate"
provenance: agent-inferred
created: 2026-09-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0029, LESSON-0226]
---

**Situation:** a structural test enforced a hard line-count budget on a SKILL.md file (<= 310 lines).
Adding operational detail straight into a stage's own text pushed the file over the cap and REDed the
gate — discovered only after writing the detail.

**Lesson:** when a procedural doc is covered by a hard line-count gate, the budget is not a soft guideline
to notice after the fact — it is a structural constraint on WHERE detail can live: the stage itself should
stay a short, stable pointer, and the operational detail belongs in a `references/` file the stage links
to. This is the SKILL.md-specific case of the always-loaded-budget discipline (LESSON-0029) enforced
mechanically rather than by convention, and it composes with structural/mutation testing of prose artifacts
(LESSON-0226) — the gate that catches line-count overflow is the same family of doc-as-contract
enforcement.

**Apply next time:** before writing new stage content in a line-budgeted SKILL.md, decide up front whether
the detail belongs inline (short, stable) or in `references/` (longer, procedural) — budget the lines
mentally before writing, rather than writing first and letting the structural test reject it.
