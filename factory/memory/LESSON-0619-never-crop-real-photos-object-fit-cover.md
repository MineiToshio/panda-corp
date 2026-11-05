---
id: LESSON-0619
type: gotcha
domain: image-display
tags: [object-fit, cropping, photos, catalog-apps, css]
context: "displaying a real (non-placeholder) product/collectible photo in a grid, card, or review artifact where a CSS sizing rule (object-fit: cover, or any other clipping container) could cut off part of the actual photographed content"
trigger: use this when building or reviewing a UI/review artifact that displays real sourced photos in fixed-size cells — check the image sizing rule before accepting the layout
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-04 (owner-stated): a review-HTML redesign incident also cropped real photos via a cover-style fit; the owner's correction stated photos must never be cropped"
provenance: owner-stated
created: 2026-11-05
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0329, LESSON-0603]
---

**Situation:** a review-HTML artifact displaying real sourced product photos used a clipping fit rule
(`object-fit: cover` or equivalent) inside fixed-size cells, cutting off part of the actual photographed
content (e.g. the top/edges of a figure or box). The owner explicitly flagged that photos must never be
cropped.

**Lesson:** unlike a placeholder/silhouette, where cropping is a design choice (LESSON-0329), a REAL
sourced photo is evidence being reviewed for fidelity/completeness (LESSON-0603) — clipping any part of
it is a correctness defect, not a style preference: a cropped product photo can hide the exact details
(box damage, missing accessory, cut-off packaging) the review exists to catch. `object-fit: cover` and
any other fit-and-clip rule silently discards content with no error signal, so this defect is easy to
ship and easy to miss in a quick visual pass.

**Apply next time:** for any grid/card/review surface that displays a REAL sourced photo (not a design
placeholder), use a non-clipping fit (`object-fit: contain`, or a container sized to the image's own
aspect ratio) so the full photographed content is always visible, even if that means uneven cell
proportions. Treat "the photo got cropped" as a review-blocking defect, not a cosmetic nit — if cell
uniformity matters, solve it with letterboxing/padding, never by clipping real photographic evidence.
