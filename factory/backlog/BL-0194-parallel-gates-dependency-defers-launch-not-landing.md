---
id: BL-0194
type: bug
area: build-engine
title: "parallelGates: a cross-FRD dependency deferred the dependent's gate LAUNCH until its upstream landed (FRD-05 waited 23.2 min with a free slot); it must order only the landing"
status: done
severity: p1
opened: 2026-09-26
closed: 2026-09-26
source: "canary E2 report §4.2 (docs/reviews/canary-e2-report.md), wf_405eeb21-f9e — engine log 16"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js gateConflict + landingHeldBy/nextLandingIndex (landing lane) + factory/standards/build-orchestration.md §5c — 7c741f90"
links: [BL-0186, BL-0192, DR-118]
---

## Problem
Canary E2 (engine 9.113.0, `parallelGates:true, gateSlots:2`) logged "gate for frd-05-work-orders deferred: depends on
frd-04-project-workspace (verdict not landed yet)". FRD-05 was gate-ready and pinned from 00:42; slot 2 was free from
00:57:48 and slot 1 from 01:04:23, but FRD-05 only launched at 01:21:02 — **23.2 min of waiting, 39.9 slot-minutes
idle**. It was then gated at its OLD pin (82467476) anyway, so the wait bought no fresher review, only the stale-pin
re-verify that would have run regardless. Projection (not measured): ≈ −12 min on that run.

## Root cause
`gateConflict` rule (1) refused to LAUNCH a gate while any upstream (or downstream) FRD had an unlanded verdict. Its
stated purpose was landing order (red-team R6: B passes on its pin while A's ladder reverts the WO B built on), but the
lane already serializes landings and the stale-pin guard already re-verifies a PASS whose pin main moved past.

## Fix plan
1. `gateConflict`: drop the dependency checks against unlanded FRDs; keep the DR-060 artifact-disjointness check and
   rule (2) (an upstream still building or still queued for its gate defers the dependent; the idle path waives it).
2. Landing lane: `landingHeldBy(frd)` returns an upstream whose verdict is unlanded (gate in flight or verdict pending);
   `nextLandingIndex()` picks the oldest verdict nothing holds; with nothing landable and gates in flight the loop awaits
   one; with nothing in flight the head lands anyway (logged). A mutual pair (cross-FRD WO deps both ways) never holds.
3. The dependent then lands through the unchanged stale-pin guard: main moved (the upstream landed) → it re-verifies
   `verify.sh --since <its pin>` with the reviewer's tests ported first; red → reopen.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs` section `E2 findings`: **E2-1a** (cross-FRD WO dep; both gates start before
any verdict; B's verdict arrives first and is held, logged; A lands; B re-verifies `--since pinsha0`, then lands) and
**E2-1b** (FRD-level dep; the upstream REOPENS; the dependent lands after the whole ladder and re-verifies). Both were RED
on 9.113.0 (B only started after A's apply). D1b/D1m/D1n updated to the new contract (landing order instead of launch
deferral; the mutual pair lands one writer at a time).

## Done when
- [x] E2-1a/E2-1b RED → GREEN; `test-pandacorp-build.mjs` 288/288; `run-engine-tests.sh` 27/27 suites.
- [x] build-orchestration §5c and implement SKILL.md describe the landing-order contract.
- [ ] **Not verified live:** the ≈ −12 min projection needs canary F1 (BL-0201).

## Resolution
Shipped in 7c741f90. This is the real "phase 2" of BL-0192: the E2 report showed that pinning in the top-up would not have
helped (FRD-05 was already pinned).
