---
id: LESSON-0140
type: gotcha
domain: agent-verification
tags: [content-qa, screenshot, static-gates, copy-paste-error, visual-verification]
context: a page/component built by copying an existing similar item (a case-study card, a template instance) as a starting point, where every automated gate (build, lint, type-check, unit test) passed
trigger: use this when a set of similar content items (cards, case studies, templates) were built by copying a prior item, and you need to verify content correctness beyond "the build is green"
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-10 (agent-inferred) — a screenshot caught two placeholder cover images, copied from a retired case study, that still carried the retired study's name; every static check (build, lint, types, tests) had passed clean because nothing asserted on the actual copied VALUES, only on structure"
provenance: agent-inferred
created: 2026-07-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0069, LESSON-0042]
---

**Situation:** cover images/labels for a set of case-study cards were built by copying a prior card as a
template. Two of the new cards still carried a retired case study's name in their placeholder cover —
every static gate (build, lint, type-check, unit tests) was green, because none of them assert on the
literal CONTENT VALUE of a copied field, only on its structural presence/type. A screenshot of the rendered
page caught it immediately; no automated check had.

**Lesson:** static gates verify structure and logic, not semantic content correctness — a copy-paste
starting point reliably propagates stale VALUES (names, labels, image references) that pass every
structural check because the field is present and correctly typed, just wrong. This is a concrete instance
of the broader "verify against the live artifact, not a stand-in" family (LESSON-0069): here the stand-in
is "the gate suite is green," and the live artifact is the actually-rendered page.

**Apply next time:** after building a set of content items by copying a prior item as a template, do a
visual pass (render/screenshot each item) specifically checking for stale copied values (names, labels,
image captions) before trusting a green build/test/lint suite as proof of content correctness — green gates
prove the shape is right, not that the words are.
