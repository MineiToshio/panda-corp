---
id: LESSON-0577
type: gotcha
domain: data-pipeline
tags: [ingestion, dry-run, plan-apply, file-order, idempotency]
context: a two-phase ingestion pipeline where a dry-run "plan" step and a mutating "apply" step both resolve relationships between records defined across multiple input files
trigger: use this when a "plan" (dry-run) step and an "apply" (mutating) step of an ingestion pipeline can disagree about a record's status because they resolve cross-file/cross-record references in different orders
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-30 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** in funko-tracker's catalog ingestion, `ingest:plan` marked a variant whose `variantRoot`
lives in the SAME input file as `unsupported_claim`, reasoning the root was "not yet published" at plan
time. `ingest:apply`, which processes records in literal file order, actually resolves that root earlier
in the same pass, so the variant applies cleanly — `plan`'s `needsDecision` flag overstated how many
holds were real, and conversely a same-file `possible_duplicate` can surface only once `apply` actually
runs, invisible at plan time.

**Lesson:** a "plan" phase that evaluates records independently of the order "apply" will actually use
produces a systematically different — and potentially misleading — picture of what needs a decision than
what will actually happen at apply time. The two phases must either resolve cross-references in the
identical order, or the plan output must explicitly caveat which flags are provisional (order-dependent)
versus firm.

**Apply next time:** when building a plan/apply split for any ingestion or migration pipeline with
cross-record dependencies inside the same input batch, make the plan phase walk records in the EXACT
same order apply will use — or, if that is too expensive, label plan-time holds explicitly as
"provisional, re-check after this batch's own earlier records resolve" rather than presenting them as
final `needsDecision` holds.
