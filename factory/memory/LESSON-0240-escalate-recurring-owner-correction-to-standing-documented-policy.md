---
id: LESSON-0240
type: pattern
domain: agent-orchestration
tags: [owner-feedback, interaction-style, standing-policy, recurring-defect, style-guide]
context: the owner flags a defect and it turns out to be one instance of a repeating class within the same session (a phrasing issue across a whole document, a style fix scoped too narrowly, a repeated visual/AI-generated look)
trigger: use this when an owner correction is the SECOND (or later) instance of the same class of defect within a session or project
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-12 (owner-stated, recurring pattern noted across one session) — when the owner flags a defect and it turns out to be one instance of a repeating class, he wants the general RULE captured as a standing, documented policy (a style-guide.md section, a numbered decision-doc entry, a rewritten seed function) rather than a single point-fix. Reflected in docs/voice/style-guide.md's two new sections and docs/design/design-decisions.md's DD-19 within the same session."
provenance: owner-stated
created: 2026-09-13
status: active
promotion: none
confidence: high
times_applied: 1
applied_in: [panda-corp]
links: [LESSON-0206]
---

**Situation:** across one session, several owner corrections each turned out to be one instance of a
repeating class of defect (a phrasing issue recurring across a whole document, a style fix applied too
narrowly the first time, a repeated AI-generated visual look) rather than a true one-off.

**Lesson:** when an owner's correction is recognized as the second (or later) occurrence of the same
underlying class — not a fresh, unrelated point defect — the owner's expectation is that the response
promotes the fix to a **standing, documented policy** (a new section in a style guide, a numbered decision
entry, a rewritten generator/seed function) rather than another one-off patch to just the instance flagged
this time. A point-fix at that stage under-responds to the signal: the same class will recur again unless
the general rule is written down somewhere future work will actually consult.

**Apply next time:** when an owner correction repeats a class of defect already fixed once in the same
project, don't just fix this instance again — write the general rule into the relevant standing artifact
(style guide, design-decisions log, or the generator/config that produced the defect) so the class stops
recurring, and treat this as this owner's general default expectation for recurring corrections, not a
one-off request.
