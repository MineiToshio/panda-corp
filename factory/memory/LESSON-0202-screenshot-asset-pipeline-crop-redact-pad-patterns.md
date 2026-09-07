---
id: LESSON-0202
type: pattern
domain: content-generation
tags: [imagemagick, screenshot, crop, redaction, aspect-ratio, portfolio]
context: preparing real product screenshots (not design mocks) or a personal photo for a public portfolio/case-study page — cropping to a target aspect ratio, redacting sensitive on-screen text, fixing a tight headroom crop
trigger: use this when preparing product screenshots or a personal photo for a public-facing case study or portfolio page (cropping to a target aspect ratio, hiding sensitive on-screen text, or fixing a tight-headroom crop)
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-0x (agent-inferred) — case-study asset pass"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0042, LESSON-0046, LESSON-0049]
---

**Situation:** a batch of real product screenshots (and one personal photo) needed preparation for a
public case-study page: cropping retina captures to 16:9, hiding sensitive on-screen text, and fixing a
too-tight avatar crop. Several distinct techniques emerged from the same asset pass:

1. **Crop-anchor verdict:** `magick <src> -gravity north -crop <W>x<H>+0+0 +repage -resize 1920x1080
   -strip -quality 82 out.webp` for retina app screenshots. Retina captures land near a 1.755 ratio
   (~3024x1720), not 16:9 (1.778); a plain resize distorts, a centre crop eats the app header — anchoring
   the crop at `north` trims only the empty bottom chrome. Result: 392-520KB PNG → 64-82KB WebP at
   1920x1080, text still legible.
2. **Redaction pattern:** an in-image REPLACEMENT reads better than a blur. Paint the panel background
   over the sensitive run at source resolution (`-draw "rectangle ..."`) and re-render a same-length
   neutral string in the sampled text colour (`-annotate`), picking pointsize by comparing 2-3 candidates
   against untouched text on the same line, then push through the normal pipeline. Blurring advertises
   that something was hidden; a matched replacement keeps the surface reading as a real product.
3. **Aspect-ratio padding pattern:** when a screenshot's native ratio is far from the target and a
   straight crop would bisect a UI element (a chat composer, a floating button), crop just ABOVE that
   element, then pad back to the exact ratio by replicating a clean background ROW across the full width
   (`\( src -crop Wx1+0+ROW +repage -resize WxPAD! \) -append`). Column-wise row replication preserves
   multi-colour layouts (grey sidebar + white content) with no seam, unlike a flat fill. Pick the
   replication row well ABOVE the crop line — the row immediately under a removed element usually carries
   its drop shadow and leaves a visible band.
4. **Crop-axis gotcha:** cropping WIDTH to reach a target ratio is not automatically safer than cropping
   HEIGHT — on one set of captures, trimming ~90px off the right sliced a floating "Share" button in half,
   while the same 90px looked like empty scrollbar gutter in the thumbnail. Always inspect the trimmed
   strip on both axes before committing.
5. **Crop-as-privacy pattern:** a crop line chosen for layout reasons can double as a privacy pass —
   cropping above an app sidebar's account footer removed the owner's own email from four captures with
   no separate redaction step. Check where account/identity chrome sits in the frame BEFORE reaching for
   a paint-over.
6. **Avatar retouch technique:** retouching a photo for a circular avatar crop when the original leaves no
   air above the head — extend the canvas upward with a mirrored, blurred strip of the background
   (invisible if the background is already out of focus) to give real margin for framing, instead of
   cropping the head against the circle's edge.

**Lesson:** preparing a real screenshot/photo for public display is its own small pipeline with recurring,
non-obvious decision points (anchor, axis, redaction method, padding method) — none of them are safe to
default without inspecting the actual crop.

**Apply next time:** pick the crop anchor/axis by inspecting the trimmed strip on both axes, redact via
matched replacement rather than blur, pad short axes by row-replicating a clean background band rather
than flat-filling, and check whether the crop line can double as a privacy pass before adding a separate
redaction step.
