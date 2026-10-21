---
id: LESSON-0449
type: gotcha
domain: tooling
tags: [git, worktree, sync-tool, rev-parse, ambiguous-ref, host-tool]
context: bringing a worktree up to date with the repo's default branch when the LOCAL default branch is itself ahead of its remote tracking branch (unpushed commits)
trigger: use this when a worktree/session needs to sync onto the repo's default branch and the host's own sync tool (e.g. a `sync_with_base_branch`-style helper) reports "nothing to merge" even though local work is clearly ahead
source: "factory/memory/_inbox.md 2026-10-20 (agent-inferred) — plugin version bump 9.131→9.138 in a worktree while the main checkout's local `main` was ahead of `origin/main`"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** the host runtime's built-in `sync_with_base_branch`-style tool only fetches/merges from the
REMOTE tracking ref (`origin/main`). When the local checkout's `main` had already advanced well past
`origin/main` without being pushed (observed: local at 9.138 while origin still pointed at 9.131), the tool
reported "nothing to merge" — technically true for `origin/main`, but misleading, since the worktree still
needed the LOCAL commits. A plain `git merge main` (bare branch name) was also ambiguous to `git rev-parse`
in this setup. The working fix: `git merge --ff-only refs/heads/main` (or an unambiguous local-ref form)
run by hand.

**Lesson:** a host-provided "sync with base branch" convenience tool is scoped to the REMOTE tracking ref,
not the local tip of that branch — the two can diverge in a solo-operator repo that pushes in batches.
Trusting the tool's "nothing to merge" verdict as "I am up to date" is wrong whenever local history can be
ahead of origin. Separately, a bare branch name handed to `git rev-parse`/`git merge` can be ambiguous in
a repo with multiple refs of the same short name (tags, remote branches) — the fully-qualified
`refs/heads/<branch>` form resolves unambiguously.

**Apply next time:** before trusting a sync-with-base-branch convenience tool's "up to date" verdict, check
whether the local default branch is itself ahead of its remote tracking ref (`git rev-list
origin/main..main`); if it is, merge the LOCAL ref directly (`git merge --ff-only refs/heads/main`) instead
of relying on the tool. Prefer `refs/heads/<branch>` over a bare branch name whenever a script needs an
unambiguous resolution.
