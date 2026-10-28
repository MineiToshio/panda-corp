---
id: LESSON-0539
type: gotcha
domain: agent-portability
tags: [claude-code, cloud-sessions, plugins, start_session, portability]
context: deciding whether to run factory work (`/pandacorp:*` skills) in a Claude Code cloud session instead of a local attended session
trigger: use this when considering a Claude Code cloud session (via `start_session` with a cloud target) for any task that depends on the pandacorp plugin's skills/agents/hooks
source: "mission-control .pandacorp/run/lessons.md 2026-10-23 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-28
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a Claude Code cloud session was considered for offloading work. Neither repo-enabled nor
user-scope plugins load in that environment, so every `/pandacorp:*` skill (and the plugin's hooks/agents)
is simply absent there — there is no degraded or partial mode, the namespace doesn't exist. Additionally,
`start_session` targeting `cloud` cannot set the model or its effort/reasoning level — those are fixed by
the cloud environment, not the caller.

**Lesson:** a Claude Code cloud session is not a drop-in remote copy of a local attended session for
factory work — it is a plugin-free environment. Routing a task there that assumes any `/pandacorp:*`
skill exists will simply fail to find it, not run a lesser version of it.

**Apply next time:** reserve Claude Code cloud sessions/credits for small, self-contained tasks that need
no pandacorp skill — follow the target project's `AGENTS.md`/`CLAUDE.md` by hand instead (TDD, canonical
doc + decision-log updates), the same fallback already documented for a plugin-less fork/clone. Don't
expect to pin a specific model or effort level when dispatching to a cloud target. For anything that
genuinely needs a skill, agent or hook from the plugin, keep the work in a local, plugin-enabled session.
