---
id: LESSON-0306
type: pattern
domain: ux-patterns
tags: [catalog, above-the-fold, information-hierarchy, browse-screen]
context: designing the landing/browse screen of a catalog, inventory or collection-tracking product (the screen a user sees first, before applying any filter)
trigger: use this when designing or reviewing a catalog/browse-type screen's default (unfiltered) viewport at common breakpoints
source: "funko-tracker .pandacorp/comms/iteration.md ronda 3, 2026-10 (owner-stated): a mockup opened with a full-width franchise band and the filter rail, with zero catalog items visible without scrolling at 1280x800 or 375x812; the owner called it fatal"
provenance: owner-stated
created: 2026-10-13
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0312, BL-0056, BL-0233]
---

**Situation:** a catalog/browse screen's default (no filter applied) layout led with a full-width
hero/franchise band and the filter rail, pushing every actual catalog item below the fold at both a
common desktop (1280x800) and mobile (375x812) viewport. The owner's reaction: showing zero of the thing
the screen exists to show, on first load, is a fatal defect — not a polish nitpick.

**Lesson:** for any catalog/browse/collection screen, the PRIMARY content (the items being browsed) is
the thing that must be visible first — chrome (hero banners, scope/filter controls, metadata bands) is
secondary and must yield viewport space to it. This is easy to violate because each chrome element looks
reasonable in isolation during design; the defect only shows up when checking the composed, unfiltered,
first-load viewport at real breakpoints.

**Apply next time:** when designing or reviewing any catalog/browse-type screen, explicitly check the
DEFAULT (unfiltered) viewport at the project's target breakpoints and count visible primary-content items
(not chrome) before calling the layout done; treat zero-to-few visible items above the fold as a hard
failure, not a style preference. Where feasible, encode this as an automated check (see BL-0233) rather
than relying on a human catching it at review time.
