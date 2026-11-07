---
id: LESSON-0632
type: gotcha
domain: version-control
tags: [git, diff, merge-base, branch-comparison]
context: comparing a branch against `main` to check what that branch changed, when `main` has received
  commits after the branch was created
trigger: use this when running `git diff` between `main` and another branch to determine what that
  branch added/removed — before concluding the branch deletes or removes something
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-05 (agent-inferred): `git diff main <branch>`
  reported content `main` had added AFTER the branch point as 'deleted in branch', which was false"
provenance: agent-inferred
created: 2026-11-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** `git diff main <branch>` (two dots, comparing the tip of `main` directly against the
branch's tip) reported lines as "deleted in `<branch>`" that `<branch>` never touched — they were
additions `main` received AFTER the branch had already diverged. Taken at face value, this looked like
the branch was removing content it had actually never seen.

**Lesson:** a two-dot `git diff A B` compares the two tips literally, with no awareness of a common
ancestor — anything present in `A` but absent in `B` shows as "removed by B", even when `B` simply never
had it because `A` added it later, after `B` branched off. This makes a two-dot diff actively misleading
for the common question "what did this branch change relative to where it started," which is really a
question about the MERGE-BASE, not about `main`'s current tip.

**Apply next time:** to determine what a branch actually added/removed relative to its own starting
point, use the three-dot form `git diff A...B` (diffs from the merge-base of A and B to B's tip) or
`git merge-tree --write-tree A B` (simulates the merge and shows real conflicts/changes) — never a
two-dot `git diff A B` when `A` may have moved since the branch was created. Before asserting a branch
"deletes" or "removes" something found via a two-dot diff, re-verify with the three-dot form or an
explicit merge-base comparison.
