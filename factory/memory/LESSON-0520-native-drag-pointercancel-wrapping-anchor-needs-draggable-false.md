---
id: LESSON-0520
type: gotcha
domain: frontend
tags: [drag, pointer-events, swipe, anchor, jsdom, touch]
context: building a swipeable/draggable photo or card component whose touch target is wrapped in (or renders as) an `<a>` link
trigger: use this when implementing pointer-based swipe/drag on an element that is or contains a native anchor `<a>`, and mouse-drag intermittently cancels or triggers unwanted navigation/drag behavior
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — a photo wrapped in an `<a>` for click-through-to-detail fired the browser's native image/link drag on pointerdown+move, which issued a `pointercancel` and broke the custom swipe-with-mouse handler; jsdom's test environment does not simulate or detect this native-drag behavior at all, so the unit/component tests stayed green while the browser broke"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a photo inside a swipeable carousel/card was wrapped in an `<a>` (so clicking it
navigates to a detail page). Dragging it with a mouse intermittently failed: the browser's own native
drag-and-drop for images/links inside anchors kicked in on pointerdown+move, firing a `pointercancel`
event that killed the custom pointer-based swipe handler mid-gesture. Touch worked fine (native drag
doesn't apply there); only mouse-drag broke. The component's tests, run under jsdom, never caught this —
jsdom has no native drag implementation to trigger the bug.

**Lesson:** any element that is, or is nested inside, a native `<a>` (or `<img>`) is draggable by the
browser by default, and that native drag competes with a custom pointer-event-based gesture handler —
the native drag wins by firing `pointercancel`, which most custom handlers treat as "gesture aborted".
This is a browser-only behavior with no jsdom equivalent, so it is invisible to component/unit tests and
only shows up in a real browser (or Playwright) with a real mouse-drag interaction.

**Apply next time:** when wrapping a draggable/swipeable element in an `<a>`, explicitly set
`draggable={false}` on the anchor (and/or the image) to suppress the browser's native drag before wiring
up a custom pointer-event handler. Do not trust jsdom-based component tests to catch this class of bug —
verify mouse-drag specifically with a real browser or Playwright pointer-event simulation.
