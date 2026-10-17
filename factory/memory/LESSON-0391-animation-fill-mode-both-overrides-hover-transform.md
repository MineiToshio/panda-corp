---
id: LESSON-0391
type: gotcha
domain: css
tags: [css, animation, fill-mode, transform, hover]
context: "an entrance/reveal keyframe animation that animates `transform`, applied to an element that also has a `:hover` transform interaction state"
trigger: use this when a card/element has both an entrance animation on `transform` and a `:hover` rule that also sets `transform`, and the hover effect silently never shows
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a card had an entrance keyframe animation with `animation-fill-mode: both` that
animated `transform`, and a separate `:hover { transform: ... }` rule meant to lift the card on
hover. The hover lift never appeared, with no console error or obviously broken CSS.

**Lesson:** `animation-fill-mode: both` keeps the animation's final computed `transform` value
applied to the element indefinitely after the animation ends, at a higher specificity than a
`:hover` rule setting the same property — so the hover rule's `transform` is silently overridden by
the animation's retained end-state value, not simply ignored or combined.

**Apply next time:** when an entrance animation and an interaction state (`:hover`, `:focus`,
`:active`) would both set `transform` on the same element, animate a more specific/individual
property in the entrance keyframes (e.g. `translate` instead of `transform`) and leave the general
`transform` property free for interaction states to control.
