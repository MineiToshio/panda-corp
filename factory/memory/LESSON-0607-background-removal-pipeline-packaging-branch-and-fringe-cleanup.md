---
id: LESSON-0607
type: gotcha
domain: image-processing
tags: [background-removal, apple-vision, codex, imagegen, masking, catalog-photography]
context: an automated background-removal/upscale pipeline run in batch over per-item product photography (boxed and loose), using a vision-based remover (e.g. Apple Vision) and a generative imagegen worker (e.g. Codex) for upscaling
trigger: use this when building or debugging a batch background-removal pipeline for product/collectible photography that includes BOTH boxed (box photographed against a background) and loose (out-of-box) items
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-03/2026-11-04 (agent-inferred + owner-stated): Apple Vision removeBg picks the figure inside a white box photographed on a white background instead of the box, and strips the white teeth of loose figures; a Codex 'faithful' upscale pass can leave stray strokes outside the product that inflate a convex-hull mask; a batch removeBg run that did not branch on packaging and did not merge an item's instances before processing broke 289/568 views on a real catalog (owner-stated: 'the process must be fixed, not just reported')"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0570, LESSON-0552]
---

**Situation:** a batch pipeline removes backgrounds from per-item catalog photography (some items boxed,
some loose) and, when a source photo is too low-resolution, runs it through a generative "faithful
upscale" pass before masking. Run uniformly across a real catalog, it broke 289/568 views (boxes erased,
accessories lost) before a fidelity review caught it.

**Lesson:** this pipeline has (at least) three distinct, independently-triggerable failure modes, not one:
1. A vision-based background remover (Apple Vision or similar) asked to strip a WHITE box photographed
   against a WHITE background instead segments the figure VISIBLE INSIDE the box's window (wrong subject),
   and on a LOOSE figure it strips the figure's own white details (teeth, white accessories) along with
   the background — the same "foreground vs background" heuristic fails in opposite ways depending on
   packaging.
2. A generative "faithful upscale" pass (Codex imagegen or similar) can leave stray strokes/lines outside
   the actual product (e.g. a loose line hovering above a box) that were not visually obvious pre-upscale;
   if the next step builds a convex-hull mask from non-white pixels, that stray content inflates the hull
   and corrupts the mask.
3. Applying ONE uniform removeBg pass to an item's photo set without (a) branching behavior on
   boxed-vs-loose packaging and (b) merging/considering all instances of that item together produces
   mass, hard-to-spot corruption (missing boxes, missing accessories) at batch scale — only caught by an
   explicit visual fidelity review, not by the pipeline itself.

**Apply next time:** when building/debugging this class of pipeline: branch the masking strategy on
packaging BEFORE running removeBg — boxed items need a convex-hull mask of non-white pixels (never trust
the vision remover's own subject segmentation on a white-box/white-background photo); loose items need the
background flood-filled from the original white, then the mask edge unpremultiplied against white to
remove the 1-2px fringe. Before trusting a convex-hull mask built after a generative upscale pass, visually
inspect for stray strokes/lines the upscale invented outside the product and clean them before masking.
Never run the batch pass as a single undifferentiated step across an item's whole photo set — merge/review
all instances of an item together, and treat a batch run's output as needing an explicit before/after
fidelity check, not a "ran without erroring" success signal.
