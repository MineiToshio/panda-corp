---
id: LESSON-0381
type: gotcha
domain: playwright-testing
tags: [playwright, visual-regression, computed-style, animation, flaky-test]
context: recording an element's computed `transform`/size into a style oracle (a fidelity/visual-regression baseline) when the element has an infinite CSS animation
trigger: use this when building or debugging a computed-styles snapshot/oracle and a measured `transform` or size value for an infinitely-animated element (e.g. a busy spinner) differs between re-runs
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0047]
---

**Situation:** a computed-styles oracle recorded the live `transform`/size of elements for later
exact comparison. An element with an infinite CSS animation (a busy/loading spinner) was captured
mid-rotation — each re-measure sampled a different, effectively random animation frame, making any
exact-match comparison against it inherently flaky.

**Lesson:** any measurement of an infinitely-animating element's animated properties is a sample of
a moving target — there is no single "correct" frame to compare exactly against, and re-running the
measurement will not reproduce the same value. This is a property of the measurement approach, not
a bug in the comparison logic.

**Apply next time:** before measuring computed style for an exact-match oracle/baseline, either pause
all infinite animations at a deterministic frame (e.g. `currentTime = 0`) or exclude
infinitely-animated properties from the exact-match comparison entirely — never compare a live
sampled frame of an infinite animation exactly against a stored baseline.
