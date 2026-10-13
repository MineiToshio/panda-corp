---
id: LESSON-0293
type: anti-pattern
domain: agent-orchestration
tags: [subagent-dispatch, context-scoping, file-ownership, spec-skill]
context: dispatching a fact-check/verification subagent with full inherited context during a multi-writer skill run (spec, architecture) where different agents own different files
trigger: use this when dispatching a verification/fact-check subagent (or any auxiliary agent) during a multi-writer flow where the orchestrator or other agents own specific files it must not touch
source: "panda-corp 2026-10-12, PandaSaga spec run — a fact-check agent, dispatched with the orchestrator's inherited context, edited the PRD/FRDs/status.yaml outside the two files it was actually assigned to check, colliding with the PM agent's own writes to the same documents"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0032, LESSON-0073]
---

**Situation:** a fact-check subagent was dispatched to verify two specific files during a `spec` run. Its
context included the orchestrating skill's full instructions (inherited, not re-scoped), which gave it
the ability — and apparently the implicit authority — to run more of the skill than it was assigned,
leading it to edit the PRD/FRDs/`status.yaml` directly, the same documents the PM agent (the actual
owner) was concurrently writing.

**Lesson:** a subagent dispatched for a NARROW purpose (fact-checking two files) but given the full
orchestrating context (not a trimmed, purpose-specific instruction set) can end up believing its scope is
the whole skill, not just its assigned slice — the risk isn't tool access alone (it is LESSON-0032's
"shared resource, multiple writers" problem one level up: this is about TASK scope, not a monotonic
value), it's that broad inherited context reads as broad authorization. The fix at the moment it happens
is to stop the infringing writer immediately and reconcile with the single designated owner of those
files, then verify the final file set independently (not trust either agent's own account of what it
touched).

**Apply next time:** when dispatching an auxiliary subagent (fact-check, review, research) into a
multi-writer flow, scope its CONTEXT/instructions to only its assigned files and task — do not hand it
the full orchestrating skill's instructions "for context" if that context implies broader authority than
intended. If an infringing write is caught, stop that agent immediately, reconcile with the single
designated owner of the affected files, and independently verify the final file set rather than trusting
either agent's self-report.
