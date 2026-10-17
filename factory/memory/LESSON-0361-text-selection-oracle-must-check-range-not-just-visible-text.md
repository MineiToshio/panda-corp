---
id: LESSON-0361
type: gotcha
domain: testing
tags: [browser-testing, text-selection, dom-range, user-select, a11y]
context: writing a browser-automation oracle to assert that specific text/elements are not user-selectable while other sibling text remains selectable
trigger: use this when a test needs to assert text selection is prohibited in one area of a UI while remaining allowed in another
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-17: user-select:none can keep an explicit noncollapsed Range with an empty toString, and pointer default behavior can recreate a collapsed caret after clearing the selection"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** verifying that `user-select: none` genuinely prevents text selection, a selection oracle that
only read `window.getSelection().toString()` (the visible selected text) was not reliable: `user-select:
none` can leave the browser's internal selection Range non-collapsed (spanning real DOM nodes) while
`toString()` reports an empty string — looking "prohibited" even when the underlying Range bookkeeping
still spans content. Separately, default pointer behavior can recreate a fresh, COLLAPSED caret-only Range
immediately after a prior selection is cleared, which also reports as empty but for an unrelated reason.

**Lesson:** an empty `toString()` is ambiguous — it can mean "selection genuinely prohibited," "selection
Range still spans content but renders no visible text," or "a fresh collapsed caret exists." A test that
only checks the visible string cannot distinguish these and can pass for the wrong reason.

**Apply next time:** when asserting text selection is prohibited, check BOTH that the selected text stays
empty AND that the resulting Range is collapsed (`range.collapsed === true`), not just the string. Prove
the positive case too — separately assert that sibling, intentionally-selectable text (e.g. schema field
values) actually IS selectable — so the oracle can't pass by coincidence on either side.
