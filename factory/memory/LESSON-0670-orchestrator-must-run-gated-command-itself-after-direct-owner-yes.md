---
id: LESSON-0670
type: pattern
domain: agent-orchestration
tags: [owner-approval, release-gate, subagent-boundary, relayed-consent]
context: a release/approval-gated command in a workflow where a subagent could be asked to run it based on the orchestrator's OWN relayed summary of "the owner approved," rather than a direct owner message
trigger: use this when designing or operating a release/approval-gated command that a subagent could in principle be asked to run on the orchestrator's relayed report of owner approval
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-11 (agent-inferred): subagents correctly refused to run an owner-gated release/approval command when instructed by the orchestrator relaying 'the owner approved,' rather than receiving the owner's own direct message — the gated command had to be run by the main/orchestrating thread itself, after the owner's own direct yes."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0647]
---

**Situation:** a workflow needed to run an owner-gated release/approval command after the owner said yes
in chat. When the orchestrator delegated the actual command execution to a subagent, summarizing "the
owner approved" as the instruction, the subagent correctly refused to treat that relayed summary as
sufficient authorization to run the gated command.

**Lesson:** "the owner approved" relayed by the orchestrating process is a CLAIM about something that
happened in a conversation the subagent was never part of — structurally the same category of unverified
second-hand state as a forgeable run-local approval flag (LESSON-0647): the subagent has no way to
distinguish a true relay from a mistaken or fabricated one, and a well-designed boundary should not ask
it to. A gated command's authorization should come from the same place that received the owner's actual
message.

**Apply next time:** when a release/approval-gated command depends on the owner's direct "yes," have the
process that actually RECEIVED that message run the gated command itself, rather than delegating
execution to a subagent on the strength of a relayed summary — and treat a subagent's refusal to run a
relayed-approval command as the gate working correctly, not as a bug to route around.
