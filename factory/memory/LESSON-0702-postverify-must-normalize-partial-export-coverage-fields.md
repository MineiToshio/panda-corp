---
id: LESSON-0702
type: anti-pattern
domain: data-verification
tags: [postverify, partial-export, coverage, timestamp-comparison, normalization]
context: a postverify/consistency check compares a timestamp or coverage field across records where that field is populated only for the subset of records a given run actually exported, and some records are genuinely partial/unexported by that run
trigger: use this when designing or debugging a postverify/consistency check that compares an authorized snapshot against freshly-published data, and the compared field (a coverage date, a "last checked" timestamp) is only ever stamped on items a given pass actually touched
source: "funko-tracker .pandacorp/run/lessons.md, 2026-11-20 (agent-inferred): postverify compared the authorized snapshot against export-time coverage dates stamped on partial (unexported) cells, so every partial sweep failed postverify after a correct publish; fixed by normalizing with prepareCatalogCoverage — commit 2d4db802 'fix(ingest): postverify compares only exported coverage dates'"
provenance: agent-inferred
created: 2026-11-20
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0078, LESSON-0637]
---

**Situation:** a catalog's postverify step compared an authorized snapshot's coverage state against the
live, just-published data. The compared field — an export-time coverage date — is stamped only on cells a
given sweep actually exported; cells a *partial* sweep legitimately left untouched carry no fresh
coverage date at all. Postverify treated every one of those untouched (not-yet-exported) cells as drift
from the authorized snapshot, so every partial sweep failed postverify even when the publish itself was
entirely correct.

**Lesson:** a verification step that compares two "snapshots in time" of the same dataset must first
normalize for fields whose presence/value legitimately depends on HOW MUCH of the run was actually
exported — "this cell has no coverage date yet" and "this cell's coverage date regressed" are different
facts, and a naive field-by-field diff conflates them into the same false-positive. This generalizes the
`[]`-vs-`unreadable` distinction (LESSON-0078/constitution §24): a verification boundary must distinguish
"legitimately not yet populated by a partial pass" from "actually wrong," not silently treat every partial
result as a failure.

**Apply next time:** before comparing a field across two snapshots of a dataset that can be partially
updated, write a normalization step (e.g. `prepareCatalogCoverage`-style) that scopes the comparison to
only the records/cells the current run actually touched, or explicitly excludes fields known to be
unpopulated-by-design outside that scope — then diff. A postverify/consistency check failing on every
partial run, while passing on full runs, is itself the signal that the comparison isn't normalized for
partial coverage.
