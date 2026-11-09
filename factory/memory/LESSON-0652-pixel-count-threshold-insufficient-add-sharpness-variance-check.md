---
id: LESSON-0652
type: anti-pattern
domain: image-quality
tags: [image-quality-gate, sharpness, laplacian-variance, upscale, resolution-check]
context: an automated photo-quality gate that accepts/rejects a source image based on a pixel-dimension threshold (e.g. "reject if narrower than 800px")
trigger: use this when a quality gate's only resolution check is a pixel-dimension threshold, before trusting that threshold to catch blurry or upscaled sources
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (agent-inferred): an 800px pixel-count rule passed sources that had been upscaled by their own retailer site (e.g. a 1400-1600px image that was originally much smaller) and looked visibly blurry; proposed fix is a sharpness threshold via Laplacian-variance at 800px (around >=2400) added to the photo quality check"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a photo-quality gate rejected sources below ~800px wide, on the theory that a wider image
is a sharper/more usable image. Several sources from different retailer sites passed the pixel-count
check at 1400-1600px wide while being visibly blurry — the retailer itself had upscaled a smaller original
to that pixel count, so the dimension was high but the actual detail/sharpness was not.

**Lesson:** pixel count measures resolution (how many pixels), not detail (how much real information is
packed into them) — a naively upscaled source can satisfy any pixel-dimension threshold while carrying no
more real detail than its smaller original. A quality gate built only on pixel count systematically
misses this class of defect, because the two properties (count vs. sharpness) are independent: an image
can be simultaneously "wide enough" and "blurry."

**Apply next time:** pair any pixel-dimension quality threshold with an actual sharpness/detail check — a
Laplacian-variance measurement (computed at the same reference width, e.g. 800px, so scores are
comparable) is a cheap, deterministic way to catch an upscaled-but-blurry source that a pixel-count check
alone would accept; calibrate the variance cutoff (roughly >=2400 at 800px observed as a working threshold
on real sources) against known-sharp and known-blurry samples for the specific domain before relying on
it.
