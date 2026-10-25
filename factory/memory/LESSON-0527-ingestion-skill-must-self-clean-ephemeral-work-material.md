---
id: LESSON-0527
type: pattern
domain: data-ingestion
tags: [ingestion, cleanup, disk-usage, ephemeral-artifacts, data-pipeline]
context: designing or running a data-ingestion skill/pipeline that produces intermediate work material (downloaded/edited photos, scratch artifacts, temporary databases, a scratch branch of a hosted dev database) on the way to a final published result
trigger: use this when designing an ingestion pipeline (asset sourcing, catalog backfill, media processing) that creates any intermediate/scratch artifact outside the final published output
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (owner-stated) — ingestion skills must delete, at the end of the run, all working material: raw and edited photos, build artifacts, temporary databases, and a scratch branch of the hosted dev database (Neon) — so the pipeline does not slowly fill the disk (or accumulate stale cloud branches) run after run"
provenance: owner-stated
created: 2026-10-25
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0464]
---

**Situation:** an ingestion pipeline (sourcing and processing catalog media/data) created several kinds
of intermediate artifacts on its way to a final published result: raw and edited photo files, scratch
build artifacts, a temporary database, and a disposable branch of a hosted dev-database service. None of
these were needed once the run finished successfully, but nothing in the pipeline removed them.

**Lesson:** an ingestion/backfill pipeline's "done" state is not just "the final data is published" — it
also includes "every scratch resource created along the way is gone". Left unaddressed, this class of
leftover compounds silently: local disk fills up with raw/edited photo material and build artifacts run
after run, and a hosted service (a dev-branch-per-run pattern) accumulates stale, never-deleted branches
that keep consuming quota. This is the batch/ingestion-pipeline analogue of LESSON-0464's e2e-fixture
cleanup discipline: ephemeral resources this run created are this run's responsibility to remove,
regardless of whether they live on local disk or in a remote service.

**Apply next time:** any ingestion/backfill skill or pipeline must end its run (success or failure) by
deleting every intermediate artifact it created that is not the final published output — local scratch
files/photos/artifacts, temporary local databases, AND any disposable remote resource (a scratch branch
of a hosted database, a temp bucket/folder) — not just the local filesystem. Design this cleanup as an
explicit, unconditional final step of the pipeline, not an afterthought left to manual housekeeping.
