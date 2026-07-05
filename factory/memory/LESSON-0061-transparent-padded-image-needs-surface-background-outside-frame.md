---
id: LESSON-0061
type: pattern
domain: ui-components
tags: [lightbox, modal, transparent-padding, design-tokens, composited-image]
context: displaying a composited image with transparent breathing-room padding inside both a framed container (e.g. MediaFrame) and a frameless modal (e.g. Lightbox)
trigger: use this when a composited image with transparent padding needs to render correctly both inside a framed card/component and inside a frameless modal/lightbox
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — owner spotted it"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a composited image with transparent breathing-room padding looked correct inside a
MediaFrame component (the frame's own surface color showed through the transparent padding) but
appeared to float incorrectly on the bare page backdrop when the same image was shown inside a
frameless Lightbox modal.

**Lesson:** transparent padding baked into a composited image is not self-contained — its correctness
depends on whatever background happens to sit behind it. A framed container supplies that background
implicitly; a frameless modal does not, so the same asset looks broken in one context and fine in the
other, even though the image itself never changed.

**Apply next time:** give the frameless display context (e.g. `.lightbox-img`'s container) an explicit
background using the design system's surface token (e.g. `var(--color-surface)`) so it matches the
framed context, rather than assuming a transparently-padded image is safe to render on any backdrop.
