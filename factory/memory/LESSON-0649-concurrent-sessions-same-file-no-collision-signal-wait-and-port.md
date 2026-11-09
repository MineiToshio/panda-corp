---
id: LESSON-0649
type: pattern
domain: build-orchestration
tags: [concurrency, worktree, parallel-sessions, merge-conflict, collision-detection]
context: two parallel agent sessions editing the same file(s) at the same time with no shared signal warning either one that the other is active
trigger: use this when diagnosing repeated, re-surfacing rebase/merge conflicts caused by a different parallel session racing on the same files, and when deciding how to resolve that race once detected
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08/09: two parallel sessions fixed the same review HTML at once (duplicate modal, duplicate reviewTemplateV32), causing three separate rebase conflicts with no signal warning that another session was editing the same files (agent-inferred); the owner's resolution, applied directly: wait for the other session to go idle, branch from current main, and port only the missing guarantees instead of resolving conflicts repeatedly (owner-stated: 'Sí, espera y porta')"
provenance: owner-stated
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0158, LESSON-0452]
---

**Situation:** two parallel sessions independently fixed the same review-HTML concern at the same time,
each producing its own version of the same change (a duplicate modal, a duplicate template function).
Nothing in the environment warned either session that the other was actively editing the same files, so
both proceeded to completion and then collided — repeatedly, across three separate conflict-resolution
attempts, because re-resolving the same conflict against a target that keeps moving (the other session is
still committing) doesn't converge.

**Lesson:** repeatedly re-resolving conflicts against another ACTIVE session's moving target is a losing
strategy — every resolution attempt is immediately stale the moment the other session commits again. The
owner's directive, generalizable beyond this one incident: when racing a parallel session on the same
files, stop trying to merge against a moving target. Wait for the other session to go idle (finish and
stop committing), THEN branch fresh from the now-settled main and selectively port only whatever
guarantees/changes your own branch had that the other session's landed version is missing — rather than
reconciling two evolving branches against each other conflict-by-conflict.

**Apply next time:** when a rebase/merge conflict against a parallel session's branch reopens repeatedly
(the same files, a new conflict each time), stop resolving in place — confirm the other session has gone
idle, branch from the current main tip, and port only the missing pieces by hand instead of continuing to
rebase/merge against an in-flight branch. Separately: this kind of collision has no structural early
warning today (nothing flags "another session is editing these files") — worth a process/tooling
improvement to surface that signal before two sessions diverge this far.
