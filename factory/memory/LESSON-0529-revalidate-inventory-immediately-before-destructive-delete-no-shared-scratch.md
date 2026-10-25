---
id: LESSON-0529
type: anti-pattern
domain: agent-verification
tags: [concurrency, data-loss, shared-folder, scratch-directory, race-condition, forked-session]
context: deleting a folder/dataset that was audited as "safe to delete" some time earlier, in an environment where another parallel/forked agent session might be actively using it
trigger: use this when about to run a destructive cleanup (delete a directory/dataset) based on an inventory or audit performed more than a few minutes earlier, especially in a shared/scratch location reachable from more than one session
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — an authorized cleanup in a forked session deleted funko-tracker-data/program/ while a DIFFERENT, concurrently running session was actively using that same folder as its working directory; the audit that justified the deletion as safe had been performed only 15 minutes earlier, but a parallel session had since started relying on the folder"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0111]
---

**Situation:** an agent session audited a shared data folder, confirmed nothing depended on it, and
received authorization to delete it. By the time the deletion actually ran (about 15 minutes later), a
DIFFERENT forked/parallel session had started using that exact folder as its active working directory.
The delete went through as planned from the deleting session's point of view — it had genuinely verified
"safe" at audit time — but it destroyed another session's in-progress work, because the audit's result
had gone stale in the interval and the folder was never exclusive to one session to begin with.

**Lesson:** a safety audit for a destructive action is only valid at the instant it was taken — treating
it as still true minutes later, in an environment where OTHER agent sessions can independently start
using the same shared location at any moment, is the same "stale snapshot treated as durable fact"
failure LESSON-0027 already names for claims, applied here to a DESTRUCTIVE ACTION instead of an
assertion (which makes it strictly worse: a stale claim is corrected by re-checking, a stale-audit delete
is unrecoverable). The deeper structural cause is using a folder reachable from multiple sessions as if
it were one session's private scratch space.

**Apply next time:** (1) re-validate a destructive-delete target IMMEDIATELY before running the delete,
not from an audit performed any amount of time earlier — even a short gap is enough for a parallel
session to start depending on it; (2) never treat a folder reachable by multiple concurrent/forked agent
sessions as if it were exclusive scratch space for active work — use a session-private scratch directory
for in-progress work, and reserve shared folders for already-finalized, read-mostly data.
