---
id: LESSON-0261
type: pattern
domain: review-tooling
tags: [review-preview, i18n, sibling-files, content-generation, tabs]
context: designing or reviewing a review/preview surface for a deliverable that ships as N sibling variants (locales, formats, platforms) produced by the same pipeline
trigger: use this when a deliverable ships as N sibling files/variants (e.g. es.mdx + en.mdx) and needs a single review link — before deciding what the preview shows for a variant not yet produced
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-24 (owner-stated) — a blog post ships as es.mdx + en.mdx; the review preview only showed the locale already drafted, dropping the tab for the not-yet-produced sibling. This read as 'that version is not planned' and hid owed work. Landed as AC-08-024.4 in FRD-08 with per-locale heading ids (so two tables of contents cannot collide on duplicate ids), real tablist semantics, and the original locale opening first."
provenance: owner-stated
created: 2026-09-25
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** a deliverable produced by a multi-variant pipeline (a blog post drafted in two locales, a
design produced at two breakpoints, an asset exported in two formats) ships one review link. The preview
for that link only rendered the variant already finished, silently dropping the tab/slot for the sibling
not yet produced.

**Lesson:** dropping the absent variant from a review surface does not read as "not ready yet" to the
reviewer — it reads as "that variant was never planned", hiding work that is still owed. A review preview
for an N-variant deliverable must show all N behind a tab/selector on the ONE link, and the variant not yet
produced must keep its slot with an explicit state naming the stage that will fill it (rather than being
omitted). Two variants sharing the same review surface can also collide on structural ids (e.g. duplicate
heading ids feeding two tables of contents) unless each variant's ids are namespaced per-variant.

**Apply next time:** when building a review/preview surface for any N-sibling-variant deliverable: (1)
render all N variants behind real tab/selector semantics on one link, never a silently-dropped tab for an
unfinished variant; (2) give the not-yet-produced variant an explicit "pending: <stage>" state instead of
omitting it; (3) namespace any structural ids (heading ids, anchor ids) per variant so two variants sharing
one page never collide; (4) open the "primary"/original variant first by default.
