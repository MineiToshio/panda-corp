---
id: LESSON-0344
type: gotcha
domain: css
tags: [css, container-queries, cqi, container-type, responsive]
context: using CSS container-query units (`cqi`, `cqw`, etc.) in an element's OWN padding/sizing properties
trigger: use this when sizing an element's padding/margin/dimensions with container-query units (`cqi`/`cqw`/`cqb`) and the values don't scale as expected
source: "pandasaga .pandacorp/run/lessons.md 2026-10-14 (agent-inferred): container units (cqi) used in an element's own padding resolved against the nearest ANCESTOR container, not the element itself"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an element's padding was sized in `cqi` (container query inline-size units), expecting it
to scale with that SAME element's own width. The values instead tracked the nearest ANCESTOR with
`container-type` set — not the element being styled — producing padding that didn't respond the way the
layout intended.

**Lesson:** container-query units always resolve against the nearest ancestor that has `container-type`
set, never against the element they're applied to — an element cannot be its own query container for
properties measured in its own `cq*` units. This mirrors viewport units (`vw`/`vh` also measure an
ancestor-like reference, the viewport) but is easy to miss with container units specifically, since the
whole point of the feature is "size relative to a container," which reads as if it could mean "this
element."

**Apply next time:** put `container-type` on the OUTER box (the one whose size should drive the scaling),
and size an INNER wrapper element with `cqi`/`cqw` units — never try to make an element both the query
container and the thing sized by `cq*` units in the same declaration.
