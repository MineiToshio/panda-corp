---
id: LESSON-0654
type: pattern
domain: product-photography
tags: [sourcing, product-images, retailer-renders, ai-generation-fallback]
context: a catalog/product-photo pipeline that has exhausted its AI-generation attempt budget for a loose figure or box view and still needs a usable image
trigger: use this when AI generation/restoration attempts for a product photo are exhausted (hit the attempt cap, kept failing review) and a real, high-quality source is still needed
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (agent-inferred): official retailer renders (e.g. a major retailer's product-photography CDN, or a brand's own transparent-background PNGs) were the best non-AI fix for loose figures/boxes whose AI attempts were exhausted"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0617, LESSON-0616]
---

**Situation:** after exhausting the AI-generation/restoration attempt budget for a product image (loose
figure or box view) with no acceptable result, the fallback that actually worked was sourcing an official
retailer's own product render (a major retailer's dedicated product-photography CDN, or the brand's own
transparent-background PNGs) rather than retrying generation again.

**Lesson:** for a real, physical, mass-market product, an official retailer or brand almost always
already has a high-quality studio render of it publicly hosted — that is a deterministic, zero-attempt-
budget source of exactly the faithful image a generative tool keeps failing to produce (consistent with
LESSON-0617: a generative model cannot guarantee faithfulness, but an existing real photo trivially is
faithful). This is a general sourcing strategy for any catalog/e-commerce pipeline building a product
image set, not specific to one brand's catalog.

**Apply next time:** before spending further AI-generation attempts on a product photo that keeps
failing review, check whether an official retailer or brand-owned source already has a usable render of
the exact item/variant — prefer that real source over continuing to retry a generative tool, especially
once 1-2 generation attempts have already failed for the same item.
