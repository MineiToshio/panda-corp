---
id: LESSON-0355
type: gotcha
domain: css
tags: [full-bleed, viewport-units, overflow, layout, side-rail]
context: reusing a "full-bleed" visual band/digest component (sized with `vw` units assuming it spans the full browser viewport) inside a layout that has a persistent side rail/panel narrower than the viewport
trigger: use this when reusing a full-bleed component sized with viewport-relative units (e.g. `50vw`) inside a container that does not span the full browser width
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-16: reusing a digest with full-bleed bands computed via 50vw inside the Portfolio view's side-rail layout caused the bands to overflow the panel (scrollWidth 1407 vs viewport 1280)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a visual "digest" component computed full-bleed band widths using `vw` (viewport-width)
units, correct when it was first built for a layout that spanned the entire browser viewport. Reused inside
the Portfolio view, which reserves a side rail, the same `vw`-based math produced bands wider than the
actual available panel, causing horizontal overflow (`scrollWidth` exceeding `viewport width`).

**Lesson:** `vw`/`vh` units answer "how wide is the BROWSER viewport," not "how wide is MY container." A
component correct in a full-viewport context silently breaks when reused inside any container narrower
than the viewport (a side rail, a modal, a nested panel) — the overflow is often invisible until measured,
because it doesn't necessarily trigger a visible scrollbar at every breakpoint.

**Apply next time:** before reusing a full-bleed/viewport-relative component inside a NEW layout context,
check whether that context spans the full viewport. If it doesn't, contain the horizontal paint at the
component's own mount boundary (e.g. `width: 100%`/`overflow-x: hidden` scoped to the actual container,
or recompute the "full-bleed" edges from the container's own bounding box) rather than trusting the
original viewport-relative math to still apply.
