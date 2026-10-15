---
id: LESSON-0329
type: pattern
domain: ui-rendering
tags: [placeholder, silhouette, fallback, sorting, rendered-state]
context: an app that mixes real photos with a placeholder/fallback silhouette for items that don't have one yet, in the same grid/listing
trigger: use this when a UI must render a fallback placeholder silhouette alongside real photos for items lacking one, or when a "goes last"/sort-priority rule is meant to apply to items without a real photo
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated): placeholder silhouettes were originally rendered padded inside a neutral box, which made the item read as noticeably smaller/lesser than real-photo items; cropping the silhouette to its own outline (object-view-box) and sizing it like a real figure fixed this. Separately, a \"photo-less items go last\" sort rule had been implemented keyed on a semantically-related data flag (e.g. \"announced\") instead of on whether the item actually has a rendered photo, which diverges whenever those two states don't match — the owner judges by what he SEES, not by the underlying flag"
provenance: owner-stated
created: 2026-10-15
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0304]
---

**Situation:** a grid mixed real item photos with a fallback silhouette placeholder for items that
have no photo yet. The silhouette was originally rendered padded inside a neutral bounding box,
making those items visually read as smaller/lesser compared to full-bleed real photos. Separately, a
rule meant to sort photo-less items to the end of their group had been keyed on a data flag that
correlates with, but is not identical to, "has no rendered photo" — so the two states could diverge.

**Lesson:** two related but distinct rendering bugs recur with placeholder fallbacks mixed into a
real-content grid: (1) a placeholder given generic padding instead of being cropped/sized to match the
real content's own silhouette visually demotes the item, even though nothing about its data says it's
lesser; (2) any rule that is supposed to apply to "items without a real rendered photo" must check that
exact rendered condition — keying it on an adjacent data flag (status, category, a boolean that often
but not always correlates) will diverge the moment reality and that flag disagree, and the user judges
by what renders, not by the flag.

**Apply next time:** size and crop any fallback placeholder to match a real item's own visual
footprint (object-view-box / outline-cropping, not a padded box), and key any sort/priority rule meant
for "no real photo" on the actual rendered-content check at the point of rendering, never on a
same-shaped-but-distinct data flag.
