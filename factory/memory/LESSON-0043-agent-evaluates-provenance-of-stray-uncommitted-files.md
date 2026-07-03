---
id: LESSON-0043
type: pattern
domain: factory-engineering
tags: [git, provenance, shared-checkout, autonomy, owner-preference]
context: encountering stray uncommitted files in a shared main checkout that aren't obviously the current session's own work-in-progress
trigger: use this when you find stray uncommitted files in a shared main checkout that don't obviously belong to your current session
source: "personal-page-v2 .pandacorp/run/lessons.md (owner-stated)"
provenance: owner-stated
created: 2026-07-03
status: candidate
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** blocked by stray uncommitted files in the shared main checkout that aren't obviously the
current session's own WIP.

**Lesson:** the owner's stated preference is for the agent to evaluate provenance itself — diff the
content, judge whether it's complete/coherent, check whether it predates this session — and decide
whether to commit or discard it, rather than always pausing to ask ("tú mismo evalúa si hacer commit o
no").

**Apply next time:** when stray uncommitted files block progress in a shared checkout, investigate
provenance directly (diff, coherence, timing) and make a reasoned commit/discard call autonomously;
reserve escalation for cases where the evidence is genuinely ambiguous or destructive, not as a default
reflex.
