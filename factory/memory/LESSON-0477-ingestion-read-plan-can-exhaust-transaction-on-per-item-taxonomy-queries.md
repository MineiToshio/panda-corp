---
id: LESSON-0477
type: gotcha
domain: data-ingestion
tags: [transaction, batch-read, taxonomy, large-file, ingestion, locks]
context: a data-ingestion plan that reads/classifies many items by repeatedly querying a shared taxonomy table once per item, inside a long-running transaction
trigger: use this when designing or testing an ingestion/read plan that performs a per-item lookup (taxonomy, classification, reference data) and may run against a real large input file
provenance: agent-inferred
source: "funko-tracker .ops/2026-10-20-one-piece/ingest-error-audit.md (agent-inferred)"
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an ingestion read plan queried the taxonomy table once PER ITEM to classify each piece.
Against a small sample this looked fine, but a real large input file multiplied those repeated
queries enough to exhaust the transaction's own budget (timeout/resource limit) before finishing.
Measuring query counts against the real large file (not a small sample) exposed the problem, and the
fix was to batch/group the taxonomy reads within the read plan itself, keeping the ingestion's overall
query-count limit — explicitly without reusing cached taxonomy data during the later publication step
while it holds locks (reuse there risks acting on stale data under lock).

**Lesson:** a per-item repeated-query pattern that looks harmless on a small sample can silently scale
into transaction-exhausting territory on a real large file; small-sample testing does not reveal this
class of defect. Caching/batching strategies that are safe during a READ-ONLY planning phase are not
automatically safe during a locked publication/write phase, where stale cached data could be acted on.

**Apply next time:** measure an ingestion plan's actual query count against a REAL large input file,
not a handful of samples, before trusting its transaction behavior. Batch/group per-item reference
lookups (taxonomy, classification) within the read-only planning step to keep a bounded query count,
but do not carry that same cache into a later publication/write step that holds locks — re-fetch fresh
there instead.
