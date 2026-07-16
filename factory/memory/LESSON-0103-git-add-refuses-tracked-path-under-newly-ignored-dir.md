---
id: LESSON-0103
type: gotcha
domain: git
tags: [git, gitignore, add, tracked-files]
context: staging a file that is ALREADY TRACKED in git but sits under a directory that was added to `.gitignore` AFTER the file was first committed
trigger: use this when `git add <path>` refuses with "The following paths are ignored by one of your .gitignore files" for a path you know is already tracked
source: "mission-control .pandacorp/run/lessons.md 2026-07-07 (worktree-bootstrap.sh under the now-ignored .pandacorp/) — agent-inferred. Corroborating instance: panda-corp _inbox.md 2026-07-15 — mission-control/.pandacorp/status.yaml (a tracked file under the gitignored .pandacorp/): `git check-ignore` returned NOTHING for the exact path (git itself doesn't classify it as ignored), yet a plain `git add` and `git add -A <dir>` both still refused it; only `git add -f <path>` succeeded."
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
A second, independent instance (mission-control/.pandacorp/status.yaml) showed the check can refuse a path
even when `git check-ignore` itself reports the path as NOT ignored — the directory-level exclusion still
applies to a named child path in some git versions/configurations regardless of what the single-file
ignore check reports.

**Lesson:** "already tracked" does not exempt a path from the ignore check when you name it directly in
`git add`, and the refusal can persist even when `git check-ignore` on that exact path returns nothing.
Reaching for `-f` (force) is not automatically wrong here — it's the workaround that reliably works across
BOTH observed variants of this gotcha, though it's easy to reach for out of habit in a way that could mask
a genuine accidental-ignore mistake elsewhere, so prefer the narrower `-u` first and fall back to `-f`.

**Apply next time:** for a file you know is already tracked but sits under a now-ignored directory, try
`git add -u -- <path>` first (only touches paths git already tracks, skips the ignore check entirely). If
that still refuses (seen when the parent directory is gitignored even though `git check-ignore` on the
exact file returns nothing), use `git add -f -- <path>` — a plain `git add <path>` or `git add -A <dir>`
can both still fail in this second variant.
