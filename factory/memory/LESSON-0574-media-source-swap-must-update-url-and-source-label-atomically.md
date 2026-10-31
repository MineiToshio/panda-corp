---
id: LESSON-0574
type: gotcha
domain: data-integrity
tags: [media-pipeline, stale-reference, source-swap, data-integrity]
context: a catalog item's media slot that stores a "source" label (which provider supplied the image) separately from the image URL itself, and the sourcing step can re-run to swap to a different source
trigger: use this when a media-sourcing step can re-run and swap a candidate item's image source, before trusting that a slot's stored URL matches its stored source label
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

**Situation:** in funko-tracker, candidate media for an item was re-sourced from a new provider, but the
field holding the actual image URL was not updated — the slot kept serving the EARLIER source's URL even
though its recorded source label said otherwise.

**Lesson:** a source swap in a media pipeline is really two writes (the source label + the asset
URL/reference), and a partial write that updates only one of them leaves a slot in an inconsistent,
hard-to-detect state — a consumer reads the (now stale) URL while believing it matches the (correctly
updated) source label, with no error signal anywhere.

**Apply next time:** whenever a media-sourcing step changes WHICH provider/source supplied an item's
image, write the source label and the URL as one atomic unit — and before trusting any delivered media
in a verification/QA pass, audit that each slot's actual URL matches its own recorded source field,
rather than trusting the label alone.
