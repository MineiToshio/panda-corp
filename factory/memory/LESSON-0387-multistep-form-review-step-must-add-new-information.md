---
id: LESSON-0387
type: pattern
domain: ui-design
tags: [forms, wizard, review-step, multi-step]
context: the final "review" step of a multi-step form/wizard, before the user commits with the primary action
trigger: use this when designing the last step of a multi-step form and the default plan is a "review" screen that re-lists every choice made in the previous steps
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated)"
provenance: owner-stated
created: 2026-10-17
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a multi-step form's final step was planned as a "review" screen that simply repeated
every choice the user had already made and already seen on the prior steps, before showing the
primary submit button.

**Lesson:** a review step that only restates choices still visible from the steps the user just
completed is dead weight — it adds a screen without adding information, and the user has nothing
new to verify. The final step earns its place only when it computes and shows something the user
could NOT already see: a short result/output summary (a count, an owned/missing breakdown, how many
images will be produced, etc.) alongside the primary action.

**Apply next time:** when designing the last step of a multi-step form, replace a plain re-listing
"review" screen with a 1-2 line computed OUTPUT summary (derived from the choices, not a restatement
of them) plus the primary action button.
