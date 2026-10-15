---
id: LESSON-0324
type: gotcha
domain: design-process
tags: [design-verification, interaction, qa, false-green]
context: an automated design/mockup verification pass that only loads screens (checking accessibility, overflow, console errors on load) and treats a clean result as proof the screen works
trigger: use this when a design/mockup verification harness runs only load-time checks (axe-core violations, horizontal overflow, console errors on page load) and is about to be trusted as sufficient proof that a screen's interactive controls work
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred): a primary action control on a card ('Lo tengo') threw an error on click for an entire feedback round — the load-only verification pass (0 axe violations / 0 overflow / 0 console errors) was clean throughout, because none of those checks ever triggered the click; a later interaction-click test caught it immediately"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0306]
---

**Situation:** a mockup's automated verification pass checked accessibility violations, layout
overflow and console errors, all measured at page LOAD. It stayed green for an entire round while a
card's primary action control was completely broken (threw on click) — the breakage was invisible to
every check that ran, because none of them exercised the control.

**Lesson:** load-time checks (axe, overflow, console-on-load) verify that a screen RENDERS correctly;
they say nothing about whether its interactive controls actually WORK, because they never invoke a
click/keypress/submit handler. A "0/0/0" clean result from a load-only suite is evidence the screen
loaded cleanly, not evidence the screen functions — a broken primary action can ship invisibly behind
an all-green load-only gate.

**Apply next time:** any verification pass for an interactive mockup/prototype must include an
interaction suite that actually clicks/activates the screen's key controls (primary actions, toggles,
navigation) in addition to load-time checks — treat a load-only "0/0/0" result as necessary, never
sufficient, proof that a round's screens work.
