---
id: LESSON-0571
type: pattern
domain: media-pipeline
tags: [review-ux, media-pipeline, perceived-completeness, qa]
context: a final owner-facing review screen that aggregates per-item media while a multi-step edit pipeline (background removal, framing, min-size enforcement) is still catching up on some items
trigger: use this when building a review/approval screen that shows per-item media sourced through a multi-step edit pipeline and some items may still be mid-pipeline
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-30 (owner-stated)"
provenance: owner-stated
created: 2026-10-31
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0326]
---

**Situation:** funko-tracker's final review screen showed an "all pieces" section mixing unedited
originals (not yet background-removed/framed/resized) alongside fully-edited images, for items still
mid-way through the edit pipeline.

**Lesson:** to an owner reviewing a batch, an unedited original sitting next to finished images doesn't
read as "still processing" — it reads as unfinished or broken work, even though the pipeline is
legitimately still running. A review surface must not conflate "an image exists for this item" with
"this item is ready to review." This is the same family as LESSON-0326 (a stale/raw state shown during
a pending gate erodes trust that any work happened), one layer down at the per-item media-pipeline
granularity rather than a whole publish gate.

**Apply next time:** gate an item's appearance in a final review view on its edit pipeline having
FULLY completed (background removed + framed + min size met), not merely on the item having any image
at all; show a distinct pending/in-progress state (or omit the item entirely) for anything still
mid-pipeline, instead of surfacing the raw original next to finished work.
