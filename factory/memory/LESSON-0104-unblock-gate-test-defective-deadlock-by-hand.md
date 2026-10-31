---
id: LESSON-0104
type: pattern
domain: build-engine
tags: [gate-test-defective, deadlock, reopened-frd, dr-080, dependencies]
context: a build deadlocks on a REOPENED FRD where one work order derogates a contract a blessed reviewer test still asserts, and the WO that would re-bless that test `dependsOn` the derogating WO
trigger: "use this when a build stops with a blockedReasons/frd=error entry because a blessed reviewer test asserts the PRE-split contract and the WO that re-blesses it depends on the WO that intentionally breaks it"
source: "mission-control FRD-23 SSOT split, build run wf_3215e43e-5c1, 2026-07-07 — agent-inferred; BL-0051 (closed 2026-09-03) shipped the engine/planning-side fix"
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 1
applied_in: [mission-control]
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

**Apply next time — PREVENT it at planning time (BL-0051, shipped 2026-09-03):** when a work order derogates
a contract a blessed reviewer test asserts, the re-bless MUST be folded into the SAME work order or placed in one
that does NOT `dependsOn` the derogating WO (now a rule in the `architecture` and `iterate` planning skills). If a
deadlock still reaches the build, the engine no longer stops: the `deadlocked-contract` rung hands the blessed test
to the INDEPENDENT `repairGateTest` reviewer to RE-BLESS it to the derogated contract (fail-closed — an upheld test
or an unconfirmed re-bless still blocks `needs-owner`). DR-080 is routed, never relaxed.

**Historical (the manual unblock, needed only on a project whose overlay predates plugin v9.100.0 / overlay 8.80.0):** (1) apply the gate-test repair
BY HAND as the independent reviewer role, NOT the implementer (DR-080) — update the stale assertion to the
new, derogated-and-intentional contract; (2) mark the blocked WO `VERIFIED` once its (now-correct) gate
goes green; (3) relaunch the build scoped to the affected FRD (`frds: [<frd>]`) so the dependent WO builds
next. This breaks the cycle without touching the build engine itself. When planning a reopened FRD that
derogates a blessed contract, prefer folding the re-bless into the SAME work order as the derogation (or
placing it in a WO that does NOT depend on the derogating one) to avoid creating this deadlock in the
first place.

**Corroborating occurrence (2026-10-31, same project — mission-control, agent-inferred): WO-02-014
(frd-02-ideas-board).** The FRD-level oracle went red on contradictory contracts (AC-02-010.4/.8) carried
by a sibling WO (WO-02-007) that was already `VERIFIED` — the exact deadlocked-contract shape this lesson
documents, this time traced to a DR-085 drift between the two work orders' contracts rather than a
deliberately planned derogation. The sharper point this occurrence adds: the automated `deadlocked-
contract` rung (BL-0051) resolves a deadlock by re-blessing the stale test to the derogated contract — but
that remedy presumes ONE of the two contradicting contracts is simply stale and the other is the correct,
current one. When the contradiction instead comes from an unresolved DRIFT (neither side was deliberately
derogated; they just diverged), re-blessing either one by default is a guess, not a fix — this shape needs
an explicit OWNER decision on which contract wins before any re-bless, not a reopen of the already-
`VERIFIED` WO and not an automated pick. Verify which of the two shapes you're in (deliberate derogation vs.
unresolved drift) before applying the re-bless remedy.
