---
id: LESSON-0151
type: anti-pattern
domain: factory-engineering
tags: [ci, testing, verification, rot, false-assurance]
context: a factory or project has authored test/verification scripts that are only ever run manually/on-demand, never on a schedule or trigger
trigger: use this when assessing whether an existing test/verification suite is actually trustworthy, or when deciding whether new verification tooling needs a run trigger of its own
source: "external-repo mining of github.com/NateBJones-Projects/ringer, 2026-07-10 (factory/decision-log.md same-date entry); confirmed live 2026-07-12: no .github/workflows in panda-corp"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0074, BL-0069]
---

**Situation:** a mining pass over an external, verification-obsessed tool (ringer) found it shipped a
CI workflow and release gate that were themselves broken (machine-specific paths, date-bombed
assertions) — the tests existed and had presumably passed once, but nothing continuously executed them,
so they rotted invisibly and the tool shipped false assurance. The factory's own engine test scripts
(`plugin/scripts/test-*.mjs`, a dozen of them) are authored and pass when run by hand, but as of
2026-07-12 the factory has no `.github/workflows` — nothing runs them automatically on push/schedule.

**Lesson:** an authored test suite that is never continuously executed is not equivalent to a suite that
is proven to pass — it degrades silently (a machine-specific path, a date-bombed assertion, a drifted
fixture) exactly because no one is forced to look at it again. This is DISTINCT from the "green ≠
oracle" meta-pattern (LESSON-0074: a test that runs and passes can still be checking the wrong thing) —
this is the prior, cheaper failure: a test that simply stops running at all, and the silence is mistaken
for health.

**Apply next time:** verification tooling — the factory's own engine tests, or a product project's
`verify.sh`/CI — needs a run TRIGGER (a scheduled job, a pre-push/pre-merge hook, a CI workflow), not
just authorship, before it can be trusted as a standing safety net. When auditing "is this suite
trustworthy", check whether it has ever run un-prompted, not just whether it exists and passes when
invoked by hand.
