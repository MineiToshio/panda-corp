---
id: LESSON-0117
type: pattern
domain: build-engine
tags: [review, reopen, resource-allocation, gate, dr-118]
context: allocating expensive multi-lens/multi-reviewer scrutiny across a build's review gates
trigger: use this when deciding how many/which reviewer lenses to spend on a gate, and the gate can be either a first look or a re-look after a prior failure
source: "panda-corp — implement-overhaul 2026-07-07 (DR-118 concurrent FRD gates), factory/memory/_inbox.md"
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a review-gate design had to choose where to spend the expensive resource of multiple review
lenses/finders/skeptics: on every gate, or selectively.

**Lesson:** measured empirically (~80% of first gates either pass outright or need only a ≤6-minute patch),
spending diverse review lenses on EVERY first look mostly buys nothing — the cheap case already resolves
cheaply. The signal that a unit is actually hard/risky is a PRIOR failure on it: `gateAttempts >= 1` or
`reopen_count >= 1`. Splitting review effort on that condition (single fast look on first pass, diverse
lenses only once something has already failed once) concentrates the expensive scrutiny where it
statistically pays off in caught issues, not wall-clock.

**Apply next time:** when designing a review/QA allocation policy with a limited expensive-review budget,
don't spend it uniformly across all attempts — spend it conditioned on prior failure/reopen signal on that
SAME unit, and validate the split threshold against the actual pass/fail-on-first-look distribution rather
than assuming risk is evenly spread.
