---
id: LESSON-0557
type: gotcha
domain: build-engine
tags: [lease, quiesce, finalize-release, preflight, build-state]
context: recovering or re-launching a build after a run has quiesced (paused/parked), before the next preflight can take a fresh lease
trigger: use this when a build has quiesced and a subsequent `/pandacorp:implement` preflight still reports the lease as held/blocked — before assuming quiesce alone released it
source: "mission-control .pandacorp/run/lessons.md 2026-10-29 (agent-inferred): after a build quiesced, the lease still blocked preflight from starting a new run until the engine's own `finalize-release` state-CLI command was run — quiesce and release/finalize are two distinct state transitions in `plugin/runtime/build-state.mjs` (`quiesce` vs `finalizeRelease`), not one step."
provenance: agent-inferred
created: 2026-10-29
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [BL-0218]
---

**Situation:** a build run quiesced (paused, in-flight results landed, work orders parked) as designed.
A later attempt to start a fresh `/pandacorp:implement` preflight on the same project still found the lease
held/blocking, even though the run had already quiesced. The engine's state module (`build-state.mjs`)
exposes `quiesce` and `finalizeRelease` as two SEPARATE operations — quiescing a run does not, by itself,
perform the release step that frees the lease for a new preflight to acquire.

**Lesson:** "the build quiesced" and "the lease is free for the next run" are different facts in this
engine's own state model — don't assume the first implies the second when debugging a preflight that still
reports a held lease after a quiesce.

**Apply next time:** when a preflight is blocked by a lease after a prior run quiesced, check whether
`finalize-release` (the state-CLI command, `plugin/scripts/pandacorp-build-state.mjs finalize-release`) has
actually run for that lease/epoch before assuming something else is wrong; run it explicitly as the missing
step rather than treating the blocked preflight as a fresh bug to diagnose from scratch.
