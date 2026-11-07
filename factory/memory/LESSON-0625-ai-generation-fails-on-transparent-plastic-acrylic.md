---
id: LESSON-0625
type: gotcha
domain: ai-generation
tags: [imagegen, chroma-key, background-removal, acrylic, transparent-material, escalation]
context: using AI image generation/inpainting (over a uniform chroma-key background) to produce or
  clean up a product photo that includes a transparent/clear plastic surface (acrylic display stands,
  clear packaging windows)
trigger: use this when a photo-sourcing or background-removal plan reaches for AI
  generation/inpainting on an item that has a transparent/clear acrylic surface, or when a reviewer has
  already rejected the same AI-generated item twice
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-05/06 (agent-inferred, Naruto batch): AI
  generation over a uniform chroma-key background (#FF00FF) failed to reproduce transparent acrylic
  across 4 separate rounds — patches, halos, and invented support structures each time; the project's
  own 'after 2 reviewer rejections, stop and escalate to the owner' rule was the intended response"
provenance: agent-inferred
created: 2026-11-07
status: candidate   # 2026-11-07 (librarian review) — folded as the 4th incident into the LESSON-0617 reflection synthesis (same root cause: a generative model cannot guarantee "I did not invent/alter anything" about its own output), matching this store's convention for reflection facets (LESSON-0552/0601/0616 under LESSON-0617 itself, LESSON-0079 under LESSON-0185): stays its own evidence anchor at its own status, cited by the synthesis rather than deprecated.
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0617, LESSON-0572, LESSON-0622]
---

**Situation:** a batch of product photos needed AI-generated cutouts (figures/accessories shot or
composited over a uniform chroma-key background) for items whose packaging includes a transparent/clear
acrylic part (a display stand, a window). Across 4 separate generation rounds, the AI worker never
produced a clean transparent surface — each attempt left visible patches, halos, or an entirely invented
support structure where the clear acrylic should have been.

**Lesson:** this is the same structural failure LESSON-0617 already found for "faithful" upscale/
restoration tasks, applied to a different material class: a generative model has no mechanism to render
"nothing is here, see through it" — transparency is defined by the ABSENCE of invented content, which is
exactly what a pattern-completion generator is bad at producing on demand. A uniform chroma-key
background (which works for opaque subjects) does not help, because the model still has to decide what
to paint where the acrylic is, and it reliably invents something. Retrying the same generation approach
after a rejection does not converge — 4 rounds failed for the same reason each time.

**Apply next time:** do not reach for AI generation/inpainting to produce or repair a transparent/clear
plastic (acrylic) surface, regardless of background technique — treat "has a transparent material" as a
reason to route the item to a real-photo source (crop from an actual photograph) or a different
non-generative cutout technique instead. If a reviewer has already rejected the SAME AI-generated item
twice, stop iterating on that approach and escalate to the owner for a decision (different sourcing
method, or an explicit owner override) rather than running a third/fourth generation attempt — repeated
rejections on the same material-class failure are a signal to change approach, not to retry harder.
