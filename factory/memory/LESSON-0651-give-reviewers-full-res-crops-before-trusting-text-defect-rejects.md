---
id: LESSON-0651
type: gotcha
domain: image-review
tags: [image-quality, downscale, text-legibility, reviewer, false-reject]
context: a photo/image reviewer (human or AI) judging small printed text/logos on a downscaled review sheet (e.g. a 960px contact sheet of multiple photos)
trigger: use this when a reviewer rejects an image for a text-alteration/misprint defect found on a downscaled review sheet, before accepting that rejection as evidence the defect is real
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-07 (agent-inferred): a review pass on a 960px sheet misread a small AI-rendered '!' as 'I' (reading POP! as POPI); full-size band crops of the same region showed the text was actually correct"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0069]
---

**Situation:** a reviewer judged a batch of images via a shared, downscaled contact-sheet view (960px
total width across multiple photos). It flagged a text-alteration defect (reading a product's printed
logo incorrectly) that, on closer inspection via a full-resolution crop of just that region, turned out to
be a misreading caused by the downscale — the actual printed text was correct.

**Lesson:** small printed text/logos are exactly the kind of fine detail a shared contact-sheet downscale
destroys first — a reviewer (human or AI) looking at the downscaled sheet is working from degraded
evidence for text legibility specifically, even when the sheet is perfectly adequate for judging
composition, color, or cropping. A reject based on misread small text is a reviewer-tooling artifact, not
necessarily a real content defect, and treating it as ground truth without checking the source resolution
risks false-rejecting correct images.

**Apply next time:** before trusting (or acting on) a reviewer's text-alteration/misprint finding that
came from a downscaled multi-image sheet, pull a full-resolution crop of just that region and re-check —
don't resolve the finding from the sheet alone. If a review workflow routinely judges small print, give
reviewers full-res crops of that region as the input for that specific judgment, rather than relying on the
same downscaled sheet used for everything else.
