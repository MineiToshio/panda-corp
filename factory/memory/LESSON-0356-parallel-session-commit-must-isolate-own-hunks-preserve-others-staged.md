---
id: LESSON-0356
type: pattern
domain: factory-engineering
tags: [git, parallel-agents, shared-checkout, staging-area, commit-hygiene]
context: publishing your own commit from a shared main checkout while another parallel session's edits may also be present, staged or unstaged, in the same working tree
trigger: use this when about to `git add`/`git commit`/clean the working tree in a shared checkout and another parallel session's own work may be mixed into the current git index
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-16: commit 57dcd761 found the git index had changed between inspection and close, mixing in a parallel session's own hunks across shared files (30 own files vs. 137 parallel files that had to remain staged)"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0020, LESSON-0043]
---

**Situation:** closing out a change in a shared main checkout, the git index at commit time differed from
what it was at inspection time — a parallel session had staged its own, unrelated hunks in shared files in
the meantime. A naive `git add -A`/commit, or a blind index reset, would have either published the other
session's unfinished work under this commit's message, or discarded it.

**Lesson:** this is distinct from LESSON-0020 (diagnosing a benign git race AFTER a commit already landed
oddly) and LESSON-0043 (deciding whether to keep or discard STRAY uncommitted files found at the start of a
session). This is about the PUBLISHING moment itself: in a shared checkout under real parallel activity,
the index you inspected is not guaranteed to be the index you commit — never confirm or clean the index
blindly at close-out.

**Apply next time:** at commit time in a shared checkout, re-diff the index against what you expect to be
YOUR OWN change set; stage/commit only your own candidate files explicitly by path (never `-A`/a blanket
add), and leave anything that isn't yours — staged or unstaged — exactly as you found it. Treat any
foreign hunk discovered mid-close-out as evidence of a concurrent session, not as noise to clear.
