---
id: LESSON-0552
type: gotcha
domain: ai-generation
tags: [imagegen, codex, fidelity, self-check, upscale, verification, trust]
context: an AI image-generation worker (e.g. Codex imagegen) is asked to perform a "faithful" transformation (upscale, restore, enhance) of a real photo and reports its own self-check result as evidence the output is unchanged/faithful
trigger: use this when accepting an AI worker's claim that its own generated/altered image output is "faithful" or "no changes" — before trusting that claim for a real product photo, collectible, or any image where invented detail would be a correctness problem
source: "funko-tracker .pandacorp/run/lessons.md (undated, agent-inferred) — Codex imagegen's 'faithful upscale' of a very soft/low-resolution (~503px) real photo reconstructed plausible-looking but INVENTED detail (a sash, eyes, scuff marks not present in the source), while Codex's own self-check reported 'no changes'; only an independent, separate comparison (by a different model/pass) caught the fabrication"
provenance: agent-inferred
created: 2026-10-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0069]
---

**Situation:** a real product photo was too soft/low-resolution for a catalog's display needs. An AI
imagegen worker was asked to produce a "faithful upscale" — enhance resolution without inventing new
content. The model's generative upscale pass filled in plausible high-frequency detail (texture, small
features) that was never actually present in the source image at that resolution, and its OWN self-check
pass reported the result as unchanged/faithful. Only a SEPARATE, independent verification (a different
model/session comparing the output against the original pixel-for-pixel/region-for-region, rather than
asking the same generative process to grade itself) identified the fabricated detail.

**Lesson:** this is a specific, high-stakes instance of the general "don't trust a worker's self-report"
problem (LESSON-0069/CONV-13): a generative model asked to both PRODUCE an altered image and GRADE
whether that image stayed faithful to the source has no structural reason to catch its own hallucinated
detail — the self-check is evaluating the same generative process's own output, through the same kind of
pattern-completion that produced the hallucination in the first place, so it readily rates invented
content as "no changes." This is distinct from code/text fidelity checks (which have exact-diff or
test-oracle avenues) because a generative image transform has no literal byte-level "faithful" baseline
to diff against — "faithful" is itself a judgment call the same model is being asked to make about
itself.

**Apply next time:** never accept a generative imagegen/upscale worker's own self-check as sufficient
evidence of fidelity for any image where invented detail matters (product photos, collectibles,
anything presented as authentic). Require an INDEPENDENT verification step — a different model/pass, or
a human visual diff against the original at matched zoom/region — explicitly looking for invented
features (new edges, textures, marks, or details not resolvable in the source at its original
resolution) before accepting a "faithful" claim. Treat "faithful upscale" as a claim to verify, not a
property the generation step can certify about itself.
