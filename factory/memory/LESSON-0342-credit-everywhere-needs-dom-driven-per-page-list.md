---
id: LESSON-0342
type: pattern
domain: content-attribution
tags: [image-credits, attribution, dom-driven, completeness, licensing]
context: a "credit every reused image" requirement needs to cover every surface an image can appear on (figures, thumbnails, avatars, covers), not just the obvious ones
trigger: use this when implementing a blanket "credit/attribute every reused image" requirement across a UI with more than one image surface type
source: "pandasaga .pandacorp/run/lessons.md 2026-10-14 (agent-inferred): a per-component approach to 'credit everywhere' was easy to satisfy on figures and easy to miss on thumbnails, avatars and covers; a per-page credits list built from the rendered DOM (img[data-art]) covered every image with no per-component work"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0236]
---

**Situation:** a requirement to credit every reused/licensed image was implemented component-by-component
(add a credit line next to each `<figure>`). It worked for figures, but thumbnails, avatars and cover
images — different components, rendered in different places — each needed their own separate
implementation, and some were missed, since there was no single enumeration of "every image on this
page" to check against.

**Lesson:** a per-component attribution implementation is only as complete as the list of components a
human remembered to update — it has no structural guarantee of covering every image surface. Deriving
the credit list from the rendered DOM itself (querying every `img[data-art]`-tagged element on the page,
regardless of which component rendered it) gives a structural completeness guarantee: any new component
that tags its images the same way is automatically covered, with no separate per-component wiring.

**Apply next time:** for a blanket "attribute/credit every X" requirement spanning multiple component
types, tag every qualifying element with one shared data attribute and build the per-page list by
querying the live DOM for that attribute, rather than hand-wiring a credit line into each component that
might render one.
