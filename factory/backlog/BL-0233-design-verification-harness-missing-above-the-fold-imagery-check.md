---
id: BL-0233
type: change
area: plugin-skill
title: "Design verification harness has no above-the-fold primary-content-imagery check for catalog/browse-type screens"
status: open
severity: p2
opened: 2026-10-13
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-13 harvest (owner-stated): a catalog mockup's default (unfiltered) viewport showed a full-width franchise band and the filter rail with ZERO product images visible without scrolling at 1280x800 and 375x812; the owner called it fatal; it was caught only by manual owner review, not by the automated verification pass (0 axe violations / 0 overflow / 0 console errors) that had already run"
closes:
links: [LESSON-0306, BL-0056]
---

## Problem
The design skill's automated verification pass (axe-core violations, horizontal overflow, console
errors — the "0/0/0" check run before publishing a mockup for owner review) has no standing assertion
that a catalog/browse-type screen's DEFAULT (unfiltered) viewport actually shows its primary content
(the items being browsed) above the fold. A mockup can pass every existing automated check — zero a11y
violations, zero overflow, zero console errors — while showing literally zero of its primary content at
first load, because none of those checks look at content-type prioritization, only structural
correctness.

In practice (funko-tracker, 2026-10) this exact gap reached the owner: a catalog screen's unfiltered view
led with a hero/franchise band and the filter rail, with every catalog item pushed below the fold at both
a common desktop (1280x800) and mobile (375x812) breakpoint. The automated pass was already green; the
defect was caught only because the owner looked at it directly and called it fatal. See LESSON-0306 for
the generalized design lesson this item operationalizes as an automated check.

## Root cause
The verification harness's existing checks all verify STRUCTURAL correctness (does the DOM render
without overflow/console errors/a11y violations) — none assert anything about information hierarchy or
content prioritization. "Primary content visible above the fold" is a content-type-specific property
(it only applies to catalog/browse/collection screens, not every screen), so it was never captured by a
check written for structural correctness in general.

## Fix plan
1. Add a reusable Playwright-based check to the design skill's shared verification scripts: given a
   screen tagged as catalog/browse-type (and a selector/data-attribute identifying its primary-content
   items — e.g. item cards), assert that at least N (configurable, default small positive number) of
   those items have a bounding box intersecting the viewport at the project's target breakpoints, on the
   screen's DEFAULT/unfiltered state. Generalize this from the ad-hoc "N items without scroll" check
   funko-tracker already wrote per-project (ronda 3 of its `.pandacorp/comms/iteration.md`) into a
   shared, reusable harness check rather than something each project reinvents.
2. Wire the new check into the design skill's verification entry point so it runs alongside the existing
   axe/overflow/console checks whenever a screen is classified as catalog/browse-type (ties into the
   catalog/collection-tracker playbook work in BL-0056 — that playbook should name this as its own
   checklist item).
3. Document the check (what it asserts, how a screen opts in) in the design skill's references.

## Tests (prove the fix — TDD, RED → GREEN)
A canary fixture pair: a catalog mockup whose default viewport shows 0 primary-content items above the
fold at the target breakpoints (must turn the new check RED), and the same mockup with the hero
band/filter rail reduced so N items are visible (must turn it GREEN). Add both fixtures to the design
skill's own test suite so the check's wiring is proven, not just its logic in isolation.

## Done when
The shared above-the-fold check exists in the verification scripts, is wired into the catalog/browse
verification path, the RED/GREEN canary fixtures both assert correctly, the design skill's references
document it, BL-0056's catalog playbook names it as a checklist item, and the plugin version is bumped.

## Out of scope
Any check for screens that are NOT catalog/browse-type (this item is scoped to the content-prioritization
property specific to that screen class); redesigning the existing axe/overflow/console checks.
