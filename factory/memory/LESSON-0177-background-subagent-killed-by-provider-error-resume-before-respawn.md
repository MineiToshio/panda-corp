---
id: LESSON-0177
type: pattern
domain: agent-orchestration
tags: [agent-tool, background-subagent, provider-error, resume, sendmessage]
context: a background subagent dispatched via the Agent tool is killed mid-response by a transient provider API error
trigger: use this when a background subagent's run is interrupted mid-response by a provider/API error, before deciding whether to respawn it from scratch
source: "panda-corp factory/memory/_inbox.md 2026-07-18, referencing an incident on 2026-07-15 (standards-promotion mission), agent-inferred"
provenance: agent-inferred
created: 2026-07-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0175, LESSON-0176, LESSON-0186]
---

**Situation:** a background subagent running a ~7-minute inventory scan was killed mid-response by a
provider "Server error mid-response" API error.

**Lesson:** the agent is resumable, not lost — sending a message to the SAME agent-id relaunches it with
its transcript/context intact. "Please continue and return the full report" recovered the full inventory
run without respawning from scratch, and without losing the work already done before the error.

**Apply next time:** on a provider-error interruption of a background subagent, try `SendMessage` to the
same agent-id ONCE before falling back to a fresh spawn — a fresh spawn discards accumulated
context/work and doubles cost, while a resume is often free.
