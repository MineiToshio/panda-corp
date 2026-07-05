---
id: LESSON-0063
type: pattern
domain: testing
tags: [playwright, screenshot, overflow, max-content, element-screenshot]
context: capturing a full screenshot of an element that horizontally overflows its container (e.g. a wide kanban board wider than its viewport-constrained parent)
trigger: use this when `element.screenshot()` needs to capture a horizontally-overflowing element in full, not just the visible/clipped portion
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** needed to screenshot a horizontally-overflowing element in full — e.g. a 6-column kanban
board wider than its containing viewport — without the capture being clipped to the visible/scrolled
portion.

**Lesson:** an element's `screenshot()` call captures the element's actual rendered box, which is
constrained by its own `overflow` and by any ancestor's `overflow` clipping it. Before capturing, the
element (and any overflow-clipping ancestor) must be temporarily widened/un-clipped so the full content
box exists in the render tree, not just the scrollable viewport of it.

**Apply next time:** to capture a horizontally-overflowing element in full, set its parent to
`width: max-content` and relax any ancestor `overflow` to `visible` immediately before calling
`element.screenshot()` (revert after, if the DOM state matters afterward).
