---
id: LESSON-0609
type: gotcha
domain: human-gates
tags: [attended-gate, human-in-the-loop, approval, evidence]
context: designing or operating an attended (human-approval-required) gate before an irreversible/production action, when the owner has given an upfront, general authorization ("don't ask me, just ship it")
trigger: use this when an attended gate requires an owner approval and the owner has given a blanket upfront authorization instead of a per-delivery confirmation
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-03 (agent-inferred): the attended gate requires an owner approval message AFTER the artifacts are delivered; an owner's upfront 'don't ask me, take it to production' cannot satisfy the gate's `approve` step without faking evidence"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an attended gate's design requires the owner's approval MESSAGE to arrive after the
specific artifacts it gates were delivered (tying the approval to those artifacts as evidence). The owner
had separately said, upfront, "don't ask me, take it to production" — a general, advance authorization,
not a response to the delivered artifacts.

**Lesson:** a gate that records "owner approved" as evidence tied to a specific delivery cannot be
satisfied by an earlier, general statement without either weakening the gate's evidence requirement or
fabricating a post-hoc confirmation that never actually happened. The two things — "the owner generally
trusts this flow" and "the owner looked at THIS delivery and approved it" — are different claims, and an
evidence-based gate must not conflate them.

**Apply next time:** when an owner gives a blanket upfront authorization for a flow that has an
evidence-based attended gate downstream, do not treat that as satisfying the gate — either (a) ask the
owner to confirm once more after the first real delivery (cheap, and it establishes the precedent that
the blanket authorization is intended to also cover the gate going forward), or (b) explicitly redesign
the gate (with the owner's sign-off) to run unattended for this flow given the authorization, rather than
quietly treating stale/blanket consent as per-delivery evidence.
