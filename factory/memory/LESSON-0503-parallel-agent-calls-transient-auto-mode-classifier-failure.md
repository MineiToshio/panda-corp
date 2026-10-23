---
id: LESSON-0503
type: gotcha
domain: agent-orchestration
tags: [agent-tool, fan-out, transient-failure, retry, classifier]
context: dispatching many Agent tool calls in a single message (a parallel fan-out), where some or all of
  them fail with a transient classifier error unrelated to the task content
trigger: use this when launching several Agent calls in one message and some/all come back with an
  "auto mode classifier gave no verdict" (or similarly generic routing) error
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred): launching many Agent
  calls in one message all failed with a transient \"auto mode classifier gave no verdict\" error; one
  retry with shorter prompts (task text moved into a file the agent reads) succeeded"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a single message launching several Agent tool calls in parallel saw all of them fail with
an "auto mode classifier gave no verdict" error — a routing/classification failure, not a content or
permission problem. Retrying with shorter dispatch prompts (moving the bulk of the task description into
a file the agent reads itself, rather than inlining it in the prompt) succeeded on the next attempt.

**Lesson:** a large parallel fan-out of Agent calls can transiently overwhelm whatever auto-routes each
call to its model/classification, producing a blanket failure that looks content-related but isn't — it
reproduced across ALL calls in the batch simultaneously, which points at the fan-out itself (size/prompt
length) rather than any one task's content.

**Apply next time:** if a batch of parallel Agent dispatches all fail with a generic classifier/routing
error (not a task-specific error), retry the batch with shorter, file-referencing prompts (move long task
descriptions into a file the agent reads) before assuming the task itself is unworkable or escalating to
a different tier.
