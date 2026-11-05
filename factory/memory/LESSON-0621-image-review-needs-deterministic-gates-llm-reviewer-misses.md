---
id: LESSON-0621
type: anti-pattern
domain: image-review-qa
tags: [image-review, deterministic-gates, llm-reviewer, duplicate-detection, cutoff-detection, resolution-check]
context: reviewing a batch of sourced/generated product photos for a catalog, where an LLM (vision-model) reviewer is the primary quality gate before publication
trigger: use this when designing or auditing an image-review step that relies on an LLM/vision-model reviewer as the sole gate — before trusting it alone, check for these specific defect classes with a deterministic/mechanical check instead
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-04 (owner-stated): an LLM image reviewer passed all of cross-view duplicates, loose-item views showing a box/can, cut-off/part-loss, a boxed real photo mislabeled, and sub-native resolution; a corroborating incident the same week found AI-generated box renders cropped at the top with the deterministic reviewer pass ('G3') not catching it either"
provenance: owner-stated
created: 2026-11-05
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0335, LESSON-0607, LESSON-0552]
---

**Situation:** an image-review pipeline for a product catalog relied on an LLM (vision-model) reviewer to
catch defects before publication. It passed every one of these real, present defects undetected: the same
photo reused across two different views/variants (cross-view duplicate), a "loose" item view that actually
showed its box/can, an item cut off or missing a part, a boxed studio photo mislabeled as a real/loose
photo, and an image below the catalog's native-resolution requirement. A separate incident the same week
found that even a DEDICATED deterministic review pass ("G3") missed AI-generated box renders that were
visibly cropped at the top — the specific check for that defect class was never implemented, not merely
missed by a model.

**Lesson:** this is the same structural gap as LESSON-0335's finding for text content — a holistic
review (human or LLM) answering "does this look right" is not the same check as "does this violate
invariant X", and reliably misses the second even while appearing to do a careful pass. Each of these
defect classes (duplicate detection across views, content-matches-label, cut-off/part-loss, boxed-vs-real
mislabeling, resolution floor) has a crisp, MECHANICAL test (pixel/hash comparison, edge/bounding-box
check, metadata/resolution check) that a deterministic script can run exhaustively and cheaply — but if
that check is never built, no amount of careful LLM/human prose review reliably substitutes for it,
because none of these defects impair the image's surface-level "does this look like a product photo"
plausibility.

**Apply next time:** for any image-review gate feeding a catalog/product-listing pipeline, do not rely on
an LLM/vision-model reviewer (or a human eyeballing a grid) as the sole check for: (1) cross-view/
cross-variant duplicate photos (perceptual hash comparison across the item's own view set), (2)
view-content mismatch (a "loose" view that structurally still shows packaging — e.g. box/can edge
detection), (3) cut-off/part-loss (bounding-box-vs-frame-edge check), (4) a boxed/studio photo mislabeled
as a real/loose photo, (5) sub-native or sub-threshold resolution (a plain metadata check). Build each as
an explicit, exhaustive, scriptable gate the reviewer CANNOT skip, and run it on every image before any
LLM/human pass — reserve the model/human review for judgment calls the mechanical checks can't make
(composition, authenticity, overall appeal), not for defects that have a crisp test.
