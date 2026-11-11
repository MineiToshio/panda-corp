---
id: BL-0309
type: bug
area: templates
title: "Confirm whether worktree-bootstrap.sh's skip-worktree bits block green-stamp.sh's certified-tree fast path for lane gates"
status: open
severity: p2
opened: 2026-11-11
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-10 (agent-inferred, UNVERIFIED in this harvest session): 'worktree-bootstrap.sh sets skip-worktree on launch.json/e2e/server-env.json so green-stamp never certifies a worktree tree -> merge-queue always re-runs the full gate.'"
closes:
links: []
---

## Problem
A raw note claims that because `plugin/templates/shared/.pandacorp/worktree-bootstrap.sh` sets
`git update-index --skip-worktree` on `.claude/launch.json` and `e2e/server-env.json` for local dev
convenience, `.pandacorp/green-stamp.sh`'s "certified tree" check (which explicitly requires "no
skip-worktree/assume-unchanged entries," per `plugin/templates/shared/.pandacorp/green-stamp.sh` line 14)
can never certify a tree produced inside a lane worktree — meaning the DR-146 fast path ("skip the full
gate when this exact tree was already certified green") may be structurally unavailable to every
worktree-based build lane, forcing `merge-queue.sh` to always run the full integration gate on landing.

**This is NOT yet confirmed.** A partial read of `plugin/templates/shared/.pandacorp/merge-queue.sh`
(lines ~101-113) during this harvest shows the queue's OWN landing step already strips skip-worktree from
exactly those two files (`--no-skip-worktree` + checkout) before the post-rebase gate runs, which may
already prevent this exact failure mode AT LANDING TIME — the open question is specifically whether a
WORKER'S OWN in-lane gate run (e.g. a Stop-hook-triggered `verify.sh` inside the worktree, before landing)
can ever produce a valid green-stamp while `worktree-bootstrap.sh`'s skip-worktree bits are still set for
local dev use, and if so, whether that is an intended limitation (the fast path is for main-checkout runs
only) or a real, unintended gap that defeats DR-146's benefit for the common worktree-isolated build flow.

## Root cause
Unconfirmed — needs reproduction. Candidate mechanism: `worktree-bootstrap.sh` sets skip-worktree
unconditionally for local-dev PORT overrides; `green-stamp.sh`'s certification check treats ANY
skip-worktree/assume-unchanged entry as disqualifying, with no distinction between "a bootstrap-owned,
locally-expected override" and "a real uncertified divergence."

## Fix plan
1. Reproduce: in a project using worktree isolation + DR-146 (funko-tracker or similar), run a full
   `verify.sh` inside a freshly-bootstrapped lane worktree, let it go green, then run
   `.pandacorp/green-stamp.sh check` in that same worktree and record whether it certifies or refuses
   (and why) while the bootstrap-owned skip-worktree bits are present.
2. If confirmed as a real gap (the fast path never applies to any worktree lane, not by design): either
   (a) have `green-stamp.sh` explicitly exempt the two bootstrap-owned paths it recognizes as
   bootstrap-managed overrides (same path list `worktree-bootstrap.sh` sets), rather than treating any
   skip-worktree entry as disqualifying, or (b) document explicitly that the DR-146 fast path is a
   main-checkout-only optimization and lane worktrees are expected to always pay the full gate at their
   OWN pre-land Stop-hook check (distinct from the already-handled merge-queue landing path).
3. If NOT confirmed as a gap (i.e., the existing per-path skip-worktree clearing merge-queue.sh already
   does at landing time is sufithe only place this mattered), close this item as "already handled" with
   the reproduction evidence recorded.

## Tests
- A `test-worktree-bootstrap.sh`/`test-merge-queue-certified-tree.sh` fixture that bootstraps a lane
  worktree, runs a full gate to green inside it, and asserts (RED today if the gap is real, GREEN after
  whichever fix direction is chosen) that `green-stamp.sh check` certifies that tree.

## Done when
- [ ] Reproduction step 1 run and its outcome recorded in this item (confirm or refute the gap).
- [ ] If confirmed: fix landed per step 2, with a passing fixture; plugin/overlay version bumped;
  decision-log entry.
- [ ] If refuted: item closed noting why (e.g. the gap only existed at landing time and merge-queue.sh
  already handles it), no code change needed.

## Out of scope
Changing `worktree-bootstrap.sh`'s own choice to set skip-worktree for local dev PORT overrides (that
part is working as intended, per BL-0288); changing the merge-queue's own landing-time skip-worktree
clearing (already implemented).
