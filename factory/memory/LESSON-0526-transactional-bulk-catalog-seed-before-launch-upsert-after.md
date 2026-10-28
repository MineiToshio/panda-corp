---
id: LESSON-0526
type: pattern
domain: data-modeling
tags: [bulk-seed, catalog, transaction, launch, migration, idempotency]
context: loading a large reference/catalog dataset into a production database before real users exist, versus maintaining it afterward
trigger: use this when a project needs to populate its production database with a large catalog/reference dataset for the first time, or decide how to apply catalog updates after real users already have data
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (owner-stated + agent-inferred verdict) — initial production catalog load used a single local-to-production transactional copy of the catalog tables (363 pieces, ~88MB of SQL, 38-60s total, verified idempotent via a franchise guard with full rollback tested) instead of the project's own per-item Ops CLI batches (~2 minutes per 10 pieces, and a P2028 transaction-timeout error at a batch size of 20); the owner's explicit rule for AFTER real users exist: only insert/update catalog rows, never delete"
provenance: owner-stated
created: 2026-10-25
status: active
promotion: none
confidence: high
times_applied: 1
applied_in: [funko-tracker]
links: []
---

**Situation:** a catalog-tracking app needed its full reference catalog (hundreds of items) loaded into
production for the first time, before any real user data existed. The project's own per-item ingestion
CLI (designed for ongoing, API-rate-limited updates) took ~2 minutes per 10 items and hit a transaction
timeout (Prisma P2028) at a batch size of 20 — far too slow and fragile for an initial bulk load of
hundreds of items. A single transactional SQL copy of the catalog tables straight from the verified local
database completed the same load in well under a minute, and was verified both idempotent (a
franchise-level guard prevents double-insertion) and safely reversible (a full-rollback test passed).

**Lesson:** an ingestion pipeline optimized for ongoing, incremental, rate-limited updates (one
API-sourced item at a time) is the WRONG tool for a one-time initial bulk seed of a large catalog — its
per-item overhead and conservative batch sizing that make sense for steady-state updates become a
timeout-prone bottleneck at bulk-load scale. A single transactional table-level copy from an already
-verified source is both faster and safer for that one-time case, PROVIDED it stays idempotent (a guard
against re-running it) and is tested for full rollback before being trusted on production. This is a
narrow, pre-launch-only shortcut: the moment real users have their own data layered on top of the
catalog, the safety property flips — a catalog "load" at that point must be upsert-only (insert new rows,
update existing ones) and must NEVER delete, since a delete could cascade into a real user's own
collection/ownership records.

**Apply next time:** for a one-time initial seed of a large reference/catalog dataset into a database
with no real user data yet, reach for a transactional table-level copy from a verified source rather than
reusing the steady-state per-item ingestion pipeline — but verify idempotency and rollback before running
it against production. Once real users exist, gate every subsequent catalog refresh to insert/update
only, with deletion explicitly forbidden.
