---
id: LESSON-0316
type: pattern
domain: ui-layout
tags: [grid, grouping, flex-wrap, responsive, reflow]
context: laying out a grouped/categorized collection grid (items clustered into named groups of varying item-counts, e.g. by type/format/category) across breakpoints
trigger: use this when designing or reviewing a grouped grid/collection layout where groups can hold very different numbers of items, and the instinct is to let small groups sit side by side to save vertical space
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated): a grouped collection UI placed two small groups side by side (e.g. a 3-item group next to a 6-item group); at narrower widths one group wrapped below the other unpredictably, and the owner called the result \"raro\" — the fix was to make every group a full-width block stacked vertically regardless of its item count"
provenance: owner-stated
created: 2026-10-15
status: active
promotion: none
confidence: medium
times_applied: 1
applied_in: [funko-tracker]
links: [LESSON-0312, LESSON-0313]
---

**Situation:** a collection grid grouped items into named clusters (by type/format/category) of
varying sizes. Two small groups were placed side by side to use horizontal space efficiently, but at
narrower container widths one group reflowed/wrapped below the other in a way that looked
inconsistent and confusing — the grouping boundary itself became unclear.

**Lesson:** when groups in a grid can have very different item counts, letting any two groups sit
side by side introduces a reflow degree of freedom that breaks differently at every width (which
group wraps, and where, depends on exact item widths and container width) — there is no breakpoint
that makes it look intentional. A grouped layout reads as "classified" only when each group occupies
the full available width and groups stack vertically in a fixed order; this removes the
unpredictable-reflow failure mode entirely, at the cost of some vertical space for small groups.

**Apply next time:** in any categorized/grouped grid (by type, format, status, etc.), default each
group to a full-width block, stacked vertically in a stable order — never let two groups share a
row, even when both are small enough to fit. If horizontal density matters, solve it inside a group
(more columns) rather than between groups.
