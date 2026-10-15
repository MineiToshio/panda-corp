---
id: LESSON-0338
type: gotcha
domain: image-processing
tags: [png, jpeg, transparency, codex-image-gen, logo, asset-pipeline]
context: converting an AI-generated logo/icon PNG (which may have a transparent background) directly to JPEG for a web asset pipeline
trigger: use this when deriving JPEG web assets from an AI-generated PNG logo/icon, before assuming the PNG's background is opaque
source: "pandasaga .pandacorp/run/lessons.md 2026-10-14 (agent-inferred): Codex image generation returned logo PNGs with a transparent background; converting them straight to JPEG painted the transparency black"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** AI-generated logo PNGs came back with a transparent background (by design, for flexible
placement). Converting them straight to JPEG for a web asset pipeline — JPEG has no alpha channel —
silently painted every transparent pixel BLACK, producing a logo with a black box around it.

**Lesson:** JPEG cannot represent transparency; any tool converting a transparent PNG to JPEG must pick
a background color to composite onto, and most naive conversions default to black (or whatever the
converter's internal canvas default is) rather than failing loudly. This is invisible until the asset is
actually viewed against a non-black surface.

**Apply next time:** before deriving JPEG (or any non-alpha format) from an AI-generated PNG, explicitly
composite it onto the intended background color (typically white) first, and review the resulting logo
on BOTH a white and a dark/ink background before shipping — don't trust the conversion tool's default
compositing behavior.
