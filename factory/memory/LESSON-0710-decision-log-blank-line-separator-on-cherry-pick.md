---
id: LESSON-0710
type: gotcha
domain: factory-engineering
tags: [decision-log, cherry-pick, git-merge, documentation]
context: cherry-picking a commit onto a branch where both the cherry-picked commit and the branch's own pending work insert a new top entry into the same `docs/decision-log.md`
trigger: use this when cherry-picking a commit that touches a project's `decision-log.md` onto a branch that will also add its own top entry to the same file
source: "funko-tracker agent-inferred note, 2026-11-21: 'a perf/e2e-clonefile-fixtures cherry-pick (2 commits touching docs/decision-log.md top) applied cleanly onto the overlay commit, but the overlay decision-log entry sits flush against the cherry-picked entry with no blank line (git auto-merge) because funko's log uses blank-line-separated bullets: insert the upgrade entry AFTER cherry-picks or add the separator.'"
provenance: agent-inferred
created: 2026-11-21
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** `docs/decision-log.md` entries in this project are separated by a blank line between
bullets. Cherry-picking two commits that each insert a new top entry onto a branch that ALSO inserts its
own top entry (here: an overlay-upgrade decision-log entry) can apply cleanly at the text level (`git
cherry-pick` reports no conflict) while still producing two adjacent entries with no blank line between
them, because a clean three-way merge of adjacent insertions doesn't know the file's own paragraph-
separator convention.

**Lesson:** a clean cherry-pick/merge of a markdown log file is not a guarantee of correct FORMATTING —
only of no textual conflict. When several changes each insert a new entry at the top of the same
append-style log file, the resulting adjacency between entries needs a visual check (and the blank-line
separator added by hand if missing), or the insertion order should be sequenced (cherry-pick first, add
the branch's own entry AFTER, so it never has to merge against an entry inserted by the same operation).

**Apply next time:** after cherry-picking or merging a change that touches the top of an append-style
log file (`decision-log.md`, `CHANGELOG.md`, `_inbox.md`), visually check (or script-check) that the
file's own separator convention (a blank line between bullets, in this project) still holds between the
newly-adjacent entries, rather than trusting a clean merge/cherry-pick to have preserved formatting.
