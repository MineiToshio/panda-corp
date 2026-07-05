---
id: LESSON-0049
type: gotcha
domain: web-performance
tags: [image-optimization, png, pngquant, next-image, ui-screenshots]
context: optimizing UI screenshots (containing gradients and/or text) for file size before shipping them as static assets
trigger: use this when about to reduce a UI screenshot's file size with a palette-reducing tool (pngquant, `magick -colors 256`) before shipping it
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — owner spotted the pixelation (owner-stated)"
provenance: owner-stated
created: 2026-07-04
status: candidate
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** UI screenshots optimized to a 256-colour palette (pngquant / `magick -colors 256`) came
out visibly banded on gradients and pixelated on text. The owner spotted the degradation immediately.

**Lesson:** palette-reduction (256-colour PNG) is a lossy transform that is visually acceptable for flat
illustrations/icons but destroys quality on UI screenshots, which typically contain smooth gradients
and small anti-aliased text — both render poorly with a reduced palette. Since `next/image` (and similar
image pipelines) re-optimize/re-encode images on serve anyway, pre-shrinking the source with a
palette-reduction tool trades away quality for a file-size win the pipeline would have captured anyway.

**Apply next time:** keep UI screenshots as 24-bit (full-colour) PNG source files; do not run
palette-reduction optimizers on them. Prioritize visual quality over source file size when the serving
pipeline already re-optimizes on delivery.
