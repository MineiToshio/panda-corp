---
id: LESSON-0489
type: pattern
domain: design-process
tags: [responsive, visual-consistency, screenshot-review, parallel-review, verification-pass]
context: auditing a multi-screen UI for responsive correctness or cross-screen visual consistency using parallel screenshot-reviewing subagents
trigger: use this when running a responsive-breakpoint audit or a cross-screen visual-consistency pass over a multi-screen prototype or app
source: "mission-control .pandacorp/run/lessons.md 2026-10-21/22 (agent-inferred) — Orbita responsive pass and cross-screen consistency pass"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0059]
---

**Situation:** two related audits over the same multi-screen redesign — a responsive pass at 375/768px,
and a pass to make every screen read as one coherent app — both used the same structure: fan out
independent screenshot-reviewing subagents per route group, fix by shared root cause rather than screen
by screen, then run a SECOND reviewer pass on fresh captures to verify the fix. The second pass caught
real defects (two hidden-data clips) the first pass had missed.

**Lesson:** a responsive or visual-consistency defect in a multi-screen UI is rarely screen-local — the
same root cause (a shared command, table, chip-beside-title, or column pattern; one CSS rule reused
across screens) usually recurs across several screens, so fixing instance-by-instance as each reviewer
finds it just re-creates the same drift it was meant to remove. And a single review pass is not
exhaustive even when thorough — a second pass against FRESH, post-fix captures is what catches what the
first pass missed, not a bigger first pass.

**Apply next time:** (1) fan out one screenshot reviewer per route group/surface, at every width being
audited; (2) group their findings by SHARED cause (the same component class, the same CSS rule) rather
than fixing per-screen; (3) for a cross-screen-consistency pass specifically, first catalogue every
variant of each component across all screens, then write ONE shared rule per component class; (4)
re-capture and run a SECOND independent reviewer pass against an explicit finding/rule list before
calling it done — budget for two passes, not one.
