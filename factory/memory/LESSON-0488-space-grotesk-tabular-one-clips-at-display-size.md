---
id: LESSON-0488
type: gotcha
domain: typography
tags: [typography, space-grotesk, tabular-figures, font-variant-numeric, display-numbers]
context: using a typeface's tabular figures for large/display-sized numbers
trigger: "use this when displaying large numbers in Space Grotesk (or diagnosing why a \"1\" looks clipped/odd at display sizes) and tabular figures (font-variant-numeric: tabular-nums) are applied project-wide for column alignment"
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — Orbita"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a project-wide `tabular-nums` convention (used so columns of numbers align) was applied
uniformly, including to large display-sized numbers. In Space Grotesk, the tabular-figure "1" is drawn
with a long top flag/stroke that, at display sizes, reads as a rendering glitch or a clipped glyph rather
than a deliberately styled "1".

**Lesson:** `tabular-nums`/`tabular-figures` optimizes a digit set for equal advance width (so a column of
numbers aligns), not for how any individual glyph looks blown up — a typeface's tabular "1" can be drawn
deliberately differently from its proportional "1" (e.g. with a longer flag) precisely because it's meant
to be seen small, inside a column next to other digits, not large and alone.

**Apply next time:** scope `font-variant-numeric: tabular-nums` to small aligned-column contexts (tables,
stat lists) and use proportional figures (`font-variant-numeric: normal`, or the typeface's default) for
large standalone/display numbers — don't apply one numeric-figure setting uniformly across every size in
the type scale.
