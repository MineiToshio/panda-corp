---
id: LESSON-0516
type: gotcha
domain: image-processing
tags: [color-sampling, alpha-channel, median, background-detection, transparency]
context: computing a representative background color for a photo asset by sampling the median color of its border/edge pixels, when the source image has a transparent padding/border around an opaque photo
trigger: use this when deriving a background/fill color by sampling border pixels of a source image, before trusting the result on images that may have transparent padding
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-23 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0338]
---

**Situation:** a background-color detector sampled the median RGB of a photo's border pixels to pick a
representative fill/background color. On images with a transparent border around an opaque photo, the RGB
channel of fully-transparent (alpha=0) pixels defaulted to near-black, and the median pulled toward that
false dark value instead of the actual visible background color.

**Lesson:** a pixel's RGB value is meaningless at alpha=0 (and unreliable at low alpha) — most image
codecs/libraries don't guarantee any particular RGB for a transparent pixel, commonly defaulting to black.
Any color-sampling algorithm (median, average, dominant-color) that reads RGB without checking alpha first
will be silently biased toward that filler value whenever the source has transparent regions.

**Apply next time:** before sampling border/region pixels for a representative color, filter to pixels
with alpha above a threshold (e.g. alpha >= 128) and compute the median/average only over those; if every
sampled pixel falls below the threshold, treat the border as "fully transparent, no background signal"
rather than defaulting to whatever color the transparent pixels happen to carry. See LESSON-0338 for the
sibling trap of defaulting transparent pixels to black when FLATTENING (PNG→JPEG) rather than sampling.
