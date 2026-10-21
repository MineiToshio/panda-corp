---
id: LESSON-0448
type: gotcha
domain: testing
tags: [git, test-fixtures, cherry-pick, deterministic-dates, worktree-sweep]
context: writing a test fixture that creates git commits with fixed `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` and then exercises a "is this commit already merged/patch-equivalent" check (e.g. `git cherry`, `git log --cherry-pick`, a custom merged-detector)
trigger: use this when a test fixture pins commit dates/authors to make output deterministic AND the scenario needs two commits to be genuinely DIFFERENT (e.g. "patch-equivalent but not yet merged" vs "already merged")
source: "factory/memory/_inbox.md 2026-10-20 (agent-inferred) — writing test-worktree-sweep.mjs fixtures for DR-135's merged-detection"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0111, LESSON-0125]
---

**Situation:** a test fixture for `worktree-sweep.mjs`'s merge-detection logic needed a branch commit that
is "patch-equivalent to a commit on `main`" without being a literal ancestor. With `GIT_AUTHOR_DATE` and
`GIT_COMMITTER_DATE` fixed for determinism, cherry-picking the branch's commit onto `main` while `main` was
still sitting at the SAME parent it branched from produced a commit with the IDENTICAL sha — because git's
commit hash is a function of tree, parent, author/committer identity AND date, and the fixture had
collapsed every one of those to the same fixed values. The branch's commit was then trivially "merged"
(same sha reachable from `main`), not merely patch-equivalent — the exact distinction the test needed to
exercise got erased by the fixture's own determinism.

**Lesson:** fixing commit dates for reproducibility removes one more degree of freedom that normally makes
two commits with the same diff hash differently — so a cherry-pick (or any recommit of the same tree) onto
an UNCHANGED parent silently collapses "patch-equivalent" into "identical/merged" instead of producing the
two genuinely distinct commits the scenario intended.

**Apply next time:** when a git-fixture test with pinned dates needs a commit that is patch-equivalent but
NOT identical/merged, advance the target branch (e.g. `main`) with an unrelated commit BEFORE cherry-picking
onto it, so the parent differs and the recomputed sha is forced to differ too. Don't assume pinned-date
fixtures preserve sha-distinctness across any git operation that recomputes a commit from the same
tree+parent+identity+date tuple.
