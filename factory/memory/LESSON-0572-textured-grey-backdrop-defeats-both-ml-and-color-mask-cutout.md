---
id: LESSON-0572
type: gotcha
domain: image-processing
tags: [background-removal, computer-vision, color-mask, chroma-key, product-photography]
context: removing the background from product renders of a physical collectible shot against a textured studio backdrop
trigger: use this when an automated background-removal step (an ML segmentation model or a color/chroma mask) fails or degrades specifically on images with a hatched/textured grey studio backdrop
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-30 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-31
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** funko.com/kinder.com product renders use a hatched (textured, not flat) grey studio
backdrop. Both an ML-based segmentation model (Apple Vision's foreground/subject mask) and a simple
color-threshold/chroma mask failed to cleanly separate the figure from this backdrop.

**Lesson:** a hatched/textured grey backdrop defeats BOTH of the two common cheap background-removal
approaches, for a DIFFERENT reason each: an ML segmentation model trained mostly on flat/solid or
natural backgrounds misreads the hatching's internal edges as foreground detail; a color/threshold mask
fails because the hatching is not one uniform color — its internal contrast straddles any single
color/luminance cutoff. Neither failure is fixed by tuning the other approach's parameters, because the
root cause differs between the two.

**Apply next time:** for a textured/hatched studio backdrop, don't just re-tune one approach — either
pick an ML mask explicitly suited to textured/patterned backgrounds, or fall back to hand-drawn polygon
masks per shot. Validate whichever approach you pick against BOTH a dark-figure-on-grey and a
light-figure-on-grey sample before trusting it across a whole catalog — the two color regimes can fail
independently.
