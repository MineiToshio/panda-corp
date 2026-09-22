---
id: LESSON-0250
type: pattern
domain: content-generation
tags: [agent-workflow, blog-generator, artifact, iteration, owner-preference]
context: an owner asks for a piece of AI-assisted writing (a blog post) that he already has fully shaped in his own head
trigger: use this when the owner explicitly signals a piece of content is already shaped in his head and asks to see the draft directly, rather than a planning/outline artifact first
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-20 (owner-stated) — 'no me des de frente como que el tema, sino ármame directamente el blog post en el artefacto para poder leerlo y desde ahí vamos iterando'"
provenance: owner-stated
created: 2026-09-22
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** a content-generation workflow (here, personal-page-v2's blog-generator) defaults to an
outline-proposal round before drafting. When the owner already has a post fully shaped in his head, that
round is pure overhead — he does not want to be asked "what's the topic", he wants to read and correct an
actual draft.

**Lesson:** when the owner signals a piece of content is already shaped in his head (he states the topic
AND its argument/structure, not just a request to write about X), skip the outline-proposal round entirely
and draft straight into the rendered preview artifact — the iteration loop then happens on the artifact
itself (re-reading, correcting), not on an abstract outline. This is a distinct mode alongside the default
"outline first, then draft" flow, not a wholesale replacement for it.

**Apply next time:** in any AI-writing pipeline with an outline step, offer (or default to, once the owner
has expressed this preference) a short-circuit path when the owner has clearly already shaped the content
in his head: draft directly into the artifact/preview the owner will read, and iterate on that rendered
output rather than on an intermediate outline document.
