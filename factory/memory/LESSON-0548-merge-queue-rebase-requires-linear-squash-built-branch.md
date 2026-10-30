---
id: LESSON-0548
type: anti-pattern
domain: build-orchestration
tags: [git, merge-queue, rebase, squash-merge, linear-history, dr-141]
context: preparing an integration branch by hand (or with any tool) before handing it to a landing mechanism that rebases it onto the target branch (e.g. a merge-queue script doing `git rebase main` then fast-forward)
trigger: use this when an integration/landing branch was assembled using real `git merge` commits (not squash) and must then pass a queue/CI step that performs a plain rebase onto the target branch
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-28 (agent-inferred) — an integration branch built by actually merging several source branches (real merge commits resolving conflicts by hand) could not pass `merge-queue.sh`: its plain `git rebase main` linearizes the branch's non-linear history (no fast-forward possible) and replays BOTH sides of each prior merge individually, re-raising conflicts that the original hand-resolved merge had already settled"
provenance: agent-inferred
created: 2026-10-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-141]
---

**Situation:** several independently-verified branches were combined into one integration branch using
real `git merge` commits, with conflicts resolved by hand at merge time. The project's landing mechanism
(`merge-queue.sh`, DR-141) rebases the incoming branch onto the current tip of `main` before running the
integration gate. `git rebase` replays commits one at a time in their original, pre-merge form — it does
not understand or preserve a merge commit's already-resolved result. The rebase therefore re-applied
both sides of each prior merge independently and hit the SAME conflicts the hand-resolved merge had
already settled, even though the integration branch's actual tree was already correct and conflict-free.

**Lesson:** `git rebase`'s linearization model and `git merge`'s non-linear history model are
fundamentally incompatible inputs to the same downstream step — a rebase-based landing mechanism assumes
every branch it receives has LINEAR history (a sequence of commits with no merge commits of its own), and
silently does the wrong thing (replay-and-reconflict) when handed a branch that was built with real
merges instead. This is easy to miss because the integration branch's FINAL tree can be perfectly correct
— the problem only surfaces when the downstream rebase tries to replay the path that got there, not the
destination itself.

**Apply next time:** when a landing/queue mechanism rebases onto the target branch, never hand it a
branch assembled with real `git merge` commits — rebuild a LINEAR branch with the identical final tree
first (e.g. `git checkout -b linear <target> && git checkout <merged-branch> -- . && git commit`, or an
interactive rebase that squashes the merge-built branch against its base) before submitting it to the
queue. More generally: before adopting or auditing a rebase-based merge queue, state explicitly (in its
own docs/preflight) that it requires linear, squash-built branches — and reject/flag any incoming branch
that contains merge commits of its own, rather than letting the rebase fail confusingly deep into the
queue run.
