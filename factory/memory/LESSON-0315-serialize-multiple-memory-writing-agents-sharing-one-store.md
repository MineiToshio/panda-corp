---
id: LESSON-0315
type: pattern
domain: factory-engineering
tags: [memory, orchestration, concurrency, librarian, shared-state, serialization]
context: dispatching more than one librarian/memory-harvest agent in the same sweep when every harvest reads, deltas and commits the SAME shared files (factory/memory/INDEX.md, the inbox)
trigger: use this when orchestrating multiple agents that each write to and commit the SAME shared store/file (not disjoint per-project files) in one sweep
source: "panda-corp — pandacorp-memory-review sweep 2026-10-13, factory/memory/_inbox.md agent-inferred note"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0032, LESSON-0116, LESSON-0020]
---

**Situation:** a `pandacorp-memory-review` sweep had a large backlog pending (the factory inbox plus 4
projects). The orchestrating session considered fanning out one `/pandacorp:memory harvest <target>`
librarian call per target in parallel, but ran them SEQUENTIALLY instead, because every harvest call —
regardless of which project's capture points it reads — writes a **delta edit to the shared
`factory/memory/INDEX.md`** and **commits to the same factory git repo** (per the harvest skill's own
commit step). This is unlike independent per-project build work, where each agent's writes land in
disjoint files/worktrees.

**Lesson:** parallelizing agents that each read-edit-write-commit the SAME shared file is unsafe even
when their *source* data (the capture points being read) is fully disjoint — the hazard isn't the read,
it's the concurrent delta-edit + commit on the one shared sink. Two agents can each read `INDEX.md` at
its pre-edit state, independently apply their own delta, and the second commit either silently drops the
first agent's addition (lost update) or collides as a merge conflict. This generalizes LESSON-0032's
"shared monotonic value needs a single owner" past counters/semver fields to any shared mutable
artifact a fan-out of agents all intend to edit, and is the memory-store-specific sibling of
LESSON-0116's "serialize only the write-back" pattern (there, concurrent build gates share a write-back
step; here, concurrent harvests share the whole INDEX.md edit + commit, which is cheap enough that
serializing the entire harvest call, not just its last step, is the simpler correct choice).

**Apply next time:** when designing or running a fan-out of agents that each produce a durable artifact
in a store with ONE shared index/log file (memory's `INDEX.md`, a shared manifest, a single changelog),
run them sequentially rather than in parallel, even if their read-side inputs are disjoint — unless a
narrower write-back-only serialization point (LESSON-0116's pattern) has been deliberately engineered and
tested for that artifact. Don't assume disjoint *sources* imply disjoint *writes*.
