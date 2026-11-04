---
id: LESSON-0604
type: pattern
domain: debugging
tags: [upgrade, regression-attribution, confirmed-cause, flaky-test, dependency]
context: a test/gate goes red right after a dependency/framework upgrade, and the upgrade is the obvious suspect
trigger: use this when a gate or test suite fails after bumping a framework/dependency version and you're about to attribute the red to that upgrade
source: "mission-control docs/decision-log.md 2026-11-01 \"Re-apply Next 16.4.3 after clearing it of the live refresh flake\" + 2026-10-31 \"Retain the Next.js 16.4.3 upgrade candidate pending live-refresh diagnosis\" (agent-inferred): the Next 16.4.3 upgrade was withdrawn because its navigation gate failed; re-running the SAME suite on the pre-upgrade 16.2.9 reproduced the identical intermittency (a remounted live subscriber taking the next test frame as its baseline), proving the upgrade was never the cause — the upgrade and its js-yaml override were then safely re-applied after hardening the test helper, commit 08fee772"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0591, LESSON-0480]
---

**Situation:** a Next.js version bump (16.2.9 → 16.4.3) was withdrawn after its navigation/live-refresh
gate went red on the candidate branch. The natural read was "the upgrade broke this." Re-running the
exact same suite against the PRE-upgrade version (16.2.9) reproduced the identical intermittency: a
component that remounts captured the next test frame as its own baseline, so the refresh assertion never
saw the change it expected — a test-harness race, not a framework regression. With the helper hardened,
the suite went green on both versions and the upgrade was safely re-applied.

**Lesson:** "the suite went red right after the upgrade" and "the upgrade caused the red" are different
claims — this is the same confirmed-cause discipline (`docs/rules/debugging.md`: a cause is confirmed
only when it predicts the symptom AND explains the non-failures) applied specifically to a version bump.
An upgrade is the most visible recent change and the easiest thing to blame, but a pre-existing
intermittency (a flaky test, a race condition already latent in the old code) can surface or get blamed
on the upgrade purely by timing, without the upgrade being the actual cause.

**Apply next time:** before withdrawing/reverting an upgrade because its gate went red, run the IDENTICAL
failing suite against the PRE-upgrade version. If the same failure reproduces there, the upgrade is
cleared — fix the actual pre-existing defect (often a test-isolation or race-condition issue) and
re-apply the upgrade once the suite is green on both versions. If the failure does NOT reproduce on the
old version, the upgrade is a genuine suspect and the investigation continues from there.
