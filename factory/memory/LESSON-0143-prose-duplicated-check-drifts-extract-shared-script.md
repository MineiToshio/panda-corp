---
id: LESSON-0143
type: anti-pattern
domain: factory-engineering
tags: [guards, liveness, single-source-of-truth, drift, build-engine]
context: two independent skills/scripts each restate the same "is X alive/valid/current?" guard condition in their own prose or code
trigger: use this when a second skill or script is about to author its OWN copy of a check another skill/script already performs (a liveness guard, a validity guard, any boolean gate condition)
source: "panda-corp v9.84.0 skills-audit-batch — plugin/docs/decision-log.md 2026-07-10 entry; fix landed as plugin/scripts/check-build-liveness.sh, single owner for upgrade's active-build guard and preflight-implement.sh"
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0077]
---

**Situation:** `/pandacorp:upgrade`'s active-build guard checked only `supervisor_heartbeat` while
`preflight-implement.sh`'s guard for the same "is a build currently running?" question crossed
`max(supervisor_heartbeat, last_event_at)`. The two independently-authored copies of the SAME logical
check had drifted: a live build with a dead supervisor but a fresh `last_event_at` read as "not running"
under `upgrade`'s weaker check, letting an upgrade regenerate the engine mid-build.

**Lesson:** a boolean guard condition ("is it alive/current/safe?") restated in prose or duplicated code
across two call sites WILL drift the moment one site's requirement changes and the other isn't touched
— this is the same one-shared-resolver principle LESSON-0077 documents for derived counts, applied here
to guard/liveness CHECKS specifically. The two call sites don't need to agree by discipline; they need
to be UNABLE to disagree, which discipline alone cannot guarantee.

**Apply next time:** the moment a second skill or script needs the same yes/no guard another one
already implements, extract the check into ONE shared script/function both call (a single
`check-<thing>-liveness.sh`-style helper) rather than re-deriving the condition inline a second time.
Fail-closed on unparsable input in the shared helper, same posture as other guard scripts.
