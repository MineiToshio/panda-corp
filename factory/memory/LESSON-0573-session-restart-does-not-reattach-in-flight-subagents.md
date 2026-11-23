---
id: LESSON-0573
type: gotcha
domain: agent-tooling
tags: [session-restart, subagents, state-loss, orchestration, scratchpad]
context: a coding-agent orchestrator session that dispatched subagents/background workers needs to restart or relaunch mid-run
trigger: use this when a long-running orchestrator session that dispatched subagents/background workers needs to restart or resume, before assuming those workers survive the restart
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-30 (agent-inferred); corroborated mission-control .pandacorp/run/lessons.md 2026-11-21 (agent-inferred, p46): 'background codex-run.sh workers launched from a Claude desktop session die when that session restarts; durable outputs survive only outside the session scratchpad — keep run dirs in .pandacorp/run/<topic>/ and reconcile worktrees on resume'"
provenance: agent-inferred
created: 2026-10-31
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: [mission-control]
links: [LESSON-0181]
---

**Situation:** restarting the orchestrating session mid-run silently lost track of its dispatched
subagents — restarting did not reconnect to or resume them; the in-flight work was simply gone from the
new session's view. A second, distinct project hit the same mechanism with a background shell worker
(`codex-run.sh` launched from a Claude desktop session): the worker process died with the session on
restart, and anything it had written only under the session's own scratchpad died with it too.

**Lesson:** a session restart is not a safe, resumable checkpoint for in-flight subagents OR for any
background process launched from that session (a detached shell worker included) — a worker's lifetime
is scoped to the parent session's own process/lifetime, and a restart gives you a NEW session id
(LESSON-0181) with no path back to what the old one was running. The scratchpad is part of that same
disposable lifetime: anything written only there is lost exactly like the worker itself.

**Apply next time:** before restarting an orchestrating session that has dispatched subagents/background
workers, either let them finish/land first, or record enough state to re-dispatch replacements after the
restart. Concretely: never let a background worker's only durable output live in the session scratchpad —
write run directories under the project's own `.pandacorp/run/<topic>/` (tracked by the filesystem, not the
session) instead, and on resume, reconcile against any worktrees/branches that worker may have left behind
rather than assuming it is still running or that its output survived.
