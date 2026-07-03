---
id: LESSON-0046
type: pattern
domain: content-generation
tags: [playwright, screenshot, thumbnail, zoom, crop, dashboard-ui]
context: producing a clean, legible small-thumbnail crop from a wide/dense dashboard-style UI that doesn't natively fit a tall 16:9/4:3 target ratio
trigger: use this when producing a small thumbnail crop of a wide/dense dashboard-style UI (kanban boards, stat-card rows) for a portfolio or case study
source: "personal-page-v2 .pandacorp/run/lessons.md"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0042]
---

**Situation:** cropping a wide/dense dashboard-style UI (kanban boards, stat-card rows) into a small
thumbnail at a tall 16:9/4:3 target ratio produced illegible "busy" thumbnails when done by cropping a
wide region and shrinking it — too many tiny elements crammed into a small frame.

**Lesson:** applying `document.body.style.zoom = "2.2"` (or a similar factor) BEFORE measuring/cropping in
Playwright, so that only 1-2 UI elements fill the frame instead of many tiny ones, produces a far more
legible result than the naive wide-crop-then-shrink approach.

**Apply next time:** when a small thumbnail crop of a dense dashboard UI needs to read cleanly, zoom the
page in before capture/crop (via `document.body.style.zoom`) rather than cropping wide and shrinking.
