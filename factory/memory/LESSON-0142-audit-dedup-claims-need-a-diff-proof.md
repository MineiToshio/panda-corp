---
id: LESSON-0142
type: anti-pattern
domain: skill-authoring
tags: [documentation, sop, dedup, audit, red-team]
context: an audit proposes collapsing "duplicated" prose in an executable SOP (skill, standard, runbook) by pointing it at a canonical doc
trigger: use this when an audit or improvement plan claims two SOP sections are "duplicated" and proposes deleting one in favor of a pointer
source: "panda-corp v9.84.0 skills-audit-batch, design item D7 — plugin/docs/decision-log.md 2026-07-10 entry (Red-team dispositions: D7 executed as ZERO deletions after diff-proof showed nothing was safely separable from operative text)"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-030]
---

**Situation:** a skills-audit batch flagged an executable SOP section as duplicating rationale already
stated in a standard, and proposed collapsing it to a pointer ("see standards/x.md") to reduce
duplication. Before executing, a red-team pass ran an actual line-by-line diff and found ZERO lines that
were safely separable from operative text — the "duplicate" prose was in fact load-bearing steps and
hard gates interleaved with the rationale, not a clean copy of it.

**Lesson:** an audit finding of "verbatim duplication" between an executable SOP and a canonical
standard is an over-claim by default. Dedup-to-pointer is correct ONLY for pure rationale/"why" text; it
silently breaks the SOP when it also removes an operative step or a hard gate the pointer target does
not itself state as an executable instruction. Confidence in a dedup claim is not evidence.

**Apply next time:** before deleting or collapsing any "duplicated" section in a skill, runbook or
standard, produce a diff-proof — quote the exact lines proposed for removal and verify each is pure
rationale, never an operative step/condition/gate. If even one line is executable, keep it inline and
point only the rationale at the standard. Treat "requires a diff-proof before deleting" as the default
posture for any dedup-driven audit finding, not just this one.
