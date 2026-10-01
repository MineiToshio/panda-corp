---
id: LESSON-0270
type: gotcha
domain: build-orchestration
tags: [test-harness, default-flip, regression, scenario-fixture]
context: flipping a build engine's own flag default (e.g. a feature flag going from off to on) when a large fixture/scenario test suite exists, and most scenarios never explicitly declare that flag
trigger: use this when about to flip an engine/config default that an existing scenario-based test suite's fixtures may implicitly rely on without declaring
source: "mission-control .pandacorp/run/lessons.md 2026-09-26 (agent-inferred) — flipping the `parallelGates` engine default from false to true broke ~300 test scenarios that never declared that key, because they were written and passing against the OLD default"
provenance: agent-inferred
created: 2026-10-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0260]
---

**Situation:** an engine flag's default was flipped (false → true) as part of adopting a measured
improvement. Roughly 300 existing test scenarios broke immediately — not because the new behavior was
wrong, but because those scenarios were written against the OLD default and never explicitly declared the
flag either way, so they silently inherited whatever the global default happened to be at the time they
were written.

**Lesson:** a test-scenario fixture that doesn't explicitly declare a flag it is implicitly sensitive to is
not actually independent of that flag's default — it has a hidden, undeclared coupling to "whatever the
default is today." Flipping the default doesn't just change behavior going forward; it retroactively
changes what hundreds of already-written, already-passing scenarios are implicitly testing against, and the
breakage looks like a mass regression rather than what it is (an intentional contract change the old
scenarios never opted into).

**Apply next time:** when flipping an engine/config default that an existing large scenario suite may
implicitly depend on, pin the harness's own default to the OLD value wherever a scenario doesn't explicitly
declare the key (so untouched scenarios keep testing the contract they were written against), and add at
least one NEW scenario that explicitly declares and exercises the new contract. Don't let "the global
default changed" silently rewrite what hundreds of unrelated tests are asserting.
