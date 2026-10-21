---
id: LESSON-0462
type: gotcha
domain: build-orchestration
tags: [build-plan, parser, markdown-heading, wo-id, dag, applychangeplan]
context: authoring or editing a Build Plan markdown doc that also contains a human-readable visual/summary table using WO-style IDs
trigger: use this when a Build Plan doc needs a purely informational/visual table that lists WO-like IDs, placed near the canonical WO table
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-20 (agent-inferred) — FRD-03 Build Plan integration"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0267]
---

**Situation:** FRD-03's Build Plan doc included a visual/informational table, nested under a `###`
heading directly below the canonical WO table's own section, listing WO-style IDs for human
readability. The canonical Build Plan integrator read both tables as one and overwrote the real
work orders' dependencies with the visual table's rows, corrupting the DAG. Promoting the visual
table's heading from `###` to `##` (making it an independent, sibling top-level section rather than
a subsection nested under the canonical table) separated the two tables cleanly, with no change to
the DAG data or the parser's own code.

**Lesson:** the canonical Build Plan parser uses heading-level nesting as its scope boundary for
"what belongs to this table," not column headers or table position alone. A table that is purely
informational/visual is NOT inert to it merely because a human reader would see it as decoration —
if it is nested as a subsection under the canonical table's heading and reuses WO-ID-shaped text, it
is read as additional rows of the SAME table.

**Apply next time:** when a Build Plan (or any other machine-parsed doc) needs a purely informational
table containing WO-like IDs, give it its own top-level heading as a SIBLING of the canonical table's
section, never a subsection nested under it — and after authoring, validate the actual integration
with the canonical parser/tooling (not just a visual read) before trusting the resulting dependency
graph. See `BL-0267` for the parser-hardening side of this finding.
