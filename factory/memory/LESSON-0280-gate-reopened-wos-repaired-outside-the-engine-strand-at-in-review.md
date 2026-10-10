---
id: LESSON-0280
type: gotcha
domain: build-orchestration
tags: [frd-gate, reopen, work-order-state, in-review, manual-repair, stranded-state]
context: an FRD gate that reopens work orders, where the repairs are then made outside the build engine (manual fix commits) so no gate run ever records the re-verdict
trigger: use this when a gate reopened WOs and you (or the owner) repair them by hand instead of through the engine, or when you find work orders sitting at IN_REVIEW with no gate run pending
source: "personal-page-v2 docs/decision-log.md 2026-10-06 'FRD-08 gate closed green': the FRD-08 gate stopped on 2026-09-11 after reopening WO-08-005 and WO-08-006; both were repaired that same day by manual commits but never re-gated, so WO-08-002 through WO-08-008 stayed IN_REVIEW for about 25 days. Re-running the gate on 2026-10-06 was RED on the first attempt (four real code defects, each proven by a reviewer-authored failing test, fixed in 04fc8a4) and GREEN on the second, moving all seven to VERIFIED (b96f688). Corroborated by .pandacorp/run/lessons.md 2026-10-06 (agent-inferred)."
provenance: agent-inferred
created: 2026-10-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0002, LESSON-0117, LESSON-0069]
---

**Situation:** a gate reopened two WOs; the repairs landed as ordinary commits outside the engine. The
verdict that moves a WO from `IN_REVIEW` to `VERIFIED` is only written by a gate run, so no run ever
happened and seven WOs stayed `IN_REVIEW` for weeks, looking finished. When the gate was finally re-run it
found four real defects the manual repairs had not covered.

**Lesson:** "repaired" and "verified" are different states, and only a gate run produces the second. A manual
repair of a reopened WO leaves the state machine one transition short, silently, and the longer it waits the
more the gap hides real defects (here, four). The stranded state is also invisible: nothing fails, the board
just shows work in the wrong column.

**Apply next time:** after any manual repair of a reopened WO, re-run the FRD gate in the SAME session
and let it set the state; never hand-set `VERIFIED`. When joining a project, treat WOs at `IN_REVIEW` with no
pending run as a defect to check (is there a reopened-and-repaired WO behind it?), and expect the first
re-run to be red rather than a formality.
