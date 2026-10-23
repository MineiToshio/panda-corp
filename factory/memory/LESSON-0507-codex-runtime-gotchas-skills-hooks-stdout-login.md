---
id: LESSON-0507
type: gotcha
domain: codex-runtime
tags: [codex, skills, hooks, postcompact, stdout, chatgpt-login]
context: operating the Codex CLI's own skills/hooks/output conventions, distinct from the model-selection
  gotchas already tracked for it
trigger: use this when invoking Codex personal/plugin skills, wiring a Codex hook, emitting
  UserPromptSubmit output, relying on PostCompact, or hitting a login/model rejection on this machine
source: "mission-control .pandacorp/run/lessons.md 2026-10-23 (agent-inferred): personal Codex skills
  (~/.codex/skills or ~/.agents/skills) are invoked with `$name`, while plugin skills show as slash
  commands; Codex hooks need /hooks trust (skipped silently otherwise); plain stdout starting with \"[\"
  makes UserPromptSubmit read as \"Failed\" (emit JSON additionalContext instead); PostCompact cannot
  inject context (use a SessionStart matcher=compact hook instead); gpt-5.5 was rejected with a ChatGPT
  login on this account"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0325, LESSON-0506]
---

**Situation:** five distinct, unrelated Codex CLI operating gotchas surfaced in the same session, none
about model selection (which LESSON-0325/LESSON-0506 already cover): (1) a personal skill under
`~/.codex/skills` or `~/.agents/skills` is invoked with `$name`, while a plugin-provided skill instead
shows up as a slash command — the two surfaces look and invoke differently even though both are "Codex
skills"; (2) a Codex hook is silently SKIPPED unless it has been explicitly trusted via `/hooks` — no
error, it just doesn't fire; (3) a `UserPromptSubmit` hook whose plain stdout happens to start with the
character `[` is read by Codex as a "Failed" hook, regardless of actual exit code — emit a JSON
`additionalContext` payload instead of plain text starting with a bracket; (4) `PostCompact` cannot
inject additional context at all on this Codex version — the equivalent injection point is a
`SessionStart` hook matched on `compact`; (5) `gpt-5.5` was rejected outright with a ChatGPT-login error
on this account (a login/entitlement issue, not a usage error).

**Lesson:** Codex's skill-discovery, hook-trust and hook-output conventions differ from Claude Code's in
several independent, easy-to-miss ways — assuming Claude Code's hook/skill mental model (any hook that
exists fires; stdout is just logged; PostCompact is the injection point for post-compaction context)
produces silent no-ops or misleading "Failed" states on Codex, not loud errors.

**Apply next time:** when authoring or debugging anything Codex-hook/skill-related: confirm a new hook
shows as trusted via `/hooks` before assuming it's wired; never start a `UserPromptSubmit` hook's stdout
with a bare `[` — emit structured JSON instead; use a `SessionStart` hook with `matcher: compact` (not
`PostCompact`) for post-compaction context injection; and treat a model-rejection tied to a ChatGPT login
as an account/entitlement issue to resolve, not a transient error to retry.
