---
id: LESSON-0601
type: library-verdict
domain: ai-generation
tags: [imagegen, codex, logo, restoration, upscale, asset-sourcing]
context: restoring/cleaning up a low-quality or damaged logo image (e.g. cropped from a product box photo) using an AI image-generation worker, as an alternative to sourcing the logo from elsewhere
source: "funko-tracker .pandacorp/run/lessons.md (agent-inferred): 'Restauración de logos con IA vía Codex: 8 de 8 rechazadas por cambiar detalles; preferir recorte de caja o búsqueda'"
trigger: use this when considering an AI image-generation/restoration pass to clean up or sharpen a low-quality logo asset before using a box-crop or a normal web search instead
provenance: agent-inferred
created: 2026-11-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0552, LESSON-0593, LESSON-0600, LESSON-0617]
---

**Situation:** funko-tracker tried using a Codex-driven AI image-generation worker to "restore"/clean up
logo images that were low-quality box crops. Every single attempt (8 of 8) was rejected on review for
changing details of the original mark — the restoration pass altered shapes, proportions, or fine detail
rather than faithfully reproducing the source logo.

**Tried:** AI restoration (Codex imagegen) of a cropped/degraded logo — FAILED, 8/8 rejected for changed
detail. This is consistent with LESSON-0552 (a generative model asked to "faithfully" alter an image has
no structural way to guarantee it didn't invent/change detail) applied specifically to logos, where even
small shape/proportion drift is immediately visible and unacceptable.

**Use instead:** a direct crop from the box/package photo (no generative restoration), or sourcing the
canonical logo via a normal web search by name (see LESSON-0600) — both avoid the fabrication risk
entirely because neither asks a generative model to "faithfully" reconstruct the mark.

**Recommend next time** this need appears: for a logo/brand-mark asset specifically, do NOT reach for an
AI restoration/upscale pass to fix a low-quality source — prefer a clean crop of an existing physical
reference or sourcing the logo from an authoritative image search. Reserve AI image restoration for
assets where small detail drift is tolerable, not for brand marks.
