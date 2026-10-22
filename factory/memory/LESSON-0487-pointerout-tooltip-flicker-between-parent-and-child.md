---
id: LESSON-0487
type: gotcha
domain: web-ui
tags: [tooltip, pointer-events, pointerout, testing]
context: a hover tooltip shown/hidden via `pointerover`/`pointerout` on a button that contains child elements (an icon span and a label span)
trigger: use this when implementing or testing a hover tooltip driven by pointerover/pointerout on an element that has child elements the pointer can cross between
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — Orbita"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0332]
---

**Situation:** a tooltip hidden on `pointerout` flickered (hid and immediately re-showed) whenever the
pointer moved between a button and its own child spans (an icon span and a label span), because each
boundary crossing between the button and a child fires its own `pointerout`/`pointerover` pair even
though the pointer never actually left the button.

**Lesson:** `pointerout` fires on every element-boundary crossing, including crossings between a parent
and its own children — a button is not a single hover region once it has child elements, so hiding on a
bare `pointerout` treats an internal move as "the pointer left" and causes a hide/show flicker. The same
mechanism bites tests: issuing `hover()` twice on the same coordinates fires no NEW `pointerover` event
(the pointer is already "there" as far as the engine is concerned), so a test that doesn't first move the
mouse away between assertions gets no second trigger and silently proves nothing on the second check.

**Apply next time:** hide the tooltip only when `event.relatedTarget` is outside the button itself
(`!button.contains(relatedTarget)`), not on every bare `pointerout`. When testing hover behavior, move
the mouse away from the target between assertions before hovering it again.
