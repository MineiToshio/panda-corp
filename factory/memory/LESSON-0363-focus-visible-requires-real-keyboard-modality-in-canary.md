---
id: LESSON-0363
type: gotcha
domain: testing
tags: [focus-visible, keyboard-navigation, a11y, browser-canary]
context: writing a browser canary that asserts keyboard-focus-specific styling (`:focus-visible`) on an element
trigger: use this when a browser canary asserts `:focus-visible`-driven styling and the test focuses the element programmatically or via a mouse click
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-17: programmatic focus after a mouse click is not evidence of keyboard focus; :focus-visible correctly remained false in that case"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a canary asserted that `:focus-visible`-gated styling appeared after focusing an element
programmatically (or after a mouse click that also moves focus). The assertion failed — not because the
styling was broken, but because the browser's own `:focus-visible` heuristic correctly stayed `false`: it is
designed to activate only for keyboard-driven focus, not focus arrived at via mouse or script.

**Lesson:** calling `.focus()` on an element, or focusing it as a side effect of a mouse click, is not
equivalent to focusing it via the keyboard. `:focus-visible` is modality-aware by design, so a canary that
ignores this will either produce a false failure (asserting styling that correctly doesn't apply) or a false
pass (never actually exercising the keyboard-focus code path).

**Apply next time:** a canary that needs to exercise `:focus-visible` behavior must first enter keyboard
modality explicitly — e.g. press Tab to reach the target (or Tab away and back) — before asserting the
keyboard-specific style, rather than focusing the target directly or via a mouse action.
