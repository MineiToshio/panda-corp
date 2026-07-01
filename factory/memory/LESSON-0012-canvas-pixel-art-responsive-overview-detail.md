---
id: LESSON-0012
type: pattern
domain: web-performance
tags: [responsive, canvas, pixel-art, mobile, ux-pattern]
context: adapting a fixed-size pixel-art canvas scene to mobile viewports without breaking the pixel-art rendering or losing at-a-glance information
source: mission-control lessons.md — Party/La Fragua pixel-art scene mobile adaptation (2026-06-2x)
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: []
---

**Situation:** Mission Control's Party pixel-art canvas (fixed native pixel size) needed a mobile-viewport
adaptation. Two naive approaches both fail: shrinking by a non-integer factor blurs pixel art (no clean CSS
fix — confirmed against MDN); panning the full scene at native scale linearizes the view and loses the
at-a-glance overview (confirmed against NN/g research on small-screen wayfinding).

**Lesson:** For a fixed-size pixel-art/canvas scene that must work on mobile, the correct pattern is
**overview + detail**: a small glanceable mini-map/overview (communicates position/relative
length/relationships at a glance) plus drill-down into one "room"/region rendered at native scale (crisp,
readable). Neither scaling nor panning the entire scene preserves both the pixel-art fidelity AND the
glanceable function; overview+detail preserves the *function* (what the user needs to know at a glance),
not the raw visual richness.

**Apply next time:** When a desktop-first canvas/pixel-art/game-like scene needs a mobile adaptation, don't
default to "shrink it" or "let them pan it" — design an explicit overview (mini-map) + detail (native-scale
single-region) split from the start.
