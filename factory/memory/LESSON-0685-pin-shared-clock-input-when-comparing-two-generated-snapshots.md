---
id: LESSON-0685
type: anti-pattern
domain: testing
tags: [flaky-test, date-now, determinism, snapshot-comparison, build-engine]
context: a test asserts two independently computed outputs (e.g. the same routing/decision function called twice, in different "author order") are structurally equivalent
trigger: use this when writing a test that compares two full generated objects/responses for equality and each one is produced by code that reads the wall clock (Date.now(), new Date()) internally
source: "panda-corp factory harvest, 2026-11-16 — verifying BL-0326, the combined build-v2 suite initially showed 39/40 passing: test-build-v2-conserve.mjs's author-order comparison failed because its two captured full responses differed only by a 1ms Date.now() read; fixing it to share one `now` input made the suite pass with no routing-code change."
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: medium
times_applied: 1
applied_in: [panda-corp]
links: [LESSON-0114]
---

**Situation:** a test compared two full captured responses from a routing/decision function, asserting
they were equal regardless of call order. Both responses legitimately embed a wall-clock read
(`Date.now()`) taken internally by the function under test. Because the two calls happened milliseconds
apart, the two responses diverged by that timestamp alone and the equality assertion failed — not because
the logic under test was order-dependent, but because the test itself introduced nondeterminism by letting
each call pick its own clock reading.

**Lesson:** a test that asserts two generated artifacts are "the same" (for order-independence,
determinism, or snapshot-style regression checks) must not let each call read its own wall clock, random
seed, or other ambient non-deterministic input — any ambient value baked into both outputs will make an
otherwise-correct equality assertion flaky, and the flake looks exactly like a real logic bug until someone
diffs the two outputs field-by-field. This is distinct from LESSON-0114 (which forbids a *production*
workflow step from calling `Date.now()` at all, for replay-safety) — here the production code calling
`Date.now()` is fine; only the *test's comparison* needs to control for it.

**Apply next time:** when a test needs two calls to a function that reads the wall clock (or similar
ambient state) to compare as structurally equal, inject/pin the same explicit `now` (or stub the clock)
into both calls instead of letting each one pick its own, before concluding a divergence is a real defect.
