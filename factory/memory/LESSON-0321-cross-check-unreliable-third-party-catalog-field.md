---
id: LESSON-0321
type: gotcha
domain: data-ingestion
tags: [third-party-data, scraped-catalog, cross-check, classification]
context: classifying/grouping catalog items using a single structured field sourced from one third-party aggregator/listing site
trigger: use this when a classification or grouping decision (size, category, format) is about to be derived from a single structured field on one third-party catalog/aggregator site, rather than the manufacturer's own listing or multiple independent sources
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred, owner caught it): a third-party collectibles-listing aggregator's per-item \"Size\" field was internally inconsistent with how the item is actually sold/labeled (one item's aggregator field said one size class while the manufacturer and multiple retailer listings agreed on a different one), which had already driven a wrong classification decision until the owner flagged it"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a structured per-item field from a single third-party aggregator/listing site (not the
manufacturer) was used to drive a catalog classification decision. The field turned out to be
unreliable for at least one item — it disagreed with the manufacturer's own listing and with how
retailers actually sell/label the item — and the wrong classification had already propagated before
being caught.

**Lesson:** a single structured field scraped or aggregated from one third-party source is not
authoritative just because it is structured and looks machine-readable; aggregator sites can carry
stale, miscategorized or inconsistent per-item metadata. Treating one such field as ground truth for a
classification decision risks silently wrong data that only surfaces when someone familiar with the
real product notices the mismatch.

**Apply next time:** when a classification/grouping decision depends on a single field from a
third-party aggregator, cross-check it against the manufacturer's own listing, product photos/box
text, or at least one independent retailer listing before trusting it — especially for any field whose
wrong value would misclassify the item into a visibly different group.
