---
id: LESSON-0688
type: gotcha
domain: testing
tags: [idempotency, state-machine, journal, test-fixtures, build-engine]
context: writing a regression test against a state-transition function that is deliberately idempotent (a second call on an already-transitioned state is a no-op)
trigger: use this when a test needs to exercise behavior that should happen AFTER a second/later occurrence of an event on a state machine whose transition function is idempotent
source: "funko-tracker br-2026-11-16-01, BL-0327 (journal-precedence regression) — a test assumed calling handBack a second time on a unit already blocked would generate a second, later hand-back journal entry; because handBack is idempotent when the unit is already blocked, the second call produced no new event, so the test exercised the wrong (earlier) event ordering."
provenance: agent-inferred
created: 2026-11-18
status: candidate
promotion: none
confidence: medium
times_applied: 1
applied_in: [panda-corp]
links: [BL-0327]
---

**Situation:** a regression test needed to prove that a later hand-back event takes precedence over an
earlier one in the journal. It tried to produce the "later" event by calling the `handBack` transition
function a second time on a unit that was already `blocked`. Because that transition is intentionally
idempotent once the unit is already in the target state, the second call was a no-op — no new journal
entry was written — so the test silently exercised only the first event, not the sequence it meant to test.

**Lesson:** idempotency is a correctness property of the transition function (repeating it is safe), but
it also means "call it again" is not a reliable way to manufacture a *second, distinct* event in a test
fixture. A test that needs to assert behavior conditioned on a LATER occurrence of an event must construct
that later event explicitly (e.g. write the journal entry directly, or drive the system through a genuinely
different path that produces a new event), rather than assuming repeating the same call will do it.

**Apply next time:** before writing a test that relies on "calling X twice" to produce two distinct
events/journal entries, check whether X is idempotent for the state it will be called in; if so, build the
second event directly in the fixture instead of relying on the call to produce it.
