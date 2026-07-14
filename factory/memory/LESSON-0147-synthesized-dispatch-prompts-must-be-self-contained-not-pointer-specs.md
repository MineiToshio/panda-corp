---
id: LESSON-0147
type: pattern
domain: agent-orchestration
tags: [prompting, subagent-dispatch, telemetry, ux, pointer-spec]
context: an engine or skill synthesizes a builder/reviewer/patch brief for a dispatched subagent at runtime (not a standing agent/skill prompt)
trigger: use this when a build engine or skill is about to hand a runtime-synthesized subagent brief that will render on a live dashboard or feed an in-run retry
source: "external-repo mining of github.com/NateBJones-Projects/ringer, 2026-07-10 (factory/decision-log.md same-date entry); ringer SKILL.md 'the spec is on camera'"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a build engine dispatches a subagent (builder/reviewer/patch-writer) with a prompt it
synthesizes at runtime, not a fixed standing prompt. A pointer-spec prompt ("build WO-x, read the work
order") is compact to write but starves two things: the subagent, which now needs an extra read+resolve
step just to know its own job, and any live observability surface (a dashboard, a retry log) that renders
the prompt directly — a pointer renders as a near-empty, uninformative line.

**Lesson:** a runtime-synthesized dispatch prompt is not the same category as a standing agent/skill
prompt (which IS allowed to be terse and reference other docs, since a human or the same session already
has the context). A dispatch prompt is consumed cold, by a fresh subagent AND potentially rendered live —
it must be a self-contained, on-camera brief: role, boundary, owned files, and HOW-TO-RUN spelled out
inline, not "go read X".

**Apply next time:** when an engine/skill builds a subagent brief at dispatch time, inline role +
boundary + owned-files + how-to-run directly in the prompt text itself, even if that duplicates
information also present in a work order or FRD. Reserve pointer references for standing, human/session-
read prompts (PROMPT-1..7-style conventions), never for ephemeral runtime-synthesized dispatch prompts.
