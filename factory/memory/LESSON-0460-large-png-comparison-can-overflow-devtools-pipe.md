---
id: LESSON-0460
type: problem-solution
domain: visual-testing
tags: [png, devtools, playwright, image-diff, lossless, memory]
context: comparing very large rendered images through a browser's DevTools transport
trigger: use this when a large PNG was rendered to disk but the visual comparator loses its browser connection during image transfer
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-21; commit 47a86b8 scripts/fidelity/poster.mjs; reviewer .pandacorp/run/review-local-fidelity-poster-focused.log and review-local-fidelity-poster-all-bands.log 2026-10-20"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0047, LESSON-0435]
---

**Situation:** the poster renderer produced the one-sheet image and five part images, but the
comparison tool passed a whole PNG as base64 through `page.evaluate`. Chromium closed its DevTools
pipe with `Too large read data is pending` at its 100 MiB buffer cap. A focused comparison instead
used Sharp to extract the comparator's existing 6000-pixel bands and transferred one band at a time.
It completed all six image comparisons and still reported real size and pixel-difference failures.

**Lesson:** a visual gate can lose its transport after the product has rendered successfully.
Conflating that crash with a renderer failure sends the repair to the wrong layer. Bounding the
transfer need not weaken the oracle if band geometry, masks, pixel threshold, and failure reporting
remain identical.

**Apply next time:** verify the output files first, inspect the browser transport error, and move
lossless extraction to the host before sending bounded chunks to the comparator. Preserve the exact
frozen geometry and compare every chunk; report actual visual mismatches separately from transport
failure.
