---
id: LESSON-0426
type: gotcha
domain: build-orchestration
tags: [status-yaml, mutex, heartbeat, race-condition, supervisor]
context: a supervisor process that needs to keep a liveness heartbeat fresh alongside the build engine's own state-management script, which already owns the same status.yaml field under its own mutex
trigger: use this when writing or reviewing a supervisor/external process that wants to assert a liveness heartbeat (or any field) into a project's status.yaml, and the engine already has its own state-writing script touching that same field
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-17 (agent-inferred) — reading pandacorp-build-state.mjs showed its `renew` command already writes `supervisor_heartbeat` into status.yaml under its own mutex (`reassertActiveProjection`) as part of ordinary lease renewal; a supervisor bash loop built to ALSO `sed` status.yaml directly for the same field would race the engine's own mutexed write"
provenance: agent-inferred
created: 2026-10-18
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0131, LESSON-0228, LESSON-0180]
---

**Situation:** a supervisor loop built to keep `status.yaml`'s liveness heartbeat fresh considered writing
`supervisor_heartbeat` directly (e.g. via `sed`) on its own renewal cadence. Reading the engine's own
state-management script first showed `pandacorp-build-state.mjs renew` already writes that exact field
under its own mutex (`reassertActiveProjection`) as a side effect of ordinary lease renewal.

**Lesson:** a second, uncoordinated writer touching a field the engine's state script already owns under
its own mutex races that mutexed write — a lost-update race on a shared YAML file with no shared lock
between the two writers, which can silently corrupt or revert the engine's own value.

**Apply next time:** before adding any direct write to a project's `status.yaml` from a supervisor or
other external process, grep the engine's own state-management script (`pandacorp-build-state.mjs` and
siblings) for whether it already owns that field under its own mutex. If it does, call the SAME entry
point (e.g. invoke its `renew` command) rather than writing the field a second, uncoordinated way.
