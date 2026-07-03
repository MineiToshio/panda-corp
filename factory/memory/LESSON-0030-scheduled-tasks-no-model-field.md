---
id: LESSON-0030
type: gotcha
domain: platform-tooling
tags: [scheduled-tasks, mcp, model-selection, claude-code]
context: creating or updating a Claude Code scheduled/routine task that should run on a specific model
trigger: use this when scheduling a recurring routine/task and the run needs a guaranteed specific model (e.g. Sonnet or Opus)
source: "panda-corp 2026-07-02 — mcp__scheduled-tasks create/update_scheduled_task tool inspected directly"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** the factory's scheduled routines (`pandacorp-review-launch` weekly, `pandacorp-memory-review`
daily) need a predictable model to run well, but there was no way to pin one per task.

**Lesson:** `mcp__scheduled-tasks` (`create_scheduled_task`/`update_scheduled_task`) exposes no `model`
field — a scheduled routine always runs on the host app's own default model, not a per-task override.
This is a platform limitation, not something the factory's own tooling can fix. If a specific model
must be guaranteed for a routine, the lever is the app's own default model setting, not the scheduling
call.

**Apply next time:** when a scheduled routine's quality depends on running on a specific model, do not
attempt to pass a model parameter to the scheduling tool (it will be silently ignored/unsupported);
instead document the dependency on the app's current default model, and re-check this gotcha
periodically in case the platform adds the field later.
