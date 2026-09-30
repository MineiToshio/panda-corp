---
id: BL-0215
type: bug
area: build-engine
title: "a run cut between the reopen/block flip and the wo-revert apply leaves a PLANNED/BLOCKED work order over its rejected code, and nothing re-runs the discard"
status: open
severity: p2
opened: 2026-09-30
closed:
source: "second red-team of the BL-0212/0213/0214 batch (2026-09-30), attack 4 (budget / crash mid-revert)"
closes:
links: [BL-0212, DR-070, DR-073, DR-107]
---

## Problem
BL-0212 made every discard of rejected code two steps on purpose (WS-D/D12, crash-safe in ONE direction): the flip
commit first (`revertAndReopen` sets the work orders `PLANNED`; `blockEarlyNeedsOwner` and the repair give-up set them
`BLOCKED`), then a separate MECH agent runs `wo-revert.mjs apply` (`plugin/runtime/engine/pandacorp-build.src.js`,
`revertAndReopen` / `discardBlockedCode` / the early block). The in-engine `maxAgents` brake cannot cut that sequence
(`capHit()` is only checked at safe points), but three things can:
- the supervisor's EXTERNAL brake (`implement/SKILL.md` §Budget ceiling) `TaskStop`s the workflow the moment the raw
  transcript count passes `maxAgents` — at any agent boundary, including between the flip and the apply;
- the owner's stop, an app restart, a crash;
- a MECH relay that never ran the command AND a replay with no stored receipt (refused, loud — this one is handled).

State left by a cut between flip and apply: the work order is `PLANNED` (or `BLOCKED`) and its rejected code is still
committed on main. On the next pass:
- a `PLANNED` reopened work order is rebuilt ON TOP of its rejected code — the exact silent no-op BL-0212 closed, now
  reachable through a crash;
- a `BLOCKED` one keeps its broken code on main and red-locks sibling FRDs' whole-project gate (DR-070 pollution)
  until the owner acts.
Nothing detects it: the pass has no "is the previous attempt of this PLANNED/BLOCKED work order still on main?" check.
A cut INSIDE `apply` is milliseconds wide (writes, then `git add` + `git commit`): it leaves the targets dirty with the
reverted content; the next baseline discards uncommitted edits to HEAD (DR-067, red-team 2026-09-30), which lands in
the same state as a cut between flip and apply.

## Root cause
The discard is idempotent (`wo-revert.mjs` returns `nothing` when the attempt is already undone — test (a)'s second
run) but it is only ever run at the moment of the rejection. Resume relies on the frontmatter (DR-050), and the
frontmatter says `PLANNED`/`BLOCKED` whether or not the discard landed.

## Fix plan
1. At the start of each pass (after the baseline, before planning the first wave), for every work order that is
   `PLANNED` with `reopen_count >= 1` or `BLOCKED`, run `wo-revert.mjs apply --only-status <its status>` once per FRD
   through the existing `woRevert()` relay (MECH, sealed receipt). `nothing` is the normal answer (the discard landed);
   `reverted` is a crash recovery: log it loud (`RevertRecovered`) and emit the event; a refusal blocks the FRD
   `needs-owner` exactly as `refuseRevert` does today.
2. Cost: one MECH unit per FRD holding such a work order, only on a pass that has one. Add it to the launcher's floor
   note (`plugin/scripts/launch-implement.sh`) and to `gateCostEstimate` only if it runs inside a gate link.
3. Standard: `factory/standards/build-orchestration.md` "The revert contract" — replace the "Known gap (BL-0215)"
   sentence with the recovery contract.

## Tests (prove the fix — TDD, RED → GREEN)
- `test-pandacorp-build.mjs`: a plan with a `PLANNED` work order (reopen_count 1) whose scripted `wo-revert-apply`
  answers `reverted` → the recovery runs BEFORE its `build:` and is logged; answering `nothing` → no log, build runs;
  answering `conflict` → no build, blocked needs-owner. RED today (no such relay exists).
- `test-wo-revert.mjs`: a fixture that commits the reopen flip and stops (no apply) → `apply --only-status PLANNED`
  discards the code; run twice → the second is `nothing`.

## Done when
- [ ] A pass never rebuilds a reopened work order, nor leaves a blocked one's code on main, because a previous run was
  cut between the flip and the discard.
- [ ] `run-engine-tests.sh`, `test-engine-artifact.mjs` green.

## Out of scope
Attributing commits written before BL-0212 (they name no work order): such a patch is kept or refuses on a conflict,
a partial discard documented in the standard, never a loss of other work.
