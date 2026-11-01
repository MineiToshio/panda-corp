---
id: LESSON-0598
type: gotcha
domain: testing
tags: [e2e, fixture-database, migration, merge-queue, prisma]
context: a project has a bespoke, project-owned script that migrates/seeds a dedicated gate/e2e fixture database (separate from the generic merge-queue/verify.sh template), and more than one gate path reads that same fixture database
trigger: use this when an e2e/Playwright pass against a project-owned fixture database fails with a Prisma "table/column does not exist" error (P2022) right after landing a branch that added a migration, even though a project-specific gate script already migrates that database
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-31/11-01 (agent-inferred) — the generic verify.sh/merge-queue.sh e2e pass reads the same `ft_gate` fixture database the project's own bespoke fidelity-gate script migrates/recreates, but does not itself run that migration step; a branch landing a new migration hit P2022 on the generic e2e pass's first touch of the fixture"
provenance: agent-inferred
created: 2026-11-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0154]
---

**Situation:** a project built its own bespoke fixture-database migration/seed script for a custom
visual-fidelity gate, pointed the GENERIC e2e config (the one `verify.sh`/`merge-queue.sh` already run) at
that same fixture database, but only the bespoke script actually runs the migration. A branch landing a
new schema migration passed the generic e2e pass's OWN checks fine in isolation, then hit P2022 ("table
does not exist") in the merge queue, because the generic e2e pass touched the fixture database before the
bespoke migration step ever ran against it in that worktree/queue run.

**Lesson:** a fixture database shared by more than one gate path is only as migrated as the LEAST recently
migrated path that touches it — a generic template gate has no visibility into a project's own bespoke
migration script, so pointing it at the same fixture without also ensuring that fixture is migrated on
every path that reads it reintroduces exactly the schema-staleness class a migrated-template-database
design is meant to prevent.

**Apply next time:** when a project wires a generic e2e config to read a fixture database that a different,
project-owned script migrates/seeds, make the migration step a precondition of EVERY gate path that reads
that database — not just the bespoke one. Either have the generic e2e setup call the same migrate/seed
step first, or keep the fixture databases genuinely separate per gate path so one path's staleness cannot
leak into another's run.
