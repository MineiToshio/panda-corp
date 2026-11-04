---
id: LESSON-0610
type: pattern
domain: database
tags: [migration, psql, data-integrity, ops-tooling, prod-safety]
context: a production data-model change (e.g. merging/removing a collection/category record) is needed, but the project's own ops tooling has no delete/merge capability for that entity
trigger: use this when a production data migration must delete or merge rows and the project's own ops tooling cannot do it, so a direct SQL transaction against prod is being considered
source: "funko-tracker .pandacorp/inbox/decisions.md 2026-11-03 (owner-stated): a generic collection had to be merged into a franchise's base series; ops tooling could not delete a collection, so a guarded psql transaction (precondition counts + ROW_COUNT asserts) run first on DEV then on prod behind a Neon no-compute backup worked"
provenance: owner-stated
created: 2026-11-04
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: [funko-tracker]
links: []
---

**Situation:** a production data-model fix required deleting/merging rows that the project's own ops
tooling (CLI/admin UI) has no command for. A direct hand-written SQL transaction against the production
database was the only path.

**Lesson:** a hand-written transaction against prod is acceptable risk ONLY when wrapped in explicit
safety: (1) take a reversible backup immediately before running it (e.g. a database platform's
no-compute/branch snapshot, cheap and fast to restore from), (2) assert PRECONDITION row counts before
the mutating statements (the data is in the exact shape expected, or abort), (3) assert the mutating
statements' own `ROW_COUNT` after running (exactly the expected number of rows changed, or abort/rollback
rather than trust the statement "probably" did the right thing), and (4) rehearse the exact same
transaction on a DEV/staging copy first, never prod-first.

**Apply next time:** when a project's own tooling cannot perform a needed data deletion/merge and a
direct SQL transaction is the only path, never run it bare — take a reversible backup first, assert
precondition counts, assert `ROW_COUNT` after mutation, and rehearse on DEV before touching prod.
