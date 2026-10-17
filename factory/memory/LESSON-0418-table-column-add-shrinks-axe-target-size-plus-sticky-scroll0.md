---
id: LESSON-0418
type: gotcha
domain: accessibility
tags: [axe, target-size, wcag-2.5.8, table, sticky-header, scroll-position]
context: adding a column to an existing data table whose cells contain inline links, verified with axe-core
trigger: use this when axe-core's target-size rule newly fails on table-cell links after a layout change that narrows columns, or when axe results differ depending on scroll position in a page with a sticky header/bar
source: "pandasaga .pandacorp/run/lessons.md 2026-10-17 (agent-inferred): Adding a column to a table can newly fail axe target-size on inline links in the cells (narrower columns bring targets closer); give table-cell links a 44px inline-flex target. Also run axe at scroll 0: rows under a sticky bar read as target-size failures."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0047]
---

**Situation:** adding a new column to an existing table narrowed the remaining columns' widths, which
brought adjacent inline links inside table cells physically closer together — close enough that axe-core's
`target-size` (WCAG 2.5.8) rule, which had been passing on the SAME links before the column was added,
started failing. No code governing the links themselves changed; only the available column width did.
Separately, running the same axe check while the page was scrolled such that table rows sat under a sticky
header/bar produced target-size failures on rows that, scrolled to the top (scroll 0), passed cleanly — the
sticky bar's visual overlap with the row was being read as an effective target-size/overlap violation.

**Lesson:** `target-size` is a LAYOUT-sensitive check, not a property of a link element in isolation — any
change that reduces the available width around an inline interactive element (adding a sibling column,
narrowing a container) can flip a previously-passing target from compliant to non-compliant with zero
change to that element's own markup/CSS. A sticky header/bar is a second, independent way the same rule
can report a false positive: if the check runs at a scroll position where the sticky element visually
overlaps the row being tested, the overlap itself can register as a target-size/spacing violation that
disappears once scrolled to the top.

**Apply next time:** whenever a table gains or loses a column, or any layout change narrows the space
around inline-link targets, re-run the target-size a11y check — don't assume links unchanged in their own
markup are still compliant. Give table-cell links an explicit minimum target (e.g. `inline-flex` with a
44px effective hit area, via padding or a pseudo-element, not just font size) rather than relying on
column width staying generous. Always run axe checks at scroll position 0 (or disable/scroll past sticky
elements first) to avoid sticky-bar overlap producing false target-size failures.
