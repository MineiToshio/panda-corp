---
id: LESSON-0015
type: pattern
domain: content-generation
tags: [ai-writing, blog, style-guide, few-shot, human-gate]
context: generating blog posts with an AI that need to sound like the author's own voice, not generic AI prose
trigger: use this when generating AI-written blog or content that must sound like a specific author's own voice
source: "factory/memory/_inbox.md (2026-06-2x); corroborated by a real failure on personal-page-v2 (2026-07-06/07): the voice-style-guide extraction step (FRD-08) used a placeholder seed post (invented during the build, never the owner's real writing) as its 'reference' sample and documented the guide as mirroring it — biasing the extracted voice toward a register the owner never wrote in, because nothing marked the seed as synthetic (see LESSON-0107)"
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: [LESSON-0014, LESSON-0107]
---

**Situation:** Generating AI-written blog content that should read in the author's own voice, not generic
AI-blog prose.

**Lesson:** The pattern that works is: (1) extract a **style guide** from the author's own past posts
(tone, sentence rhythm, recurring phrasing); (2) **few-shot** the generation with the author's REAL text
samples, chosen by **content similarity** to the post being generated (not random/generic samples); (3) a
mandatory **human edit gate** between draft and publish — never auto-publish AI-generated content straight
through; (4) **verify the source samples are genuinely the author's** — a placeholder/seed post generated
during the build (to satisfy an "at least one post exists" invariant, LESSON-0107) can silently get read
as ground truth by the extraction step if nothing marks it as synthetic, biasing the whole style guide
toward a register the author never actually wrote in.

**Apply next time:** When a project needs AI-generated content in someone's personal voice, build the
pipeline as style-guide-extraction + similarity-selected few-shot + human-edited draft, never a direct
prompt→publish pipeline — and confirm every sample the extractor reads is real author material, not an
unlabeled seed/placeholder.
