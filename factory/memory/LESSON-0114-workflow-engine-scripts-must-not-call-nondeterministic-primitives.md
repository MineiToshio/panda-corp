---
id: LESSON-0114
type: gotcha
domain: build-engine
tags: [dynamic-workflows, determinism, resume-safety, date-now, math-random]
context: writing a script step that runs inside a Dynamic Workflow (Claude Code's resumable-workflow engine, e.g. pandacorp-build.js)
trigger: use this when a build-engine script step needs cadence, throttling, rotation, jitter or any time/randomness-based logic
source: "panda-corp — implement-audit 2026-07-07 (workflowization proposal 31 / implement overhaul), factory/memory/_inbox.md"
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [factory/standards/build-orchestration.md]
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
