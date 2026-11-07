---
id: LESSON-0609
type: gotcha
domain: human-gates
tags: [attended-gate, human-in-the-loop, approval, evidence]
context: designing or operating an attended (human-approval-required) gate before an irreversible/production action, when the owner has given an upfront, general authorization ("don't ask me, just ship it") — or has already approved the exact same artifact through an earlier surface
trigger: use this when an attended gate requires an owner approval and (a) the owner has given a blanket upfront authorization instead of a per-delivery confirmation, or (b) the gate is about to ask for a SECOND, differently-shaped approval of content the owner already explicitly approved once
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-03 (agent-inferred): the attended gate requires an owner approval message AFTER the artifacts are delivered; an owner's upfront 'don't ask me, take it to production' cannot satisfy the gate's `approve` step without faking evidence. 2026-11-06 addendum (owner-stated): the ingest-release gate asked for a second formal approval after review:generate even though the owner had already reviewed and approved the same photos (same file hashes) in the working review HTML — the owner called it 100% unnecessary friction"
provenance: owner-stated
created: 2026-11-04
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0602]
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

**Second facet — the opposite failure (2026-11-06, owner-stated, funko-tracker):** a gate can also fail
in the OTHER direction: demanding a fresh, differently-shaped formal approval for content the owner
already explicitly reviewed and approved through an earlier surface in the SAME flow (e.g. approving
specific photos on a working review HTML, then being asked to re-approve the same photos again after a
later generation/packaging step, with no new content to review). This is not the same mistake as
accepting stale blanket consent — here the owner's approval WAS tied to the actual delivered content —
but the gate's design didn't recognize it because the second ask arrived through a different surface/
step than the first. Apply next time: when a flow has more than one point that could require owner
approval, design the gate to recognize an approval already given on the SAME artifact (same file
hashes/content) through an earlier step, rather than re-asking by default just because a later pipeline
stage happens to also have an approval checkpoint — bind the approval requirement to the CONTENT being
approved, not to each step that could theoretically ask for one.
