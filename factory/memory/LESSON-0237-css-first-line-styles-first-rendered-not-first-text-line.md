---
id: LESSON-0237
type: gotcha
domain: css
tags: [css, first-line, pseudo-element, wrapping, typography]
context: using CSS ::first-line to style the first line of a text block that combines a title and a description in one element
trigger: use this when using ::first-line to style what is expected to be a title, on an element that also contains other wrapped/wrappable text
source: "personal-page-v2 .pandacorp/run/lessons.md (agent-inferred) — CSS ::first-line styles the first RENDERED line, not the first text line: a title+description in one block loses the bold on a wrapped title and looks merged."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a title and its description were placed in one element, with `::first-line` used to bold
the title. At narrow widths, the title wrapped to two lines and lost its bold styling partway through,
making title and description look visually merged.

**Lesson:** `::first-line` styles the first **rendered** line of an element's content — determined by
where the browser actually wraps the text at the current width — not the first *logical* line of text
(e.g. "the title"). If a title can wrap onto more than one rendered line, or if a title and a description
share the same block, `::first-line` will only style part of the title (or the wrong content entirely) as
soon as wrapping occurs.

**Apply next time:** keep a title and its description as separate elements rather than relying on
`::first-line` to distinguish them within one block — `::first-line`'s boundary is layout-dependent, not
content-dependent.
