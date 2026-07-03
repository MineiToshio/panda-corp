---
id: LESSON-0032
type: anti-pattern
domain: build-engine
tags: [implement-backlog, parallel-agents, versioning, plugin-json, merge-coordination]
context: multiple parallel worktree-isolated subagents each independently computing and bumping a shared monotonic value (a semver field) from the same stale base
trigger: use this when designing a parallel/worktree-isolated multi-agent flow where more than one agent may need to bump the SAME shared monotonic value (a version field, a counter) rather than each own a disjoint resource
source: "panda-corp implement-backlog whole-queue run 2026-07-02 — BL-0010 and BL-0006 subagents both computed plugin.json v9.53.0 from the same stale main base, colliding with main's already-merged v9.53.0"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0024]
---

**Situation:** in a whole-backlog `implement-backlog` run, parallel worktree-isolated subagents each
read `plugin.json`'s version from the same stale `main` base and independently computed the "next"
semver bump — two different subagents both landed on the same next version number, colliding with a
version `main` had already advanced to via a prior serialized merge. The collision was caught and
reconciled by hand at merge time, but nothing structurally prevents it from recurring.

**Lesson:** a disjoint-worktree parallelization strategy (each agent isolated in its own git worktree,
believed to avoid file conflicts) breaks down for any SHARED MONOTONIC value computed as "current value
+ 1" — every worktree starts from the same stale base and independently derives the same "next" value,
so the isolation that prevents file-content conflicts does nothing to prevent value collisions on a
counter/semver field. This is the same class of problem `validate-backlog.sh`/`validate-memory.sh`
solve for `BL-*`/`LESSON-*` ids (an authoritative "next free id" allocator) — but nothing analogous
existed for `plugin.json`'s version.

**Apply next time:** when a parallel multi-agent flow may have more than one agent touch a shared
monotonic value, do not let each agent compute "current + 1" from its own stale view; either (a) have
only the single serializing/merging step own that bump (never the individual workers), or (b) give the
value a stamped-at-merge-time allocator analogous to the id-allocator pattern already used for backlog
and memory ids.
