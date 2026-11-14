---
id: BL-0323
type: bug
area: build-engine
title: "A re-dispatched review runs on its first-dispatch checkout; its 'wrong checkout' block hands the work back to the owner"
status: done
severity: p0
opened: 2026-11-14
closed: 2026-11-14
source: "funko-tracker run br-2026-11-14-01 on plugin 10.7.0 (epoch 33)"
closes: "plugin 10.8.0 — pinReviewWorktree at dispatch, review_checkout env-infra classification, unblock re-queues the review"
links: [BL-0312, BL-0321, BUILD-15]
---

## Problem
The re-review of `frd-01-catalog-browsing` was dispatched to Codex Sol xhigh with the brief range
`0953e48e..546c5520` (the integrated patch), but its worktree `wt/u-review-frd-01-catalog-browsing` was the checkout of
the first dispatch, HEAD `646d2b80` (15 files older). The reviewer correctly refused to judge that tree and returned
`blocked`; `review-record` handed the build and the patch back with cause `owner` / `review_blocked`, and `next`
returned `done` with the FRD unlanded.

## Root cause
`prepareUnitWorktree` reuses a registered worktree as-is (right for build units, which keep their own work). A review
unit keeps the same id and attempt across re-dispatches, so it kept the first checkout; nothing moved it to the range
the brief names or checked HEAD before launch. And a `blocked` verdict was always the owner's, even when it only
judged the engine's wrong checkout.

## Fix
- `units/worktrees.mjs` `pinReviewWorktree`: before a `review` / `deferred-review` worker starts, the worktree is moved
  with `reset --keep` to the end of the diff range the brief names (only when every commit it holds is on the
  integration branch), and HEAD is verified equal to that pin; otherwise INVALID_STATE before launch.
- `review-record`: a `blocked` verdict issued while the review checkout HEAD is not the range end is a hand-back with
  cause `env-infra`, reason code `review_checkout`.
- `unblock`: a `review_checkout` hand-back, or an older owner `review_blocked` one with a proof (the review worktree
  HEAD differs from its brief's range end), returns the reviewed work to its prior state (`reviewing`/`integrated`, WOs
  back to IN_REVIEW, never a rebuild) and re-queues the review unit with its verdict cleared.

## Verification
`test-build-v2-review-pin.mjs` (real git: pin moves and proves HEAD, keeps untracked files, refuses a branch with its
own commit; legacy proof true/false and the plan), `test-build-v2-review.mjs` BL-0323 cases (env-infra vs owner),
`test-build-v2-next.mjs` (dispatch pins to the briefed range end), all `test-build-v2-*` suites.
