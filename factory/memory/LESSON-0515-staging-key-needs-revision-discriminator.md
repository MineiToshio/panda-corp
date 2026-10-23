---
id: LESSON-0515
type: gotcha
domain: data-ingestion
tags: [idempotency, staging, upsert, revision, dedup-key, re-ingest]
context: a data-ingestion/staging pipeline that dedups incoming records by an identity key, re-run against a source whose content can change between runs
trigger: use this when designing or debugging a staging/dedup table keyed by an identity string, and a record needs to be re-ingested after its source content changed
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-23 (agent-inferred) — re-ingesting an already-staged item key without bumping its revision discriminator caused the staging write to reuse the existing (key, revision) row and its OLD proposed data instead of the freshly observed content"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a staging/candidate table was keyed by (identity-key, revision). Re-running ingestion
against a record whose source content had changed, but reusing the SAME revision value, caused the
staging write to match the existing row and silently keep its old proposed data instead of capturing what
was freshly observed this time.

**Lesson:** an identity key alone is not enough to make a staging/upsert write idempotent-but-fresh when
the underlying source can change between ingestion attempts. Without an explicit revision/version axis in
the key, "re-ingest the same item" and "re-ingest the same item with new content" are indistinguishable to
the storage layer, and the write silently collapses onto the stale row rather than erroring or refreshing.

**Apply next time:** when a staging/dedup key can be re-submitted against changed source content, make the
key's uniqueness include an explicit, freshly-generated revision/version component (a date-stamped or
monotonic discriminator) for every re-ingestion attempt meant to be treated as new evidence — never rely
on the identity key alone to trigger a refresh. Separately: when matching a record with ambiguous/missing
disambiguating metadata (e.g. an empty variant tag) against an existing item that already has a close
match on another axis, confirm the mapping against the originally observed source before accepting an
"ambiguous identity" default resolution.
