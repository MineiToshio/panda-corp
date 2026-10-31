---
id: LESSON-0573
type: gotcha
domain: agent-tooling
tags: [session-restart, subagents, state-loss, orchestration]
context: a coding-agent orchestrator session that dispatched subagents/background workers needs to restart or relaunch mid-run
trigger: use this when a long-running orchestrator session that dispatched subagents/background workers needs to restart or resume, before assuming those workers survive the restart
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-30 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0181]
---

**Situation:** restarting the orchestrating session mid-run silently lost track of its dispatched
subagents — restarting did not reconnect to or resume them; the in-flight work was simply gone from the
new session's view.

**Lesson:** a session restart is not a safe, resumable checkpoint for in-flight subagents — a
subagent's lifetime is scoped to the parent session's own process/lifetime. This is consistent with
LESSON-0181's finding that a resumed session can come back with a NEW session id that a session-scoped
flag no longer matches: subagents are tied to the parent session instance, not to a durable identity
that survives a restart.

**Apply next time:** before restarting an orchestrating session that has dispatched subagents/background
workers, either let them finish/land first, or record enough state (what each worker was doing, where
its output would land) to re-dispatch replacements after the restart — never assume a restart will
reattach to work already in flight.
