---
id: LESSON-0326
type: pattern
domain: design-process
tags: [publish-flow, verification-gate, communication, async-workflow]
context: a workflow where finished work is held behind an automated verification gate before being published/made visible to the owner, and the owner might check the visible output before the gate finishes
trigger: use this when a round of work is complete but still waiting on a verification gate before being published, and the owner may check the existing (stale) published link in the meantime
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred, corroborated by the owner's own stated frustration): the owner checked a published mockup link while a finished round was still waiting on its verification gate, saw the PRIOR round's content, and concluded no work had happened — because nothing had explicitly told them the new round was finished-but-not-yet-published"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0236]
---

**Situation:** a round of design work was functionally complete but still queued behind its automated
verification gate before republishing. The owner, checking the existing published link in the
meantime, saw the previous round's content with no indication that a new round existed and was simply
not published yet — and reasonably concluded that nothing had been done.

**Lesson:** a gate-before-visibility workflow (publish only after verification passes) has a silent
window where "work is done but not yet visible" is indistinguishable, from the recipient's side, from
"work has not started" — unless that pending state is explicitly communicated. The cost of this gap
is not a quality defect; it is a false impression of zero progress that erodes trust in the process
itself.

**Apply next time:** the moment a round of work finishes and enters its verification gate, explicitly
tell the recipient "finished, not yet published — verifying" rather than leaving the previous published
state as the only visible signal; publish as soon as the gate passes so the stale-link window stays as
short as possible.
