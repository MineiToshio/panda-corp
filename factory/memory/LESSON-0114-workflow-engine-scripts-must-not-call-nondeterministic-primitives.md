---
id: LESSON-0114
type: gotcha
domain: build-engine
tags: [dynamic-workflows, determinism, resume-safety, date-now, math-random]
context: writing a script step that runs inside a Dynamic Workflow (Claude Code's resumable-workflow engine, e.g. pandacorp-build.js)
trigger: use this when a build-engine script step needs cadence, throttling, rotation, jitter or any time/randomness-based logic
source: "panda-corp — implement-audit 2026-07-07 (workflowization proposal 31 / implement overhaul), factory/memory/_inbox.md. Corroborated 2026-10-29 (mission-control/panda-corp build, `.pandacorp/run/lessons.md`, agent-inferred): the Workflow engine's OWN scenario-test harness provides a `Date` stub to every scenario, so a forbidden nondeterministic-primitive call inside a workflow script PASSED all 230 scenarios in the suite and only died on the first real, live run — the scenario harness is structurally unable to catch this violation because its own fixtures accidentally supply the exact primitive the rule forbids. `plugin/scripts/test-engine-artifact.mjs` already runs a static regex check on the generated artifact for `Date.now(`/`new Date(`, but that check is narrower than the full set of nondeterministic primitives (e.g. `Math.random()`, `performance.now()`, `process.hrtime()`) the underlying rule forbids. Split per DR-103: the actionable broadening of the static check is BL-0291."
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [factory/standards/build-orchestration.md, BL-0291]
---

**Situation:** a Dynamic Workflow script step needed cadence/throttle/rotation logic (e.g. "only do X every
N seconds" or "pick a random lens/reviewer"). Calling `Date.now()`, `new Date()` or `Math.random()`
directly inside the workflow script breaks the engine's resume-safety guarantee: on a resumed run these
calls re-execute and can return a DIFFERENT value than the original run, silently diverging the replayed
state from what actually happened.

**Lesson:** Dynamic Workflow engine scripts must be treated as deterministic/replayable code — the same
constraint STEP functions have in durable-execution frameworks generally (Temporal, Restate: no wall-clock
reads, no raw RNG inside the workflow function itself). Any cadence/throttle/rotation/jitter decision must
either be event-count-based (derived from data already in the resumable state, e.g. counting entries in a
journal) computed in JS, or delegated OUT to the spawned agents' own shell (`date`, `$RANDOM`) where
non-determinism is expected and harmless because the agent's output becomes the new committed fact, not a
replay input.

**Apply next time:** before adding any time- or randomness-dependent logic to a workflow script step
(not the agents it dispatches), ask "would this line produce the same result on a resumed run?" If not,
either replace it with a count/state-based equivalent or push the call into a spawned agent's shell.

**Testing-gap facet (2026-10-29):** a scenario-test harness that stubs `Date` for its OWN convenience (so
scenario fixtures can assert on a fixed clock) can accidentally make the rule above UNTESTABLE by its own
test suite — a violation passes every scenario (the stub quietly supplies the `Date` the forbidden call
needed) and only surfaces on a real live run, where no stub exists. A scenario/unit-test harness is not a
sufficient oracle for this invariant; pair it with a STATIC check on the generated artifact's own source
(grep for the forbidden primitives) that runs independently of any test double. Keep that static check's
primitive list complete (`Date.now()`, `new Date()`, `Math.random()`, `performance.now()`,
`process.hrtime()`, ...) — a narrower regex gives false confidence the same way the stub does.
