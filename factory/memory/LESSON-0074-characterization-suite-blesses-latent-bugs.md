---
id: LESSON-0074
type: gotcha
domain: build-engine
tags: [characterization-testing, build-engine, adversarial-review, green-does-not-mean-correct]
context: a test suite written to CHARACTERIZE (fix/document) the current behavior of a complex system (e.g. the build engine's DR-060/086/069 mechanics), rather than to verify it against an independent spec
trigger: use this when a new test suite is added whose purpose is "pin down current behavior" rather than "prove behavior matches an independent oracle"
source: "panda-corp — Fable sprint WS2 characterization suite (11 scenarios / 70 asserts) over the build engine, review 2026-07-04"
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0002]
---

**Situation:** a characterization test suite was added over the build engine's DR-060/086/069 mechanics —
its purpose was to fix the engine's CURRENT behavior in tests so future changes don't silently drift it.
This suite going green does not mean the engine's current behavior is CORRECT — it means the suite
faithfully describes whatever the engine already does, bugs included. A latent bug present when the suite
was written gets "blessed" as the specified behavior, and a later regression test that would have caught
it now can't (the bug already looks like intended behavior to the suite).

**Lesson:** characterization tests and correctness tests answer different questions — "did this change?"
vs "is this right?" — and a green characterization suite answers only the first. This is the same
meta-pattern the factory already tracks ("green = self-consistency, not fidelity to an independent
oracle") applied one level deeper: even a large, seemingly rigorous test suite can be self-referential if
it was derived FROM the system's own current output rather than an independent spec.

**Apply next time:** before treating "the engine now has a characterization suite" as "the engine is
tested and trustworthy," run an adversarial review with a genuinely INDEPENDENT oracle (fresh context, no
self-critique from the same agent/session that wrote the suite) — a characterization suite is a
regression fence, not a correctness proof.
