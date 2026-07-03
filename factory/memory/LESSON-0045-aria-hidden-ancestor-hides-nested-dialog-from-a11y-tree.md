---
id: LESSON-0045
type: gotcha
domain: react
tags: [a11y, aria-hidden, dialog, modal, testing-library, accessibility-tree]
context: nesting a role=dialog element inside a sibling backdrop wrapper that carries aria-hidden=true
trigger: use this when building a modal/dialog and deciding whether the dialog can be nested inside its own backdrop wrapper element
source: "personal-page-v2 .pandacorp/run/lessons.md"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0019]
---

**Situation:** nesting a `role="dialog"` element INSIDE a sibling that has `aria-hidden="true"` (e.g. a
backdrop wrapping the dialog) hides the whole dialog from the accessibility tree — `getByRole`/
screen-reader queries silently find nothing even though the DOM/visuals look correct.

**Lesson:** `aria-hidden="true"` on an ancestor hides the entire subtree, INCLUDING any `role="dialog"`
descendant with its own explicit ARIA semantics — nested ARIA roles do not "escape" an ancestor's
`aria-hidden`. This is a distinct trap from LESSON-0019's modal-overlay findings (event-bubbling
double-close, always-mounted tab panels): here the failure is structural nesting, not event handling.

**Apply next time:** render the backdrop and the dialog as SIBLINGS, never nest the dialog inside an
`aria-hidden` wrapper — apply `aria-hidden` (if needed at all) only to the backdrop element itself, kept
as a sibling of the dialog, the same pattern an existing mobile-nav drawer already used correctly.
