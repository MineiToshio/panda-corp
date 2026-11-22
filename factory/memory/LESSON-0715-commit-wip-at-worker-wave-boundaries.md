---
id: LESSON-0715
type: gotcha
domain: build-orchestration
tags: [worktree, commit-discipline, session-continuity, data-loss]
context: a long-running multi-worker job accumulates many changed files in one worktree before a single "final" commit is planned
trigger: use this when a worktree has been running for hours with a large uncommitted diff (tens to hundreds of files) across several dispatched worker waves, with the plan to commit once at the very end
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-21 (agent-inferred): a worktree accumulated ~700 changed files with no commit for hours; an unplanned session cut left that work uncommitted and exposed to loss."
provenance: agent-inferred
created: 2026-11-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0207, LESSON-0573]
---

**Situation:** a worktree running several dispatched worker waves over hours had ~700 uncommitted changed
files, with the only planned commit being a single one at the very end of the job. A session cut landed
mid-job, leaving all of it exposed on disk with no commit to recover to.

**Lesson:** committing only once at the very end of a long multi-worker job means every hour of work
between commits is uncommitted and therefore at risk from any interruption (a crash, a session restart, an
accidental worktree removal) — unlike a scratchpad (LESSON-0207), a git worktree's own uncommitted changes
have no automatic recovery path either.

**Apply next time:** commit WIP to the branch at the close of each dispatched worker wave (not only at the
very end of the job), even if the commit message is provisional/marked WIP — this bounds the amount of
work any single interruption can put at risk to "since the last wave," not "since the job started."
