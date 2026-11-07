---
id: LESSON-0626
type: gotcha
domain: image-processing
tags: [cropping, verticality, catalog-photography, image-review-qa]
context: cropping an individual item's photo out of a wider photo that contains multiple items (a
  display shelf, a diorama, a group shot), for use as that item's own standalone catalog image
trigger: use this when generating or reviewing a cropped sub-image of one item taken from a wider
  multi-item photo — before publishing it as that item's own standalone view
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-05 (agent-inferred, Naruto batch): figures
  cropped out of display/group photos inherited the source photo's own ~18 degree camera tilt; the
  project's image-review gate had no check for it"
provenance: agent-inferred
created: 2026-11-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0621]
---

**Situation:** individual figures were cropped out of a wider photo of a multi-item display/diorama to
produce each figure's own standalone catalog image. The crops inherited the source photo's own camera
tilt (roughly 18 degrees off vertical) — the crop itself was correct, but the resulting standalone image
looked visibly skewed, because nothing in the crop step corrected for the angle the ORIGINAL wide shot
was taken at.

**Lesson:** cropping a region out of a tilted photo does not remove the tilt — it only changes the
frame, so the tilt becomes more visible once there's no surrounding context (shelf edges, floor lines) to
read it as "the camera was angled" rather than "the item is crooked." This is invisible to a check that
only validates the crop boundaries (does it contain the right item, is it the right size) — it needs an
explicit measurement of the item's own vertical/longitudinal axis against true vertical.

**Apply next time:** when cropping an item's standalone image out of a wider multi-item photo, measure
the item's own axis (its base, its spine, a known-vertical edge) against true vertical before accepting
the crop; straighten on an enlarged canvas (crop wider than the final frame, rotate, then re-crop to
final size) rather than rotating the already-tight crop, which loses corners. An image-review gate for
this class of crop needs an explicit verticality/axis check as one of its deterministic checks (alongside
the duplicate/mismatch/cutoff/resolution checks in LESSON-0621) — an LLM/human pass reliably misses a
modest tilt the same way it misses those other defect classes.
