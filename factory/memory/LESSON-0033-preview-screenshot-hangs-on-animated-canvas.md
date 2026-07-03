---
id: LESSON-0033
type: gotcha
domain: preview-tooling
tags: [preview, screenshot, canvas, animation, verification]
context: verifying a UI change in a running dev server when the page contains a continuously-animated canvas
trigger: use this when a preview/screenshot verification tool times out or hangs on a route that contains an animated canvas (a game-loop, particle effect, live chart)
source: "panda-corp Mission Control 2026-07-02 — Party tab canvas verification, .pandacorp/run/lessons.md"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** the `preview_screenshot` tool consistently timed out (30s) when pointed at a Mission
Control route where an animated canvas (the Party panel's continuous render loop) was mounted. DOM-based
verification (`preview_eval` / DOM inspection) on the same route worked fine and returned promptly.

**Lesson:** a screenshot-capture tool that waits for the page to reach a quiescent/idle state before
capturing can hang indefinitely on a route with a continuously-running animation loop (canvas `rAF` or
similar), since the page never becomes idle. This is a property of the capture mechanism, not a bug in
the app under test.

**Apply next time:** when verifying a route known to host a continuously-animated canvas, prefer
DOM-based verification (`preview_eval`, element/attribute assertions) over screenshot capture; if a
visual check is genuinely required, pause/freeze the animation for the capture window or use a tool mode
that captures a single frame instead of waiting for idle.
