---
id: LESSON-0369
type: gotcha
domain: design-process
tags: [responsive, qa, scrollwidth, fixed-width, mobile-audit]
context: auditing a UI's responsiveness at narrow breakpoints by checking the page/document's overall horizontal scroll width
trigger: use this when running a responsive/mobile audit and the global page width check (scrollWidth vs viewport) passes
source: "factory/memory/_inbox.md agent-inferred note — Mission Control responsive audit, 2026-10-17: the global width passed at 390px while a reader became unusable because of an internal fixed 236px column; caught only by checking readable content width and nested-tab screenshots in addition to the page's own scrollWidth"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a responsive audit checked that the overall page did not horizontally overflow its viewport
(`document.scrollWidth <= viewport width`) at a narrow breakpoint (390px) — and it passed. The page as a
whole genuinely fit. But a reading pane INSIDE the page was unusable at that width, because an internal
fixed-width column (236px, a sidebar or label column that never shrinks) ate most of the available space,
leaving the actual readable content squeezed into a sliver — a failure invisible to a page-level scrollWidth
check.

**Lesson:** "the whole page fits the viewport" and "every meaningful content region inside the page is
still usable" are different claims. A single global scrollWidth check only catches overflow at the OUTERMOST
boundary; it says nothing about internal fixed-width elements silently starving sibling content of space
while the page itself stays within bounds.

**Apply next time:** a responsive/mobile audit must check readable content width at the level of the actual
reading/interaction region, not just the document's own scrollWidth, AND capture screenshots of nested tabs/
panels specifically (not only the top-level view) — an internal fixed-width column is a common, easy-to-miss
failure mode that a page-level-only check cannot catch.
