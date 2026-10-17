---
id: LESSON-0385
type: pattern
domain: ui-design
tags: [carousel, slider, indicator, affordance]
context: designing the "more photos"/multi-slide position indicator on a card or detail view
trigger: use this when designing a carousel/image-slider position indicator and a filled pill, ring, or short hairline mark is the default choice
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated); also recorded as this project's own decision in .pandacorp/comms/iteration.md Ronda 27"
provenance: owner-stated
created: 2026-10-17
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a card/detail view with multiple photos needed a position indicator signaling "more
photos exist, you're on slide N". A filled pill+ring and short hairline marks were both tried and
rejected by the owner.

**Lesson:** a carousel position indicator that is bold enough to read as a deliberate UI element
(a filled pill with a ring, or a short hairline) visually reads as a phone notch/camera cutout
sitting on top of the photo, not as navigation chrome — it competes with the photo instead of
annotating it. The indicator should be the LEAST noticeable mark that still legibly signals "more
photos": small, equal-size dots (roughly 6px), placed in the same spot on every device.

**Apply next time:** default a multi-photo position indicator to small, uniform dots at a fixed,
consistent position across breakpoints; avoid filled pills, rings, or hairline marks that read as a
device notch sitting on the image.
