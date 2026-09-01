---
id: LESSON-0027
type: gotcha
domain: agent-verification
tags: [audit, verification, stale-claim, mission-control, self-report]
context: citing a prior audit/proposal finding about a feature's build state without re-checking the live artifact
trigger: use this when about to assert a project/feature's state by citing a prior audit or proposal finding rather than checking the current code
source: "panda-corp 2026-07-02 — owner correction after a false 'FRD-17 is partial' claim; owner-stated: MC siempre debería decirme lo real. Corroborating instance: panda-corp v9.84.0 skills-audit-batch, plugin/docs/decision-log.md 2026-07-10 entry — an adversarial red-team over a 42-item improvement plan killed 8 items before execution, one for a false premise (a proposed fix targeted a defect that was already fixed / didn't exist in the live file). THIRD corroborating instance: panda-corp 2026-08-31 scheduled review-launch sweep — the portfolio's 2026-08-03 note for Mission Control asserted 'commits sobre el repo de la fábrica siguen llegando a diario' as ongoing evidence for a no-aplica verdict; re-verified live and the last factory commit was 6 days stale, but the claim had simply been carried forward unchecked across 4 weeks of sweeps because it read as background context, not a headline finding."
provenance: owner-stated
created: 2026-07-03
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0069, LESSON-0183]
---

**Situation:** the agent told the owner FRD-17 was "partial", repeating a stale audit finding, when the
live code actually had it fully built and verified — the audit finding was point-in-time and had since
been resolved by shipped work. A second, independent instance: a 42-item improvement plan derived from
an earlier audit pass was about to be executed wholesale; an adversarial red-team re-checked each
proposed item against the live file first and killed 8 of 42 before any fix was written, including one
whose claimed defect turned out to be a false premise (already fixed / never true).

**Lesson:** an audit/proposal finding — OR a proposed fix/backlog item derived from one — is a snapshot,
not a durable fact. Repeating it later, or executing a fix plan built on it, without re-verifying against
the live artifact (code, frontmatter, `status.yaml`) risks telling the owner something false, or
spending effort "fixing" a defect that no longer exists. This is the same "read real or report
empty/unknown honestly" discipline the factory already applies to data surfaces (DR-047's fail-loud
rule), extended to the agent's own claims about project state AND to any plan of action derived from a
prior finding.

**Apply next time:** before asserting a project or feature's current state to the owner, OR before
executing a fix/change proposed by an earlier audit, re-check the live artifact (grep the code, read the
frontmatter, run the relevant gate) — never assert a state, or act on a claimed defect, from memory of a
past finding alone. For a multi-item improvement plan, run an adversarial red-team pass that re-verifies
each item against the live file before execution, not just before reporting. This applies even to a
NARRATIVE/CONTEXT claim carried forward between recurring sweeps (a "still true, nothing changed" aside
supporting a verdict) — it is easy to skip re-checking exactly because it doesn't read as the headline
finding; re-verify it with the same rigor as the verdict itself, every sweep, not just on first write.
