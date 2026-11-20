---
id: LESSON-0705
type: pattern
domain: human-gates
tags: [owner-approval, human-gates, evidence-binding, reflection, synthesis]
context: designing or operating ANY owner-approval gate in an automated delivery/release workflow — what counts as "approved," who may act on it, and how far it reaches
trigger: use this when designing (or auditing) an owner-approval gate anywhere in a delivery/release workflow — before deciding what message/format counts as approval, what it covers, and who is allowed to execute on it
source: "reflection (librarian review, 2026-11-20) synthesizing 5 independently evidence-anchored lessons, all from funko-tracker's ingestion/release workflow: LESSON-0602 (selection approval != publish approval), LESSON-0609 (blanket upfront consent != per-delivery evidence; same-content re-ask is unneeded friction), LESSON-0659 (approval parser must accept natural phrasing/own-displayed-format, not a rigid shape), LESSON-0670 (the gated command must be run by the thread that received the owner's own direct message, never a subagent on a relayed summary), LESSON-0704 (one reply covers every item it was asked about, within the same run)"
provenance: agent-inferred
created: 2026-11-20
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0602, LESSON-0609, LESSON-0659, LESSON-0670, LESSON-0704]
---

**Situation:** five separate incidents in the same project's owner-approval gates (a content ingestion/
release pipeline) each independently discovered a different way an approval gate mis-scoped the owner's
consent — too narrowly (friction: re-asking for things already covered, rejecting a natural reply because
it didn't match a rigid parser shape) or too loosely (risk: treating a blanket upfront "just ship it" as
evidence for a specific delivery, or letting a subagent act on a relayed "the owner approved" instead of
the owner's own message).

**Lesson:** an owner-approval gate is defined by answering FOUR independent questions, and getting any one
wrong produces either unnecessary friction or a false-positive authorization — they do not auto-resolve
from "the owner said yes" alone:
1. **WHAT was it asked about, and does this action fall inside that?** (LESSON-0602: selecting a candidate
   and publishing it to production are different claims; one does not imply the other.)
2. **HOW BROAD is the reply's coverage?** (LESSON-0704: a single affirmative reply covers every item it
   was presented with or plainly responding to — re-asking for an item already covered is friction the
   gate invented, not a safety requirement.)
3. **WHAT SHAPE must the reply take to be recognized?** (LESSON-0659: a parser must accept the owner's
   natural phrasing and the exact format the system itself displayed, not a narrower one it assumes.)
4. **WHO may act on it, and is the consent actually tied to the content being gated?** (LESSON-0670: only
   the thread that received the owner's own direct message may execute the gated action, never a subagent
   acting on a relayed summary; LESSON-0609: a general upfront authorization is not evidence for a specific
   delivery, but the same delivery already explicitly approved through an earlier surface should not be
   re-asked just because a later step also happens to have a checkpoint.)

**Apply next time:** when designing or auditing any owner-approval gate, write down the answer to all four
questions explicitly (scope of the ask, breadth of a covering reply, accepted reply shapes, and who/what
binds the consent to the gated content) rather than letting the gate's behavior fall out implicitly from
whatever the first implementation happened to check. A gate that re-asks for already-covered content, or
rejects a natural owner reply, is as much a design defect as one that accepts stale/relayed consent for an
irreversible action — review both failure directions together, not just the stricter-looking one.
