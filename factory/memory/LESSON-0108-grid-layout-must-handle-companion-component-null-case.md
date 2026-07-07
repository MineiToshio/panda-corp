---
id: LESSON-0108
type: gotcha
domain: css-layout
tags: [css-grid, conditional-render, table-of-contents, layout-robustness, edge-case]
context: a 2-column grid layout assumes a companion component (e.g. a table of contents) always renders something, but that component conditionally returns null for a valid input (a post with zero headings)
trigger: use this when a fixed-column-count grid/flex layout has one column driven by a component that can legitimately render null for some inputs
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-07 — `.post-layout` is a 2-column grid `[14rem TOC][prose]`; `TableOfContents` returns null when `headings.length === 0`, leaving the grid with a single child (the article) that falls into the narrow 14rem first column, rendering the article text tiny and left-pinned; detected migrating a real post with no headings (a memoir with no section titles), landed as this project's own `blog-post-page-polish` change"
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** A page layout is built as a fixed N-column CSS grid where one column's content comes from a
companion component that conditionally renders `null` for some valid inputs (here: a table-of-contents
component that returns nothing when the source document has zero headings). The layout was designed and
tested against the always-has-content case; the zero-content case was never tried during development
because every test fixture happened to have at least one heading.

**Lesson:** a fixed-column grid built around "component A in column 1, component B in column 2" silently
breaks when component A can return null: the grid does not collapse or reflow — the single remaining child
(component B) falls into whichever column position it holds, sized to that column's track (here, a narrow
sidebar width), rather than expanding to fill the layout. This is invisible until an input triggers the
companion component's null case, which real content eventually will.

**Apply next time:** when a layout column's presence is conditional on a companion component that can
return null, design the layout to be robust to the 0-item case from the start (e.g. `grid-template-
columns` driven by a `:has()`/data-attribute toggle, or the consumer computing the column count instead of
assuming a fixed track list) — don't assume every real input will exercise the companion component's
non-empty path just because test fixtures did.
