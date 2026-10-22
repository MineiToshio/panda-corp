---
name: memory
description: "Operates the Pandacorp factory's self-learning memory
  (factory/memory/). Two modes: 'harvest' extracts durable lessons
  (problem->solution, library verdicts, patterns, gotchas, anti-patterns) from a
  project's capture points into the store as candidates; 'review' audits the
  store for stale, contradicted or duplicate lessons and proposes
  deprecations/promotions. Runs IN the factory (panda-corp), on demand, in an
  attended session as a /loop job, or via its durable form — the daily scheduled
  routine `pandacorp-memory-review` at plugin/docs/routines.md §1 (a /loop job
  is session-scoped and expires after 7 days; it is not the recurring
  mechanism). It proposes; promoting a lesson to a standard/rule/skill is
  /pandacorp:learn plus the owner (DR-047). Use when the owner says 'harvest
  lessons', 'what did we learn', 'review the memory', 'prune the lessons', or
  after a project ships."
user-invocable: false
---

# /pandacorp:memory

Reached through `/pandacorp:learn` (Step 0); it is not an owner command.



## Team

- librarian
- architect
