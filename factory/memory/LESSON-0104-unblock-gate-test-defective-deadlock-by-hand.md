---
id: LESSON-0104
type: pattern
domain: build-engine
tags: [gate-test-defective, deadlock, reopened-frd, dr-080, dependencies]
context: a build deadlocks on a REOPENED FRD where one work order derogates a contract a blessed reviewer test still asserts, and the WO that would re-bless that test `dependsOn` the derogating WO
trigger: "use this when a build stops with a blockedReasons/frd=error entry because a blessed reviewer test asserts the PRE-split contract and the WO that re-blesses it depends on the WO that intentionally breaks it"
source: "mission-control FRD-23 SSOT split, build run wf_3215e43e-5c1, 2026-07-07 — agent-inferred; BL-0051 files the engine/planning-side fix"
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0051, LESSON-0002, DR-080]
---

**Situation:** a reopened FRD split its fix into two work orders with a `dependsOn` edge: the first
(WO-A) intentionally derogates a contract a blessed reviewer test encodes (the FRD's design changed on
purpose); the second (WO-B, depending on WO-A) recomposes the feature and would re-bless that test to the
new contract. But WO-B can't build until WO-A is VERIFIED, and WO-A can't be VERIFIED while the blessed
test still asserts the OLD (now-derogated) contract — a circular deadlock the engine correctly identifies
as `gate-test-defective` (BL-0001/LESSON-0002) but cannot resolve on its own, because the repair (WO-B)
is gated behind the very WO it would fix.

**Lesson:** this is the DEADLOCKED sibling of LESSON-0002's defective-gate-test case — there the fix was
"don't rebuild, repair the test"; here the repair exists but is scheduling-locked behind the WO it needs to
unblock. The engine correctly refuses to let the implementer touch the blessed test (DR-080) and correctly
refuses to just rebuild (a rebuild can't fix a bad test), so it stops and asks for the owner.

**Apply next time (manual unblock, until BL-0051 ships the automated fix):** (1) apply the gate-test repair
BY HAND as the independent reviewer role, NOT the implementer (DR-080) — update the stale assertion to the
new, derogated-and-intentional contract; (2) mark the blocked WO `VERIFIED` once its (now-correct) gate
goes green; (3) relaunch the build scoped to the affected FRD (`frds: [<frd>]`) so the dependent WO builds
next. This breaks the cycle without touching the build engine itself. When planning a reopened FRD that
derogates a blessed contract, prefer folding the re-bless into the SAME work order as the derogation (or
placing it in a WO that does NOT depend on the derogating one) to avoid creating this deadlock in the
first place.
