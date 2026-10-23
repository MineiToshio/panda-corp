---
id: LESSON-0517
type: gotcha
domain: quality-assurance
tags: [qa-sheet, caching, staleness, pixel-diff, asset-pipeline, review-artifact]
context: a per-group QA/review sheet generated from a batch of derived assets (e.g. processed image tiles), after the underlying source assets are reprocessed under the same identity/URL
trigger: use this when deciding whether a previously generated QA/review sheet still reflects current assets, after any batch reprocessing step that can change asset content without changing its identity/URL
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-23 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** QA sheets generated per family/group from rendered asset tiles were not regenerated after
the underlying assets were reprocessed (same URL, new content). The QA sheet kept scoring the OLD tile
images, silently reviewing content that no longer matched what was actually being served.

**Lesson:** a derived review artifact (a QA sheet, a visual baseline, a rendered preview) built from a
snapshot of assets has no built-in way to know its source was reprocessed later under the SAME identity —
identity-based staleness checks ("same URL/key, so still valid") miss a same-key content change entirely,
since nothing about the key itself changed.

**Apply next time:** after any batch asset-reprocessing step, either regenerate every QA/review sheet that
depends on the reprocessed assets as part of the same step, or verify tile-to-original correspondence via
a pixel/content diff before trusting an existing sheet's scores — never assume a same-key review artifact
is still valid just because its generation timestamp predates the reprocessing you forgot to check for.
