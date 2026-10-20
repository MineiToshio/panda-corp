---
id: BL-0251
type: bug
area: build-engine
title: "Fast lane: a floor FRD inside an FRD-level cycle deadlocks the whole build (every FRD deferred, stopReason null)"
status: done
severity: p0
opened: 2026-10-18
closed: 2026-10-18
source: "funko-tracker run_20261018T033601Z_80858 (workflow wf_751dec65-1f7, plugin 9.131.0, overlay 8.101.0)"
closes: "DR-132 (1)-(4); plugin 9.132.0, OVERLAY_VERSION 8.102.0"
links: [DR-124, DR-125, DR-132, BL-0252]
---

## Problem

funko-tracker (8 FRDs, 42 WOs, fast lane, lanes K=2) built WO-01-001..006 IN_REVIEW, then logged
`↩ <frd>: deferred to the next run — it waits for an upstream, which will not be VERIFIED this run` for all 8
FRDs and ended with `stopReason: null`: no gate ran, nothing VERIFIED, and a relaunch would defer the same way.

## Root cause

FRD-01 and FRD-03 are floor (classify-frd: `P1: auth/session surface`). The WO DAG is acyclic but the FRD graph
derived from it is not: WO-02-001 → WO-01-001 while WO-01-007 → WO-02-001 and WO-01-008 → WO-02-002/WO-03-001/002;
WO-03-001 → WO-01-001/WO-02-001. The C3 rule "a dependent waits for the floor FRD's VERIFIED" was applied at FRD level
(serial `fastUpstreamWait`: any upstream with work left → wait; floor → wait for VERIFIED) and at WO level in the
lanes planner (`planChains` `--wait-verified`), but in both a dependent the floor FRD needed in order to finish waited
for that floor's VERIFIED: the floor could never finish, never gate, never VERIFY. `fastIdle` then deferred everything
without a stop signal.

## Fix plan

1. `plugin/scripts/build-mech-lanes.mjs` `planChains`: waive the floor wait of a WO that is in `needsOf(F)` (the pending
   WOs F's own pending WOs need, transitively, also through another floor's wait); report `floorWaived`; `lane-next`
   passes the waivers of what it dispatched.
2. Engine (`plugin/runtime/engine/pandacorp-build.src.js`): serial readiness per WORK ORDER (`fastReady`/`fastWoWait`/
   `fastNeeds`), an FRD builds in passes and verifies once after the last; `fastTaint` holds an FRD that built on
   unverified floor code to the floor rule (USABLE only when VERIFIED, dependents wait), derived, sticky once verified;
   `fastDeadlockCheck` ends a never-resolving deferral with `stopReason: 'deadlock'`, `result.deadlock`, a log line and
   a close-out `decisions.md` record.
3. Regenerate the artifact; standard §5d, implement SKILL, registry DR-132, Manual (DesatendidaDetail).

## Tests (prove the fix — TDD, RED → GREEN)

- `test-build-engine.mjs` BL-0251-a (floor FRD in an FRD cycle builds to completion; the dependent outside the cycle
  still waits for VERIFIED; the held dependent verifies `--floor`), BL-0251-b (FRD-level dep + WO dep cycle →
  `stopReason: 'deadlock'`, cycle named, decisions.md record), BL-0251-c (lanes: floorWaived → `--floor` USABLE,
  `--wait-verified` for the held FRD). All three RED against the 9.131.0 engine (a: `built []`, all reopened).
- `test-build-mech-lanes.mjs` "lane-plan --wait-verified (BL-0251)": the cycle's dependent is waived, the non-cycle one
  waits, a two-floor cycle waives both, a held FRD's dependent waits when no cycle.

## Done when

All suites above green; artifact regenerated (`generate-engine.mjs --check` clean); plugin 9.132.0 + OVERLAY 8.102.0;
DR-132 in the registry and both decision logs.
