---
id: BL-0002
type: bug
area: build-engine
title: "Engine must write IN_PROGRESS at WO dispatch (parallel waves skip it → board under-reports)"
status: open
severity: p1
opened: 2026-06-30
closed:
source: "LESSON-0003"
closes:
links: [LESSON-0003, DR-097, DR-050]
---

## Problem
In a parallel build wave, work orders are actively built (artifact files exist on disk) while their
`implementation_status` frontmatter still says PLANNED — implementers go PLANNED → (write artifacts) →
IN_REVIEW, skipping the visible IN_PROGRESS phase. The board derives its column purely from
`implementation_status`, so five actively-building WOs show as "To Do" / "EN PROGRESO 0". Verified on
personal-page-v2 (run wf_b01c0efe-146): all of Wave-1's route subtrees existed ~3h in while every WO still
carried `implementation_status: PLANNED`. This violates DR-097 ("while building → IN_PROGRESS") and makes the
live board and every consumer of `implementation_status` under-report real in-flight work — the owner reads a
healthy fast build as stalled.

## Root cause
The IN_PROGRESS transition is owned by the AGENT, not the engine. An implementer is expected to flip PLANNED →
IN_PROGRESS itself, but in practice it writes artifacts first and only stamps IN_REVIEW on completion, so the
IN_PROGRESS window is never persisted. Nothing at dispatch time (which the engine controls) records that the
WO is now in flight, so the board has no truthful signal between PLANNED and IN_REVIEW.

## Fix plan
1. **The ENGINE owns the IN_PROGRESS transition, atomically at dispatch — not the agent.** When the engine
   dispatches a WO to an implementer (each wave slot) it writes `implementation_status: IN_PROGRESS` +
   `last_updated: <now>` BEFORE/independent of the agent starting, and only flips it onward to IN_REVIEW on the
   agent's clean self-test. Edit `plugin/templates/shared/.claude/workflows/pandacorp-build.js` (the per-wave
   dispatch loop — set IN_PROGRESS where it spawns the implementer, symmetric to where it already sets
   IN_REVIEW).
2. **Keep the agent-side flip as belt-and-suspenders** in `plugin/agents/implementer.md`, but do not depend on
   it (§1 is the reliable fix; the engine controls dispatch timing).
3. **Optional cheap drift check:** a WO with `implementation_status: PLANNED` whose `artifacts` globs already
   match files on disk is a detectable inconsistency — surface it (doc-lint / MC "stale state" hint).

## Tests (prove the fix — TDD, RED → GREEN)
- **Dispatch transition (unit, `pandacorp-build.js`):** drive the per-wave dispatch loop over a fixture WO in
  PLANNED and assert that immediately after spawn (before the implementer reports back) the WO frontmatter is
  `implementation_status: IN_PROGRESS` with a fresh `last_updated`. Fails today (only IN_REVIEW is written by
  the engine).
- **Parallel-wave board (integration/dry-run):** dispatch a wave of ≥2 WOs and assert every dispatched WO reads
  IN_PROGRESS while in flight (board would render them "EN PROGRESO", not "To Do"). This is the exact
  under-report from run wf_b01c0efe-146.
- **Drift check (doc-lint canary, if §3 shipped):** a fixture WO in PLANNED whose `artifacts` glob matches an
  on-disk file must be flagged by the drift hint.

## Done when
The engine sets IN_PROGRESS at dispatch (proven by the unit test); a parallel wave shows in-flight WOs
correctly on the board; noted as an enforcement fix of DR-097 in `factory/standards/build-orchestration.md`;
plugin MINOR + `OVERLAY_VERSION` bumped; the gate canary passes. Then set LESSON-0003 `promotion: approved`
and back-link this item.

## Out of scope
Any change to how the board *derives* its column from `implementation_status` — the fix is to make the status
truthful, not to reinterpret it. The IN_REVIEW→VERIFIED transitions are unchanged.
