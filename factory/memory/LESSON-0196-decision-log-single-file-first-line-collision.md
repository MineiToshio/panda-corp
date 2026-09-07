---
id: LESSON-0196
type: gotcha
domain: git-workflow
tags: [decision-log, merge-conflict, worktree, solo-operator]
context: multiple concurrent worktree sessions each appending a new entry to the TOP of the same decision-log.md file (the factory's "most recent entry on top" convention)
trigger: use this when running more than one concurrent worktree session that each writes a decision-log entry, or diagnosing why every decision-log edit rebases into a conflict
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-05 (agent-inferred)"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0158]
---

**Situation:** the "most recent entry on top" decision-log convention (AGENTS.md) means every session that
adds an entry edits the exact same first line of the file. Any two concurrent worktree sessions doing this
collide on rebase/merge every time.

**Lesson:** this is a predictable, structural collision — not an anomaly to investigate — inherent to
combining a single always-append-at-top file with parallel worktree sessions (constitution §11:
solo-operator, direct-to-main). The resolution is mechanical (keep both entries, most recent on top), but
it is guaranteed recurring friction whenever two sessions land decision-log edits close together in time.

**Apply next time:** expect and budget for this conflict whenever running parallel worktree sessions that
both touch a decision log; resolve by keeping both entries with the most recent on top — do not treat it
as a sign something is wrong. If this becomes frequent enough to matter, a per-entry-file convention (like
`factory/backlog/` or `factory/memory/`) would remove the collision structurally — but that is a
deliberate, separate change, not implied by hitting the conflict once.
