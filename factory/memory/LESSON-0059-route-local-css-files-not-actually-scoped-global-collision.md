---
id: LESSON-0059
type: anti-pattern
domain: web-performance
tags: [css, scoping, css-modules, global-stylesheet, class-collision]
context: a Next.js (or similar) project organizes CSS in route-local files (e.g. `src/app/[locale]/*/_components/*.css`) importing plain, non-module CSS per feature
trigger: use this when a project's route-local CSS files use plain top-level class names (not CSS Modules) and two features pick the same class name independently
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — found and fixed two real collisions (.next-card, .closing)"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0058]
---

**Situation:** route-local CSS files organized per feature (`src/app/[locale]/*/_components/*.css`) look
scoped by directory structure, but are NOT actually scoped at the CSS level — they all compile into one
global stylesheet. A top-level class name picked independently by two unrelated features collided, and
one silently overrode the other by import order. Two real collisions were found and fixed in this
project (`.next-card`: one feature's `display:grid` vs another's `display:flex`; `.closing`: three files
with different `padding-block` values).

**Lesson:** file-per-route/feature CSS organization creates an illusion of scoping that plain (non-
CSS-Modules, non-namespaced) class names do not actually provide — any two features can silently clash
on a common short class name, with the winner decided by unrelated import order rather than intent. This
class of bug is invisible in each feature's own file and only surfaces as a layout symptom in whichever
feature loses the specificity/order battle.

**Apply next time:** in a codebase using plain (non-module) route-local CSS files, either adopt CSS
Modules / scoped class names, or actively grep for a class name across the WHOLE codebase (not just the
feature's own file) before reusing a short/generic name like `.card`, `.closing`, `.header`. When
diagnosing an unexplained layout override, check for a same-named class defined in a different feature's
CSS file before assuming the bug is local to the feature you're looking at.
