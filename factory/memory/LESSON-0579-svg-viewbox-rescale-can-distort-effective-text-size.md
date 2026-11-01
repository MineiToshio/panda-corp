---
id: LESSON-0579
type: gotcha
domain: frontend
tags: [svg, viewbox, text, scaling, diagram]
context: rescaling an SVG's `viewBox` (e.g. to fit a diagram/camera to new content) without re-checking the effective rendered size of any `<text>`/label elements inside it
trigger: use this when resizing or re-fitting an SVG's `viewBox` (zoom-to-fit, camera reset, responsive scaling) and the SVG contains text labels
source: "mission-control .pandacorp/run/lessons.md 2026-10-31 (agent-inferred) — rescaling an SVG's viewBox to fit new diagram content changed the coordinate-to-pixel ratio, shrinking text labels below the legible-size floor even though their declared font-size attribute was unchanged"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0550]
---

**Situation:** an SVG diagram's `viewBox` was rescaled to fit a different amount of content (more nodes,
a zoom-to-fit camera reset). The shapes resized as intended, but the embedded `<text>` elements' declared
`font-size` is interpreted in the SVG's own coordinate units, so changing the viewBox's width/height ratio
silently changes every text element's EFFECTIVE on-screen pixel size along with the shapes — a label that
read fine before the rescale became sub-legible after, with no error and no visual regression test that
specifically measures rendered text size catching it (a screenshot diff shows "different", not "too small").

**Lesson:** scaling an SVG's `viewBox` scales text exactly like any other shape — there is no built-in
mechanism that keeps text at a constant screen size unless you explicitly counter-scale it (e.g. a
`transform` that compensates, or `vector-effect: non-scaling-stroke`-style techniques applied to text). A
viewBox resize is therefore also a text-resize, and must be checked as one.

**Apply next time:** after resizing/re-fitting an SVG's `viewBox`, measure the EFFECTIVE rendered size of
every text element (not just the declared `font-size` attribute) against the project's legibility floor
(e.g. the 12px minimum this project already enforces elsewhere) — a Chromium-rendered check, not a static
read of the SVG source. If the viewBox range varies with content, either clamp the scale factor or
counter-scale text labels so they stay legible across the full range of content sizes this viewer will see.
