---
id: BL-0023
type: bug
area: build-engine
title: "merge-queue.sh deleted the worktree the invoking session stands in — dangling cwd kills the next message and every background task"
status: done
severity: p1
opened: 2026-07-02
closed: 2026-07-02
source: "owner/conversation 2026-07-02 — recurring: 'Path .../worktrees/<name> does not exist' after every merge, background processes cancelled"
closes:
links: [DR-096, BL-0022]
---

## Problem

`merge-queue.sh` ended a successful merge with `git worktree remove --force "$WORKTREE"` — but the
script is invoked FROM INSIDE that worktree by a live Claude session. The script's own `cd "$MAIN_WT"`
only moves the SCRIPT's cwd; the session's working directory still points at the now-deleted path.
The next user message fails at the harness level ("Path …/worktrees/<name> does not exist"), the
session is force-restarted, and every in-flight background task dies with it. The owner hit this
repeatedly (3× on 2026-07-02 alone), each time losing the running merge/verify monitors.

## Root cause

Worktree removal was owned by the wrong layer. Only the HARNESS (ExitWorktree) knows the session's
cwd binding and can restore it atomically with the removal; a shell script can never do both.

## Fix (shipped, plugin v9.48.0)

1. `merge-queue.sh` no longer removes the worktree/branch. On success it prints the new contract:
   call `ExitWorktree(action: remove)` (cleans AND restores the session cwd), with the outside
   `git worktree remove --force <wt> && git branch -D <br>` fallback for restarted sessions.
2. `pending-work.sh` recalibrated: a surviving worktree with an UNMERGED branch/dirty tree is still
   pending; a fully-merged CLEAN survivor is a kept session shell — listed apart as "♻ removable",
   never counted as pending (no false "⎇ pendientes" in Mission Control).
3. Docs re-worded everywhere the old invariant lived: `factory/standards/build-orchestration.md`
   ("Parallel manual sessions"), `factory/decisions/registry.yaml` (DR-096 default),
   `guide.md.tpl` + Mission Control's `.pandacorp/guide.md`.

## Proof

- `bash -n` on both scripts; `pending-work.sh` smoke-run on mission-control correctly split a real
  merged leftover (`claude/focused-hermann-b464d8`, since removed) from pending work.
- The behavioral proof is negative and forward-looking: after the next merge-queue landing the
  session must survive its own merge (no "Path does not exist" on the following message).
