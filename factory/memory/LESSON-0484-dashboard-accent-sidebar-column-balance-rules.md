---
id: LESSON-0484
type: pattern
domain: ui-design
tags: [design-rules, accent-color, sidebar-layout, two-column, visual-coherence]
context: explicit owner-stated layout/color conventions for a dashboard-style redesign, covering accent usage, secondary-sidebar placement and two-column balance
trigger: use this when establishing or reviewing layout/color conventions for a dashboard-style app with status/severity indicators, secondary sidebars, or multi-column sections
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (owner-stated) — Orbita redesign design rules"
provenance: owner-stated
created: 2026-10-22
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0422]
---

**Situation:** reviewing the Orbita redesign, the owner stated a set of standing layout/color rules
rather than a one-off fix: no coloured accent stripes on edges anywhere; secondary sidebars belong on
the right; each category gets exactly one hue, with red/amber/green reserved exclusively for
status/severity (never for plain category identity); and a two-column layout's two columns should end
at a similar height.

**Lesson:** these read as durable visual-coherence conventions, not one-off preferences for a single
screen. An accent-colour edge stripe reads as decoration competing with real status colour. A secondary
sidebar's position is part of the app's spatial grammar, not a per-screen choice. Semantic colours
(red/amber/green) lose their signal value the moment they are ALSO used for mere category identity (see
LESSON-0422 on reserving accent for one role). A two-column layout whose columns end at very different
heights reads as unbalanced or unfinished even when each column is individually fine.

**Apply next time:** when designing or reviewing a dashboard-style multi-section app, check new screens
against these four conventions explicitly: don't invent a parallel accent-stripe treatment; place a new
secondary sidebar on the right by default; reserve red/amber/green for status/severity only, with one
distinct hue per category otherwise; and balance a two-column layout's content so both sides end near
the same height (via reflow, panel sizing, or a shared min-height) — the same "don't invent a parallel
scale" discipline the project's own visual-coherence standard already applies to colour/spacing/radii.
