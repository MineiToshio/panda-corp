---
id: LESSON-0356
type: pattern
domain: factory-engineering
tags: [git, parallel-agents, shared-checkout, staging-area, commit-hygiene]
context: publishing your own commit from a shared main checkout while another parallel session's edits may also be present, staged or unstaged, in the same working tree
trigger: use this when about to `git add`/`git commit`/clean the working tree in a shared checkout and another parallel session's own work may be mixed into the current git index
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-16: commit 57dcd761 found the git index had changed between inspection and close, mixing in a parallel session's own hunks across shared files (30 own files vs. 137 parallel files that had to remain staged). Corroborated 2026-10-21 (factory/panda-corp itself, agent-inferred): the daily `pandacorp-memory-review` scheduled routine runs unattended in the factory's single shared main checkout (not an isolated worktree), where another active session's uncommitted WIP (e.g. a mission-control docs edit) or concurrent `.claude/worktrees/*` activity can legitimately be present at the exact moment the harvest commits; no incident occurred (verified clean before/after commit `9a39a45e`), but the risk is structurally the same and was not yet written as an explicit rule in the one committed skill/agent pair (`plugin/skills/memory/SKILL.md`, `plugin/agents/librarian.md`) that runs this unattended — tracked as BL-0268."
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0020, LESSON-0043, BL-0268]
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
add), and leave anything that isn't yours — staged or unstaged — exactly as you found it. This applies
equally to a scheduled, unattended routine (e.g. `pandacorp-memory-review`) committing in the factory's
own shared main checkout — it must stage only the specific paths it wrote (`factory/memory/_inbox.md`,
its new/updated `LESSON-*`/`INDEX.md`, any new `factory/backlog/BL-*.md`, the project's `status.yaml`),
never `-A`/`.`, even when no concurrent session happens to be active at that moment. Treat any
foreign hunk discovered mid-close-out as evidence of a concurrent session, not as noise to clear.
