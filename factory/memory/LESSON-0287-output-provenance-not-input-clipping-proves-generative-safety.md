---
id: LESSON-0287
type: pattern
domain: ai-product-design
tags: [rag, spoiler-safety, output-provenance, llm-safety-claim, discovery-research]
context: evaluating a product/competitor's safety claim that restricting a generative model's INPUT context (e.g. to already-read chapters) prevents it from revealing out-of-scope content
trigger: use this when evaluating (your own design, or a competitor's marketing claim) whether a generative-model feature can be trusted not to leak content outside an intended boundary (spoilers, restricted data, future plot) by restricting what is fed into its context
source: "panda-corp 2026-10-12, discover deep-dive on a book-recall/recap product idea — competitor FAQ (recallreader.com) claims restricting retrieval to already-read chapters prevents spoilers; a pretrained generative model can still recall and surface future plot from its own training knowledge regardless of what is retrieved into its context window"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a book-recall product's safety pitch was "we only retrieve text from chapters you've
already read, so we can't spoil you." That claim only controls the INPUT side (what is fetched into the
prompt) — it says nothing about the OUTPUT side: a pretrained generative model already carries knowledge
of the whole book (or franchise) from training and can surface future-plot content regardless of what
was retrieved for this specific answer.

**Lesson:** clipping the input context of a RAG-style feature is not proof the model's OUTPUT is
constrained to that context — a pretrained model's own prior knowledge is a second, uncontrolled
information channel that input-side restriction does nothing to close. A safety/boundary claim needs to
be verified at the point where content actually leaves the system (the output), not just at the point
where content is fed in.

**Apply next time:** when designing or evaluating a feature that claims a content boundary (no spoilers,
no restricted data, no leaked future state) via input restriction alone, check whether the underlying
model has independent prior knowledge of the excluded content — if it does, input clipping is
insufficient; either use a genuinely output-constrained mechanism (e.g., a deterministic extractive
fallback limited to eligible passages) or explicitly flag the free-form-generation path as NOT
spoiler-safe rather than claiming it is.
