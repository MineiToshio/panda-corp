---
id: LESSON-0522
type: gotcha
domain: css
tags: [css, skeleton-loading, descendant-selector, reuse, layout-shift]
context: a shared "skeleton loading" CSS class (e.g. `.sk-l`, `.sk-img`) reused in a new place outside the container it was originally designed for
trigger: use this when reusing a skeleton/placeholder loading class in a new component and the loading state renders as an empty 0-height box instead of a placeholder shape
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — `.sk-l`/`.sk-img` only had their height declared via a rule scoped to `.sk-tile .sk-l` (a descendant selector); used standalone outside `.sk-tile`, the classes had no height of their own and collapsed to 0px, so the loading state rendered as an invisible empty box instead of a placeholder"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0239]
---

**Situation:** a skeleton-loading placeholder class worked correctly everywhere it had originally been
used (inside a `.sk-tile` card), but when reused in a new layout outside that specific parent, it
rendered as a collapsed, invisible 0-height box instead of a visible placeholder shape.

**Lesson:** the class's height was never actually a property of the class itself — it was declared only
via a descendant selector scoped to one specific parent (`.sk-tile .sk-l`). Outside that parent, the
class has no intrinsic sizing at all, so the box collapses to the height of its (empty) content: 0px.
This is a subtle authoring trap because the bug is invisible everywhere the class is used inside its
original parent, and only appears the moment someone reuses it elsewhere — exactly when it's being
treated as a generic, reusable utility class.

**Apply next time:** any CSS class meant to be reused as a generic utility (skeleton/placeholder, badge,
icon-wrapper, etc.) must declare its own intrinsic sizing (height/min-height, width) directly on the
class selector itself — never rely on a parent-scoped descendant selector to supply a dimension the class
needs everywhere it's used. When a shared class renders correctly in its original spot but collapses
elsewhere, check first whether a key property was only ever defined via an ancestor-scoped rule.
