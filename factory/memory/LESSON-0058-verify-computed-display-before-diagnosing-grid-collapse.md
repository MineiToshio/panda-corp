---
id: LESSON-0058
type: gotcha
domain: web-performance
tags: [css, grid, getComputedStyle, class-collision, debugging]
context: a layout bug that superficially matches the classic "CSS grid item min-width:auto collapse" symptom (a near-zero-width column whose content is all position:absolute)
trigger: use this when a layout bug looks like the classic grid min-width:auto collapse pattern
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0057, LESSON-0069]
---

**Situation:** a layout bug looked exactly like the well-known "CSS grid item min-width:auto collapse"
pattern (a near-zero-width grid column whose content was all `position:absolute`). The standard
min-width:auto fix was tried first and had zero effect — the actual root cause was a colliding
same-named CSS class from an unrelated component that had silently flipped the container's `display`
from `grid` to `flex`, so the element was never a grid item at all.

**Lesson:** matching a bug's symptom to a well-known CSS failure pattern by sight is not the same as
confirming the precondition that pattern requires. Applying the "known fix" for a pattern without
verifying its precondition wastes an attempt and can mask the real cause for longer, especially when
name-collision bugs (see route-local CSS scoping gotchas) can silently change a fundamental property
like `display`.

**Apply next time:** before applying a "known fix" for a recognized CSS failure pattern (e.g. grid
min-width:auto collapse), verify the precondition holds via `getComputedStyle(el).display` (or the
equivalent property the pattern depends on) — don't assume the container is still the layout mode the
pattern requires.
