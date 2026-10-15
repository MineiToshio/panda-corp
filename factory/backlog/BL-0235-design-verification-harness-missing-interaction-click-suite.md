---
id: BL-0235
type: change
area: plugin-skill
title: "Design verification harness has no interaction-click suite for primary controls"
status: open
severity: p2
opened: 2026-10-15
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred): a card's primary action control ('Lo tengo') threw an error on click for an entire feedback round; the design skill's automated verification pass (axe-core violations / overflow / console errors, all measured at page LOAD) stayed clean (0/0/0) throughout, because none of those checks ever invoked the click handler — the project caught the break only by later writing its own ad-hoc interaction test"
closes:
links: [LESSON-0324, BL-0233]
---

## Problem
The design skill's automated verification pass (`plugin/skills/design/SKILL.md` step 5: axe-core
accessibility, horizontal overflow, console errors — all asserted at page LOAD, the "0/0/0" check run
before publishing a mockup/prototype round) has no standing check that exercises a screen's
interactive controls. A screen can pass every existing check — zero a11y violations, zero overflow,
zero console errors — while a primary action control (a button, a toggle, a card's main click target)
is completely broken, because none of those checks ever click/activate anything.

In practice (funko-tracker, 2026-10) this exact gap reached a full feedback round before being caught:
a card's "Lo tengo" primary action threw on click; the load-only verification pass stayed green the
entire time; the break was found only because the owner/agent happened to click it directly, after
which the project wrote its own one-off interaction test (`mobile-qa.mjs`) to cover it going forward —
machinery that lives only in that one project, not in the shared design-skill harness.

## Root cause
The verification harness's existing checks (axe/overflow/console) are all LOAD-time assertions — they
render the screen and inspect its state, but never dispatch a click/keypress/submit event. A broken
`onClick` handler, a thrown error on interaction, or a non-functional toggle produces no signal at all
under a load-only check, so this entire class of defect is structurally invisible to the current gate.

## Fix plan
1. Add a reusable Playwright-based interaction check to the design skill's shared verification
   scripts: given a screen and a set of its key interactive controls (tagged via a selector/data
   attribute convention — primary actions, toggles, nav controls), click/activate each one and assert
   no thrown error / no console error results. Start from the pattern funko-tracker already wrote
   per-project (`mobile-qa.mjs`, referenced in its `.pandacorp/comms/iteration.md` ronda 15) and
   generalize it into shared harness machinery instead of leaving every project to reinvent it.
2. Wire the new check into the design skill's verification entry point (`SKILL.md` step 5) so it runs
   alongside axe/overflow/console for every round, not just at freeze.
3. Document the check (what it asserts, how a screen/control opts in) in the design skill's
   references (`references/iteration-loop.md`).

## Tests (prove the fix — TDD, RED → GREEN)
A canary fixture pair: a mockup screen whose primary action handler throws on click (must turn the new
check RED even though axe/overflow/console all report clean), and the same screen with a working
handler (must turn it GREEN). Add both fixtures to the design skill's own test suite so the check's
wiring is proven, not just its logic in isolation.

## Done when
The shared interaction-click check exists in the verification scripts, is wired into the design
skill's per-round verification path, the RED/GREEN canary fixtures both assert correctly, the design
skill's references document it, and the plugin version is bumped.

## Out of scope
Full end-to-end user-flow testing (multi-step journeys); this item is scoped to exercising each
screen's own key controls once, not chaining interactions across screens.
