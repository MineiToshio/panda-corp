---
id: LESSON-0015
type: pattern
domain: content-generation
tags: [ai-writing, blog, style-guide, few-shot, human-gate]
context: generating blog posts with an AI that need to sound like the author's own voice, not generic AI prose
source: factory/memory/_inbox.md (2026-06-2x)
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: [LESSON-0014]
---

**Situation:** Generating AI-written blog content that should read in the author's own voice, not generic
AI-blog prose.

**Lesson:** The pattern that works is: (1) extract a **style guide** from the author's own past posts
(tone, sentence rhythm, recurring phrasing); (2) **few-shot** the generation with the author's REAL text
samples, chosen by **content similarity** to the post being generated (not random/generic samples); (3) a
mandatory **human edit gate** between draft and publish — never auto-publish AI-generated content straight
through.

**Apply next time:** When a project needs AI-generated content in someone's personal voice, build the
pipeline as style-guide-extraction + similarity-selected few-shot + human-edited draft, never a direct
prompt→publish pipeline.
