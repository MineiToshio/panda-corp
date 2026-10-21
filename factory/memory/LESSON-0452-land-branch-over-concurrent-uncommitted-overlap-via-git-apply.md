---
id: LESSON-0452
type: pattern
domain: git-workflow
tags: [concurrency, git-apply, landing, shared-checkout, worktree]
context: landing a branch's commits into the main checkout when that checkout ALSO has another session's uncommitted edits in a file the branch's commits also touch (e.g. a shared decision-log)
trigger: use this when merging/landing a branch directly into a shared main checkout and `git status` shows another session's uncommitted WIP overlapping a file your branch also changed
source: "factory/memory/_inbox.md 2026-10-20 (agent-inferred) — landing a factory branch over another session's uncommitted mission-control/docs/decision-log.md edits"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a factory branch needed to land directly into `main` (no PR/merge-queue in the factory repo,
solo-operator), but the main checkout already had another session's uncommitted edits to a file the branch
also modified (`mission-control/docs/decision-log.md`). A plain merge/rebase risks conflicting with or
discarding the other session's in-progress, not-yet-committed work.

**Lesson:** the commits that do NOT touch the contested file can simply fast-forward-merge in first. For
the remaining commits that DO touch it, applying them as a PATCH against the current (dirty) working tree
— rather than merging/rebasing commit objects — lets the other session's uncommitted hunks and the
landing branch's changes coexist without a stash, a WIP commit, or touching files outside the landing
branch's own diff.

**Apply next time:** `git diff A B > patch.diff` (A = the pre-landing commit, B = the landing branch tip),
`git apply --check patch.diff` to confirm it applies cleanly against the dirty tree, then `git apply
--cached patch.diff` + `git apply patch.diff` (index and worktree) and `git commit -C B` to reuse B's
message/metadata on the new commit. The result has the same tree as B, lands cleanly, and leaves the other
session's uncommitted hunks exactly as they were — intact and still uncommitted.
