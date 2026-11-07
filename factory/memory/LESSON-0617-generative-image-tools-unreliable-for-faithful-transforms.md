---
id: LESSON-0617
type: pattern
domain: ai-generation
tags: [imagegen, codex, fidelity, self-check, upscale, restoration, transparent-material, reflection]
context: synthesis of 4 funko-tracker lessons about using a generative AI image worker (Codex imagegen
  or similar) for a task that is supposed to be FAITHFUL to a real source image (a rescale, a logo
  restoration, a transparent/acrylic surface, or a self-reported fidelity check on its own output)
trigger: use this when a plan reaches for an AI image-generation/restoration worker (Codex imagegen or
  similar) for any task framed as "faithfully" transforming a real photo/logo — an upscale, a restoration,
  a cleanup, a transparent-material cutout — or when deciding whether that worker's own self-report of its
  output's fidelity is sufficient evidence
source: "reflection pass, panda-corp memory review 2026-11-04 — synthesizes LESSON-0552 (funko-tracker,
  2026-10-30), LESSON-0601 (funko-tracker, 2026-11-03), LESSON-0616 (funko-tracker, 2026-11-04); MERGED
  2026-11-07 (panda-corp memory review) — LESSON-0625 (funko-tracker, 2026-11-05/06: AI generation failed
  4/4 rounds to reproduce transparent acrylic over a chroma-key background) folded in as a 4th incident of
  the same root cause, not a separate lesson; all 4 single-project (funko-tracker), pending corroboration
  from a second project before this synthesis itself can activate"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0552, LESSON-0601, LESSON-0616, LESSON-0069, LESSON-0625, LESSON-0572, LESSON-0622]
---

**Situation:** four separate incidents on the same project each tried to use a generative AI image
worker (Codex imagegen) for a task framed as "faithful" to a real source, and each failed for the same
underlying reason: a "faithful upscale" of a soft 503px photo reconstructed plausible but INVENTED detail
while the worker's own self-check reported "no changes" (LESSON-0552); 8/8 attempts to "restore" a
degraded logo crop were rejected on review for altering shape/proportion/detail (LESSON-0601); a plain
faithful 2x rescale of a sub-800px source either refused outright or redrew/reinterpreted the image
instead of resizing it (LESSON-0616); and 4/4 generation rounds over a uniform chroma-key background
failed to reproduce a transparent/clear acrylic surface, leaving patches, halos or an invented support
structure each time (LESSON-0625).

**Lesson:** these are not three separate tool quirks — they are one root cause: a generative model has no
structural mechanism to guarantee "I did not invent or alter anything" about its own output, because
generation and self-grading both run through the same pattern-completion process. There is no literal
byte-level "faithful" baseline the model can diff against (unlike code/text, where an exact-diff or
test-oracle exists, per LESSON-0069's general "don't trust self-report" principle) — "faithful" is itself
a judgment call the same generative process is being asked to make about itself, so it reliably rates its
own hallucinated/altered content as unchanged. This holds across every flavor of "faithful" image task
tried so far: resolution (upscale), restoration (logo cleanup), a plain resize, and even a material
property (rendering a transparent/clear acrylic surface, where "faithful" means reproducing the ABSENCE of
content — exactly what a pattern-completion generator cannot do on demand, LESSON-0625) — the worker
either over-delivers (invents detail, alters shape, paints something where there should be nothing) or
under-delivers (refuses/redraws) rather than performing a deterministic, content-preserving transform.

**Apply next time:** for ANY task that requires a real photo/logo/asset to come out of a transform
UNCHANGED in content (a resize, an upscale, a restoration, a cleanup), do not reach for a generative
imagegen/restoration worker (Codex or similar) at all, regardless of how the task is framed:
- faithful upscale/rescale → use a local, deterministic super-resolution tool (Real-ESRGAN/spandrel), not
  a generative model (LESSON-0616);
- logo/brand-mark restoration → use a direct crop from an existing physical/photographic reference, or
  source the canonical mark via a normal image search — never a generative restoration pass
  (LESSON-0601);
- transparent/clear material (acrylic stands, packaging windows) → route to a real-photo source (crop
  from an actual photograph) or a non-generative cutout technique instead; do not retry the same
  generation approach after a rejection — it does not converge, and 2 rejections on the same material-class
  failure is a signal to escalate to the owner, not to run a third/fourth attempt (LESSON-0625);
- any case where a generative pass genuinely is appropriate (restoration/cleanup where some
  reinterpretation is tolerable) → never accept the SAME worker's own self-check as evidence of fidelity;
  require an independent verification pass (a different model/session, or a human pixel-region diff
  against the original) explicitly looking for invented detail before trusting a "no changes"/"faithful"
  claim (LESSON-0552).
The common thread: "faithful" is a correctness claim to verify externally, never a property a generative
process can certify about its own output.
