---
id: LESSON-0332
type: gotcha
domain: frontend-interaction
tags: [mouseover, touch, hover-preview, scroll, rerender, pointer-events]
context: a hover-wired preview/tooltip fires from an interaction that was not an intentional hover (a touch tap, or a programmatic scroll/re-render under a stationary pointer)
trigger: use this when a hover-triggered preview/tooltip (e.g. on an SVG pin or card) is wired directly to `mouseover`, and the surface is used on touch devices or can scroll/re-render under the pointer
source: "pandasaga .pandacorp/run/lessons.md 2026-10-13/14 (agent-inferred, two distinct occurrences on the same project): (1) a mouseover preview on SVG map pins fired on mobile BEFORE the click, rendering under the finger and swallowing the tap; (2) a `scrollIntoView` call on a freshly-selected card fired `mouseover` under the still pointer and the hover preview replaced the just-selected card"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0310]
---

**Situation:** two independent bugs on the same hover-preview mechanism traced to the same root cause —
`mouseover` firing without a real, intentional hover. On mobile, the browser fires `mouseover` right
before `click`, so a preview card rendered under the finger and ate the tap. Separately, calling
`scrollIntoView()` on a freshly-selected card (desktop, pointer not moving) also fired `mouseover` on
whatever landed under the now-stationary pointer, and the resulting preview replaced the card the user
had just selected.

**Lesson:** `mouseover` is not a reliable proxy for "the user intentionally hovered this" — touch
browsers synthesize it before a tap, and the browser also fires it whenever the DOM moves under an
unmoving pointer (scroll, `scrollIntoView`, layout shift, a re-render). A hover-preview wired directly to
`mouseover` with no further guard will misfire on both touch and on any scroll/re-render it does not
control.

**Apply next time:** gate hover-preview logic on `matchMedia('(hover: hover) and (pointer: fine)')` so
touch devices never wire it at all, AND ignore `mouseover` events for a short window (about 120ms) after
any programmatic scroll or re-render the component triggers. Test with a touch-emulated context (not
mouse clicks) and with the scroll/selection interaction, not just a manual hover.
