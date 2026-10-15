---
id: LESSON-0347
type: gotcha
domain: css
tags: [css, visually-hidden, checkbox, chip, overflow, fieldset]
context: "a visually-hidden (but still interactive) checkbox nested inside a chip/pill component, in a codebase with a global `input { width: 100% }` reset"
trigger: use this when building a visually-hidden, absolutely-positioned checkbox/radio inside a small chip-shaped label, on a project with a global input-width reset
source: "pandasaga .pandacorp/run/lessons.md 2026-10-14 (agent-inferred): a visually hidden checkbox inside a chip inherited a global `input { width: 100% }` rule and, absolutely positioned without a positioned ancestor, overflowed the page; fieldsets needed `min-width: 0` to shrink"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a chip/pill-shaped selectable label wrapped a visually-hidden checkbox (for accessibility
— real input, visually invisible). The project had a global `input { width: 100% }` reset. The hidden
checkbox, absolutely positioned to overlay its label but with no positioned ANCESTOR, inherited the
100% width rule and, having nothing to constrain it, stretched to the width of its nearest positioned
ancestor — which in this case was the page — visibly overflowing it. Separately, `<fieldset>` elements
needed an explicit `min-width: 0` to shrink below their content's natural width inside a flex/grid
layout, since fieldsets default to a non-shrinking intrinsic minimum.

**Lesson:** a global element-type reset (`input { width: 100% }`) applies even to visually-hidden
utility inputs that were never meant to size themselves against the viewport — "visually hidden" does
not exempt an element from the normal cascade. Combined with `position: absolute` and no positioned
ancestor, the checkbox's containing block becomes the nearest positioned ancestor (often far up the
tree, sometimes the page itself), so a 100%-width rule stretches it enormously. Separately, `<fieldset>`
is one of a handful of elements (along with flex/grid items generally) with a non-zero intrinsic min-size
that resists shrinking unless explicitly told to with `min-width: 0`.

**Apply next time:** anchor a visually-hidden interactive element inside its own label with
`position: relative` on the label and `inset: 0` on the input, so it's always constrained to the label's
own box regardless of global element-type resets; and add `min-width: 0` to any `<fieldset>` (or other
element with a non-shrinking intrinsic size) placed inside a flex/grid container that needs to shrink.
