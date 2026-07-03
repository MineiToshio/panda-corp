---
id: LESSON-0027
type: gotcha
domain: agent-verification
tags: [audit, verification, stale-claim, mission-control, self-report]
context: citing a prior audit/proposal finding about a feature's build state without re-checking the live artifact
trigger: use this when about to assert a project/feature's state by citing a prior audit or proposal finding rather than checking the current code
source: "panda-corp 2026-07-02 — owner correction after a false 'FRD-17 is partial' claim; owner-stated: MC siempre debería decirme lo real"
provenance: owner-stated
created: 2026-07-03
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** the agent told the owner FRD-17 was "partial", repeating a stale audit finding, when the
live code actually had it fully built and verified — the audit finding was point-in-time and had since
been resolved by shipped work.

**Lesson:** an audit/proposal finding is a snapshot, not a durable fact. Repeating it later without
re-verifying against the live artifact (code, frontmatter, `status.yaml`) risks telling the owner
something false with high confidence. This is the same "read real or report empty/unknown honestly"
discipline the factory already applies to data surfaces (DR-047's fail-loud rule), extended to the
agent's own claims about project state.

**Apply next time:** before asserting a project or feature's current state to the owner, especially
when the source is a prior audit/proposal/report rather than something just read, re-check the live
artifact (grep the code, read the frontmatter, run the relevant gate) — never assert a state from
memory of a past finding alone.
