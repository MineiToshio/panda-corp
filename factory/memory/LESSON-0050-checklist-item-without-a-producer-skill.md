---
id: LESSON-0050
type: anti-pattern
domain: factory-engineering
tags: [documentation, checklist, skill-authoring, aspirational-must]
context: a skill's checklist names a deliverable/requirement, but auditing whether it is actually produced
trigger: use this when writing or auditing a skill's pre-flight/pre-release checklist, or investigating why a required artifact is chronically missing across projects
source: "panda-corp factory — release/SKILL.md pre-release checklist named a root README requirement with no producer skill ever writing it; fixed same turn via DR-112/DOC-3"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-112]
---

**Situation:** `release/SKILL.md`'s pre-release checklist had, for a long time, a line requiring "README
with what it is + how to run locally" — but no skill in the pipeline (`spec`, `scaffold`, `architecture`,
`implement`) ever actually wrote that README. The checklist bullet was never false on its face, so it
went unnoticed release after release.

**Lesson:** a checklist line naming a requirement is not evidence that a producer for it exists — this is
the same failure class as an aspirational MUST in a standard (a rule stated but never enforced/wired).
A checklist is a consumer-side gate; if nothing upstream in the pipeline is responsible for producing the
artifact it checks, the gate silently degrades into a promise-without-mechanism that either rubber-stamps
past it or blocks forever on something no one was ever going to create.

**Apply next time:** when authoring or auditing any skill's checklist (pre-release, pre-flight, "done
when"), trace EACH bullet back to the specific upstream skill/step that produces the artifact it verifies.
A bullet with no traceable producer is a bug to fix (add the producer, or drop the bullet) — treat it with
the same suspicion as an aspirational MUST that nothing enforces. Worth a periodic sweep across all
`plugin/skills/*/SKILL.md` checklists, not just a one-off fix.
