---
id: LESSON-0319
type: pattern
domain: ui-accessibility
tags: [collection-grid, owned-state, saturation, a11y, non-color-cue]
context: encoding a binary membership/completion state (owned vs not-owned, done vs not-done, included vs excluded) for each item in a visual grid/card layout
trigger: use this when designing how a grid/card UI should show a per-item binary state (owned/not-owned, complete/incomplete, active/inactive) and a check-badge icon feels heavy or a plain color-only treatment is being considered
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated): the owner preferred encoding \"owned\" via a full-colour image plus an accent frame, and \"not owned\" via a desaturated/muted image (saturate/sepia/contrast/brightness filter stack), over a check badge — with an explicit requirement to also keep a non-colour cue for accessibility"
provenance: owner-stated
created: 2026-10-15
status: active
promotion: none
confidence: medium
times_applied: 1
applied_in: [funko-tracker]
links: [LESSON-0309]
---

**Situation:** a collection grid needed to show, per item, whether it is owned/collected or not. A
check badge was one option; the chosen approach instead desaturates/mutes the image for the
not-owned state and shows the image at full color plus an accent frame for the owned state — explicitly
paired with a non-color cue so the distinction still reads for color-vision-deficient users (WCAG
1.4.1, use of color is not the only visual means of conveying information).

**Lesson:** for a photo/image-heavy grid, encoding a binary state through image treatment (full-color +
accent frame vs. desaturated/muted) reads as more integrated with the content than a separate badge
icon, and avoids adding visual clutter across a dense grid — but color/saturation alone is not an
accessible channel on its own and needs a second, non-color cue (a border style, an icon, a label) to
carry the same distinction.

**Apply next time:** when a grid/card UI needs to show a binary owned/complete/active-type state per
item, prefer encoding it through the item's own visual treatment (saturation + an accent frame) over a
separate badge if that fits the content — but always pair it with a non-color cue so the state remains
distinguishable without relying on color perception.
