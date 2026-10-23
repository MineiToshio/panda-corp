---
id: LESSON-0181
type: pattern
domain: agent-tooling
tags: [claude-code, hooks, userpromptsubmit, standing-mode, context-compaction, session-state]
context: a skill/agent needs a STANDING behavioral mode to hold for an entire conversation (e.g. "brain only orchestrates, never edits directly") rather than a one-shot instruction
trigger: use this when designing a skill that must enforce a persistent behavioral contract across a long conversation, especially one that survives context compaction
source: "panda-corp — personal /orchestrate skill enforcement design, factory/memory/_inbox.md 2026-07-22 (agent-inferred, single project). Corroborated on a SECOND, distinct project (mission-control .pandacorp/run/lessons.md, 2026-10-22/23, agent-inferred), with two refinements to the exact mechanism: (1) a resumed Claude Code conversation can come back with a NEW session id, so the per-session flag file keyed on the OLD `$CLAUDE_CODE_SESSION_ID` silently stops applying after a resume — the mode appears to have lapsed when really the flag path just no longer matches; subagents inherit the PARENT's `$CLAUDE_CODE_SESSION_ID`, not a session id of their own. (2) an exit-phrase `UserPromptSubmit` hook that substring-matches the WHOLE prompt payload gets triggered by background-subagent hand-back reports (delivered as a user turn wrapped in `<agent-message>`/\"Subagent hand-back\" markers) and by negated/quoted mentions of the phrase — match only a SHORT prompt whose entire normalized text IS the exit command, carrying no wrapper markers, never a substring-anywhere match."
provenance: agent-inferred
created: 2026-07-24
status: active  # cross-project corroboration (panda-corp + mission-control) meets the eval-gate bar (DR-047)
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0113, LESSON-0119, CONV-13]
---

**Situation:** a personal skill needed a STANDING mode ("brain only orchestrates via subagents, never
edits files directly") to hold reliably across an entire long-running conversation. Relying on the
skill body's own instructions alone was not enough — a skill's prose is read once at invocation and
naturally drifts out of the effective context window as the conversation grows or gets compacted; the
same "instruction != enforcement" gap named by LESSON-0113/LESSON-0119/CONV-13 (a documented trigger or
rule with no installed mechanism silently stops applying) shows up here at the sub-skill,
per-conversation-turn level rather than the whole-build level those lessons cover.

**Lesson:** a standing behavioral mode needs an enforcement layer OUTSIDE the model's own context: a
`UserPromptSubmit` hook that re-injects the mode's contract on EVERY user message while a flag is set,
so the rule is re-asserted fresh each turn regardless of how much context has been compacted away. The
skill sets the flag on invocation; the hook clears it only on an explicit owner exit phrase — the mode
never silently lapses on its own. The flag itself must be scoped PER SESSION (never a single global
flag file), or the mode leaks into every other concurrently open conversation: key the flag path by the
session id, available as `$CLAUDE_CODE_SESSION_ID` in a Bash tool's environment and as `.session_id` in
the hook's own stdin JSON payload (e.g. `~/.claude/state/<mode>/<session_id>.on`). A `UserPromptSubmit`
hook should always `exit 0` regardless of payload shape, so a malformed/unexpected stdin payload never
blocks the owner's next prompt.

**Apply next time:** when a skill needs a mode to hold for an entire conversation rather than a single
turn, don't rely on the skill body's instructions alone to persist it — wire a `UserPromptSubmit` hook
that re-injects the contract every turn, gated by a session-scoped flag file (never global), and always
`exit 0` from that hook. This is the same "instruction alone drifts, wire the mechanism" lineage as
CONV-13/LESSON-0119/LESSON-0113, applied one level down at the per-turn/per-skill-mode granularity.

**Corroborated, plus two mechanism refinements (mission-control, 2026-10-22/23):** (1) **a resumed
conversation can get a NEW session id** — don't assume a flag set under one `$CLAUDE_CODE_SESSION_ID`
stays reachable after a `/resume`; either re-set the flag on resume detection or key it on something more
durable than the raw session id if resumes must be transparent. Subagents dispatched from a session
inherit the PARENT's session id, not their own — don't expect a per-subagent flag scope from this
mechanism. (2) **match the exit phrase narrowly**: a hook reading `UserPromptSubmit`'s whole payload as a
substring-match target will false-trigger on a background-subagent's hand-back report (which arrives as a
user-turn-shaped message carrying `<agent-message>`/"Subagent hand-back" wrapper markers) and on a
negated or quoted mention of the phrase inside normal conversation. Match only when the prompt's WHOLE
normalized text equals the exit command and the payload carries none of those wrapper markers.
