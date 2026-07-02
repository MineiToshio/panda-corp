---
id: LESSON-0013
type: pattern
domain: react
tags: [react, animation, requestAnimationFrame, performance, refs]
context: building a 60fps animation loop (sprite movement, canvas-like scenes) in React without frame drops
trigger: use this when building a 60fps or real-time animation loop (sprites, live visualization) inside a React component
source: mission-control lessons.md — Party/La Fragua animation engine (2026-06-17)
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: []
---

**Situation:** Mission Control's Party panel needed a 60fps sprite-animation loop (agents moving between
rooms). Driving it with `setState` per frame would re-render React on every tick — a well-known
performance trap the codebase avoided from the start.

**Lesson:** For a real-time animation loop in React, keep React entirely OUT of the hot path: use `refs` +
imperative DOM mutation (`style.transform`, `classList`) inside the `requestAnimationFrame` loop, never
`setState` per frame. Keep per-sprite animation state in a local array inside the effect (not component
state), and make sure cleanup cancels both the `rAF` handle and any timers.

**Apply next time:** Any future real-time/continuous animation surface (a live visualization, a game-like
panel) in a React app should default to this ref+rAF pattern rather than reaching for `setState` in the
frame loop — it is the standard, proven-out way to keep React's reconciliation off a 60fps hot path.
