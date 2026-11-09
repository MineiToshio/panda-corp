---
id: LESSON-0645
type: anti-pattern
domain: data-matching
tags: [deduplication, catalog, variants, matcher-design]
context: a duplicate/similarity matcher that compares a batch of newly-ingested candidates against items already published in a prep/review pool, when the batch itself legitimately contains multiple distinct variants of the same base item
trigger: use this when designing or debugging a duplicate-detection matcher for a catalog/ingestion pipeline, specifically when a franchise/series with many legitimate variants (color, edition, size) runs through it for the first time
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (agent-inferred): a sealed delivery-check held 17 legitimate variants (B&W/Rage/translucent, same-name-different-numbers, a different product line) as possible_duplicate, because the matcher compared later candidates against EARLIER ones from the SAME ingested file that were already published in the prep pool — it had no supported override for that case; this was the first sealed full run of a franchise with many variants, which is what exposed the gap; fixed with a direct engine change treating intra-file similar items as new, still held against the external baseline"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a duplicate/similarity matcher flagged 17 legitimately distinct variants of a collectible
franchise (different colorways, different edition numbers, a different sub-line) as `possible_duplicate`.
The matcher's comparison set included earlier candidates from the SAME ingested file that had already
been published to the prep pool — so a later variant in the batch was compared against its own sibling
variant from the same file, which a similarity heuristic naturally scores as "very similar," and the
pipeline had no supported way to override that verdict. The bug had been latent until the first franchise
with many simultaneous variants ran through a sealed full ingest.

**Lesson:** a duplicate matcher's comparison SCOPE is as important as its similarity function —
comparing a candidate against items from its OWN source file/batch is a different, weaker signal than
comparing against an EXTERNAL baseline (prior catalog state), because same-file candidates are far more
likely to be legitimate siblings (variants) than true duplicates. A matcher tuned/tested only against
single-variant or low-variant test data can look correct for a long time and still have this gap, because
it only manifests once a batch contains several genuinely similar-but-distinct items at once.

**Apply next time:** when a catalog/ingestion matcher flags same-batch candidates as possible duplicates
of each other, treat intra-file/intra-batch similarity as a weaker signal than similarity against the
external baseline — items from the same source file should default to "new" unless they ALSO match
something in the baseline, not be compared peer-to-peer within the batch as if they were independent
catalog entries. Test any dedup matcher explicitly against a batch containing several legitimate variants
of the same base item before trusting it on a real multi-variant franchise.
