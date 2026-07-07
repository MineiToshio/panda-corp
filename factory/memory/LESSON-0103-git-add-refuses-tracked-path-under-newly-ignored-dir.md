---
id: LESSON-0103
type: gotcha
domain: git
tags: [git, gitignore, add, tracked-files]
context: staging a file that is ALREADY TRACKED in git but sits under a directory that was added to `.gitignore` AFTER the file was first committed
trigger: use this when `git add <path>` refuses with "The following paths are ignored by one of your .gitignore files" for a path you know is already tracked
source: "mission-control .pandacorp/run/lessons.md 2026-07-07 (worktree-bootstrap.sh under the now-ignored .pandacorp/) — agent-inferred"
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** `git add mission-control/.pandacorp/worktree-bootstrap.sh` refused with "The following paths
are ignored by one of your .gitignore files," even though the file was already tracked in git. The
directory (`.pandacorp/`) had been added to `.gitignore` at some point AFTER the file was first committed —
modern git still runs the ignore check when a path is named EXPLICITLY, even for a file that is tracked.

**Lesson:** "already tracked" does not exempt a path from the ignore check when you name it directly in
`git add`. Reaching for `-f` (force) is the wrong fix here — `-f` means "add despite being ignored,"
which is semantically correct but easy to reach for out of habit in a way that could mask a genuine
accidental-ignore mistake elsewhere.

**Apply next time:** for a file you know is already tracked but sits under a now-ignored directory, use
`git add -u -- <path>` instead of a plain `git add <path>` — `-u` only touches paths git already tracks
and skips the ignore check entirely, staging the change cleanly without needing `-f`.
