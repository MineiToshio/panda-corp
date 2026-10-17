---
id: LESSON-0388
type: pattern
domain: ui-design
tags: [segmented-control, toggle, layout]
context: a two-option segmented control/toggle spanning a fixed-width column
trigger: use this when laying out a two-option segmented control that must span its container's full width and the two option labels differ in length
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated)"
provenance: owner-stated
created: 2026-10-17
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a two-option segmented control spanning the width of its column sized its two
segments to each option's own label width, leaving a visible dead strip of empty space beside the
shorter option.

**Lesson:** a two-option segmented control that spans a fixed-width column reads as broken/unbalanced
when the segments are sized to their label content rather than the available space — any leftover
space collects beside whichever option has the shorter label, looking like a misalignment bug rather
than a deliberate layout.

**Apply next time:** size a two-option segmented control's segments to split the available width
50/50 (equal flex-basis), regardless of each label's own content width.
