---
id: LESSON-0616
type: library-verdict
domain: image-processing
tags: [imagegen, codex, upscale, super-resolution, real-esrgan, spandrel]
context: a source product/catalog photo is below a usable resolution threshold (e.g. <800px) and needs a faithful 2x rescale before display or further processing
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-04 (agent-inferred): Codex's image tool is generative, not suited for a faithful 2x rescale (it refuses or redraws); use local deterministic super-resolution (Real-ESRGAN/spandrel) for sources <800px"
trigger: use this when a source image needs a faithful (not reinterpreted) 2x upscale and reaching for an AI image-generation worker (e.g. Codex imagegen) is the default plan
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0552, LESSON-0601, LESSON-0617]
---

**Situation:** needed a faithful 2x rescale of a low-resolution (<800px) source photo. Reaching for
Codex's image tool for the upscale either had it refuse the task or redraw/reinterpret the image
(consistent with LESSON-0552/LESSON-0601: a generative model asked to "faithfully" transform an image has
no structural way to guarantee it isn't inventing/altering content).

**Tried:** Codex imagegen for a faithful 2x upscale — FAILED (generative tool, refuses or redraws rather
than performing a deterministic resize).

**Use instead:** a local, deterministic super-resolution model (Real-ESRGAN, or a `spandrel`-loaded
equivalent) for sources under ~800px — a purpose-built upscaling network rather than a general
text-to-image generative tool, so it does not "reinterpret" content the way a generative model does.

**Recommend next time** this need appears: for a faithful upscale/rescale of a real photo, do not reach
for a generative imagegen worker (Codex or similar) at all — use a local deterministic super-resolution
tool (Real-ESRGAN/spandrel) instead. Reserve generative imagegen for tasks that are genuinely generative
(restoration/cleanup where some reinterpretation is acceptable), not for a plain faithful resize.
