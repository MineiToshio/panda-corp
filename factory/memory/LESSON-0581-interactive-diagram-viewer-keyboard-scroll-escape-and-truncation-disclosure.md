---
id: LESSON-0581
type: gotcha
domain: frontend
tags: [diagram, pan-zoom, keyboard, accessibility, legibility, disclosure]
context: a custom-pan/zoom diagram or graph viewer (hidden native scrollbars, its own transform-based camera) that also has a legibility floor forcing some content out of the visible/fit area
trigger: use this when building or auditing a custom pan/zoom viewer (DAG, model diagram, graph) that hides native scrolling and/or compacts its layout to keep text legible
source: "mission-control .pandacorp/run/lessons.md 2026-10-31 (agent-inferred, two related findings on the same viewer family) — (1) hiding the native scrollbar and driving pan/zoom via a CSS transform did not stop the browser's own keyboard-focus behavior: pressing Tab to move focus into the viewer still natively scrolled the (visually hidden) scroll container to bring the focused element into view, fighting the custom camera; (2) a layout pass that compacts geometry to keep text at or above the 12px floor can make some nodes/labels not fit in the available space, and the fix was to explicitly measure and SHOW how much is cut off rather than silently dropping it"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0355]
---

**Situation:** a diagram viewer implements its own pan/zoom via CSS transforms and hides the native
scrollbar so the custom camera is the only way to move around. Two independent gaps surfaced in this
pattern: (a) the browser's native "scroll the focused element into view" behavior is NOT suppressed by
hiding the scrollbar or by `overflow: hidden` on the transformed container — Tab-ing into the viewer
still triggers a native scroll underneath the custom camera, producing a desync between what the camera
shows and what is actually in the viewport; (b) a layout/legibility pass that shrinks or compacts content
to keep text above a minimum readable size can push some elements out of the fit entirely, and doing this
silently (just not rendering them) reads as a bug rather than a deliberate trade-off.

**Lesson:** a transform-driven viewer that disables the native scrollbar has NOT disabled native
scrolling itself — any browser behavior that scrolls an element into view (keyboard focus traversal,
`scrollIntoView`, find-in-page) still operates on the underlying scrollable box and will fight a custom
camera unless that box is made genuinely non-scrollable (e.g. `overflow: clip`, or intercepting focus to
re-sync the camera instead). Separately, when a legibility constraint forces some content to not fit,
"doesn't fit" is a fact worth surfacing, not swallowing — measure how much is cut off and say so.

**Apply next time:** for any custom pan/zoom viewer, test keyboard Tab traversal explicitly (not just
mouse/pointer interaction) and verify the native scroll container cannot silently diverge from the
camera's transform — prefer `overflow: clip` over `overflow: hidden` plus a hidden scrollbar, or
intercept focus events to keep the camera in sync. For any pass that compacts/shrinks content to satisfy
a legibility floor, compute and expose an explicit "N items don't fit at this size" signal instead of a
silent drop.
