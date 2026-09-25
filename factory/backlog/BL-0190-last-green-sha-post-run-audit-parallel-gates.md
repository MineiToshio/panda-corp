---
id: BL-0190
type: change
area: build-engine
title: "Add a post-run audit that every last_green_sha publication covers only verified-FRD commits (parallel-gates lane, red-team X5)"
status: open
severity: p2
opened: 2026-09-25
closed:
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md, Red-team addendum (2026-09-25) §A3 finding X5; left open by BL-0186"
closes:
links: [BL-0186, BL-0066, DR-118]
---

## Problem
Under `args.parallelGates` (BL-0186) each verdict lands on main through one serialized lane. A PASS landing
publishes `last_green_sha` with the BL-0066 two-commit protocol: commit A certifies HEAD, and commit B points to
A. The lane is exclusive for a whole convergence ladder, so no PASS lands in the middle of another FRD's
patch/revert. But the scheduler also commits other code on main between landings: build waves of other FRDs
(`IN_REVIEW`, not yet gated), a safe-point drain, and in-run retry rebuilds. Commit A of a later PASS therefore
"certifies" commits from FRDs no gate has judged yet. The stale-pin guard runs `verify.sh --since <pin>`, which
proves the combination is green. It does not prove that the unverified commits were reviewed.

Red-team X5 asked for a post-run audit: every `last_green_sha` publication commit should have only
verified-FRD commits (or metadata) since the previous publication. Nothing checks that today, with the flag on
or off. C2 has the same exposure: build waves overlap the gate and land before `applyGate`.

## Fix plan
1. At close-out (or as a MECH step in `notify-end`/`close-out`), walk the publication commits of this run
   (`chore(build): publish last green snapshot`) and, for each consecutive pair, list the commits in between.
   Classify each commit by the work-order ids or FRD scope in its message and changed paths.
2. Flag any commit whose FRD was not VERIFIED at that publication. Record the result in `track.jsonl` and the
   run summary, and in the owner narrative when non-empty. Do not rewrite history.
3. Decide, with the owner, whether a violation blocks flipping the `parallelGates` default. The canary-E
   criteria in proposal 38 §A5 already list "0 last_green_sha audit violations".

## Tests (prove the fix — TDD, RED → GREEN)
Engine harness scenario(s): a PASS landing that follows an unverified sibling's build commit reports one
violation. A run with only verified commits between publications reports none. The flag-off C2 shape is
covered too.

## Done when
- [ ] The audit runs on every close path, is tested RED → GREEN, and canary E reports its count.

## Out of scope
Changing what `last_green_sha` means (DR-066/BL-0066) or blocking the lane on it before the owner decides.
