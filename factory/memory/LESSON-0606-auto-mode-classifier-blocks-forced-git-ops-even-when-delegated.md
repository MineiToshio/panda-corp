---
id: LESSON-0606
type: gotcha
domain: agent-tooling
tags: [auto-mode, permissions, git, classifier, delegation, forced-operation]
context: running `git worktree remove --force` or `git <op> --abort` (cherry-pick, rebase, merge) over unsaved/uncommitted work while operating under a broad owner delegation ("auto mode")
trigger: use this when a forced/destructive git operation (worktree remove --force, cherry-pick/rebase/merge --abort) is about to run over work that isn't committed, even though the owner has already delegated the decision to act autonomously
source: "mission-control .pandacorp/run/lessons.md 2026-11-01 (agent-inferred)"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0295, LESSON-0503, LESSON-0155]
---

**Situation:** operating under auto-mode (the owner has delegated authority to proceed without asking
for every step), `git worktree remove --force` and `git cherry-pick --abort` over work that was never
committed were both blocked by the permission classifier, even though the owner had explicitly delegated
this decision. A blanket "you decide" delegation does not itself satisfy the classifier's own narrower
test for a forced/destructive operation that can discard uncommitted work.

**Lesson:** auto-mode's classifier treats a FORCED operation over unsaved work as a distinct risk class
from ordinary delegated autonomy — general permission to act is not the same signal as per-operation
approval for something that can irreversibly discard data. This is consistent with the broader
protected-state discipline (never force-remove a path that could be the only evidence of uncommitted
work, LESSON-0155) extended to the classifier's own behavior: it will not take the agent's word that the
owner already said "go ahead" for this specific destructive act.

**Apply next time:** before running a forced git operation over anything not committed, back up the
at-risk state first (a patch file, a copy of the worktree, a `git stash`) so the data survives even if
the operation is denied or goes wrong, then ask the owner explicitly for approval of THIS forced step —
don't assume a prior blanket delegation already covers it, and don't try to work around the classifier's
block. If the owner has a standing policy that should cover this case, surface the specific blocked
command to them rather than silently retrying or escalating tooling to bypass the gate.
