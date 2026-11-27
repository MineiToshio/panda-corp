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
promotion: proposed   # 2026-11-27 (librarian review) — target: plugin/skills/design/references/surface-playbooks.md (catalog/browse-screen entry) or factory/standards/design.md. Corroborated across 2 distinct projects (pandasaga, funko-tracker) with owner-stated severity ("fatal") — a catalog screen that shows zero items above the fold in its default, unfiltered state is cheap to catch as a standing design-review checklist item before the DR-129 fidelity freeze.
confidence: high
times_applied: 3
applied_in: [pandasaga, funko-tracker, panda-corp]
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

**Auto-proposed for promotion** (2026-11-22): cited by 3 projects (pandasaga, funko-tracker, panda-corp) — measured by count-lesson-citations.sh. Target/rationale to be refined by the next `/pandacorp:memory review`; approval is `/pandacorp:learn` + the owner (DR-047 high-risk gate).

**Target/rationale (2026-11-23, librarian review):** promote as a new SHOULD rule/checklist item in `factory/standards/design.md` (the catalog/browse screen pattern, alongside the existing anti-omission checklist DR-058 §1c references) and its operative mirror for the design skill's own review rubric — "check the DEFAULT/unfiltered viewport at every target breakpoint and count visible primary-content items (not chrome) before calling a catalog/browse layout done." Three independent projects (pandasaga, funko-tracker, and this factory's own Mission Control design review) hit the identical defect shape — chrome (hero/filters/metadata) crowding out the items the screen exists to show — which is exactly the DR-047 recurrence bar. BL-0233 already tracks the harder, deterministic-automated-check version of this (counting visible item cards via an e2e probe); this promotion is the cheaper, immediately-shippable half — a reviewer/design-rubric instruction — and should link to BL-0233 as the follow-up hardening path rather than duplicate it.
