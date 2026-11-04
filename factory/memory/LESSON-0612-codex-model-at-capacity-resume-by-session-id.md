---
id: LESSON-0612
type: gotcha
domain: codex-runtime
tags: [codex, gpt-6.1-sol, capacity, resume, session-id]
context: running a Codex subtask (e.g. `codex exec`) on a model that returns a transient capacity error mid-run
trigger: use this when a Codex run dies mid-task with an error like "Selected model is at capacity"
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-03 (agent-inferred): codex gpt-6.1-sol can die mid-run with 'Selected model is at capacity'; resume with the session id recovers it"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0506]
---

**Situation:** a Codex run on `gpt-6.1-sol` died mid-task with a "Selected model is at capacity" error —
a transient provider-side capacity limit, not a defect in the task/prompt.

**Lesson:** this specific error is recoverable without restarting the task from scratch: resuming the SAME
session (by its session id) picks the run back up rather than needing a fresh invocation.

**Apply next time:** when a Codex subtask fails with a capacity error, resume by session id before
assuming the task itself failed or re-running it from the beginning — a fresh capacity check on resume
often succeeds where the original call was transiently rate-limited.
