---
id: LESSON-0362
type: pattern
domain: build-orchestration
tags: [rebase, verification-checkout, formatter, concurrent-main, gate]
context: an isolated verification checkout/worktree passed its gate, but a concurrent commit landed on main in the meantime that introduces a NEW failure (e.g. a formatter rule) once the two are merged
trigger: use this when a change verified in an isolated/detached checkout needs to land on a main branch that moved after verification started
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-17: a concurrent main commit introduced a formatter failure after the isolated product candidate had already passed; the fix was to rebase the detached verification checkout non-destructively onto current main, fix formatting without touching authored text, and rerun the integrated gate before deploying"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0020]
---

**Situation:** a change was verified and passed its gate in an isolated/detached checkout. Before it could
land, a concurrent commit reached main that introduced an unrelated formatter failure — so a naive merge of
the already-passed candidate would now fail the integrated gate, even though the candidate's own logic was
never wrong.

**Lesson:** "my isolated candidate passed its gate" is not the same claim as "the integrated result after
merging with whatever else landed on main will also pass." Between verification and landing, main can move
in ways that only surface once the two trees are actually combined (a formatter rule, a shared config
change, a lint rule). This is a distinct risk from LESSON-0020's benign-commit-race diagnosis — this is
about PREVENTING a real integration failure, not explaining an already-landed oddity.

**Apply next time:** before landing a verified candidate, rebase its detached verification checkout onto
the CURRENT main non-destructively (preserving both the candidate's and main's changes), fix anything the
rebase surfaces (e.g. run the formatter) WITHOUT altering the authored content, and rerun the full integrated
canonical gate on the rebased result before deploying — never trust the pre-rebase gate result as sufficient
once main has moved.
