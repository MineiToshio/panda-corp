---
id: LESSON-0212
type: gotcha
domain: agent-orchestration
tags: [agent-tool, subagent, scratchpad, report, output-channel]
context: dispatching a general-purpose subagent that is asked to write a findings/report file to the scratchpad
trigger: use this when dispatching a subagent whose deliverable is a written report file, especially a general-purpose one with its own tool-use restrictions
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-07 (blog-generator v2 spike), agent-inferred"
provenance: agent-inferred
created: 2026-09-08
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0186]
---

**Situation:** a general-purpose subagent, asked to write a `.md` report file to the scratchpad, declined
to do so because of its own tool-use restrictions and instead returned the full report only in its final
chat message — an output channel the orchestrating agent could easily miss if it only checked for the
expected file.

**Lesson:** a subagent's own policy/restrictions can silently override an explicit instruction to persist
output as a file, with the content surfacing only in the final response instead. Relying solely on "the
subagent will write file X" as the retrieval path for a delegated report is not safe — the fallback (the
final message) has to be checked regardless of whether the file was requested.

**Apply next time:** when delegating a report-writing task to a subagent, explicitly ask for the report to
be included in the final chat message IN ADDITION to (not instead of) the requested file, so the
orchestrator always has a reliable channel even if the subagent's own restrictions block the file write.
This is a candidate addition to the Agent-tool orchestration design checklist (LESSON-0186) — output-channel
reliability as a fourth item alongside substrate choice, cost budgeting, and interruption recovery.
