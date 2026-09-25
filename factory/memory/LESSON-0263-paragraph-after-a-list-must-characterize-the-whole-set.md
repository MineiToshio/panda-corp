---
id: LESSON-0263
type: gotcha
domain: content-generation
tags: [copywriting, narrative-structure, lists, argument-coherence]
context: writing or reviewing prose where a paragraph follows an enumerated list of N items (documents, steps, options)
trigger: use this when a paragraph immediately follows a list of N items — before letting it define or elaborate on only 2 of the N
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-24 (owner-stated) — an AI-direction draft listed 6 documents (PRD/PDD/FRD/FDD/blueprint/work order) and the next paragraph defined only the blueprint and the work order, which read to the owner as arbitrary ('¿por qué solo me hablas del blueprint?'). Fix: state the property that makes the SET work (all 6 are cross-referenced, with a written precedence order when two disagree, so an agent can start anywhere and walk up to the context it needs) instead of a paragraph singling out 2 of the 6 items."
provenance: owner-stated
created: 2026-09-25
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0251]
---

**Situation:** a draft listed 6 items as one set, then the paragraph right after the list zoomed into
defining only 2 of them — reading to the reader as an arbitrary, unexplained narrowing ("why only these
two?"), even though the two chosen were legitimately the most complex to explain.

**Lesson:** after presenting a SET, the next paragraph must say something about the SET — a shared
property, a relationship, a rule that applies to all its members — not zoom into a subset without
explaining why that subset was singled out. A common cause of the anti-pattern: chasing a template
requirement for "one or two definitional sentences" per section, which nudges toward picking 1-2
representative items to define instead of characterizing the whole list. That requirement is satisfiable by
the list items themselves (each already named) plus a standalone sentence/blockquote naming the property
that makes the set cohere, without a paragraph that plays favorites among the members.

**Apply next time:** when a paragraph follows an enumerated list, check whether it addresses the SET (a
cross-cutting property, a rule, a relationship among all members) or silently narrows to a subset; if the
draft needs to elaborate on specific members, either elaborate on ALL of them briefly or explicitly signal
why only some are being expanded ("of these, X and Y need more explanation because...").
