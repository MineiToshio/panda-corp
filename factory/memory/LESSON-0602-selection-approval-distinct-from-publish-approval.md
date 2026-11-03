---
id: LESSON-0602
type: gotcha
domain: human-gates
tags: [owner-approval, publish-gate, content-sourcing, human-gates]
context: an owner approves a round of candidate results (a search/sourcing pass, a batch of generated or fetched assets) during review, and that approval is then treated as authorization to publish those results to production
source: "funko-tracker .pandacorp/run/lessons.md (agent-inferred): 'Aprobar una ronda de búsqueda no es aprobar su publicación: cada lote a producción necesita orden explícita del owner'"
trigger: use this when an owner has approved/picked from a round of sourced or generated candidates and the next step would publish those results to production without a separate, explicit go-ahead
provenance: agent-inferred
created: 2026-11-03
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0424, LESSON-0451]
---

**Situation:** in funko-tracker, the owner reviewed and picked/accepted results from a search or sourcing
round (e.g. which logo/image candidate to use per item). That selection approval was at risk of being
treated as if it also authorized pushing that batch live to production — it does not; each batch reaching
production needs its own explicit order from the owner, separate from the selection step.

**Lesson:** "I approved which candidate to use" and "I approved shipping this to production" are two
distinct gates, even when they happen in close succession and even when the owner's selection feedback
sounds conclusive. A review/approval step inside a sourcing or generation pipeline settles WHICH result is
correct; it does not by itself settle WHEN or WHETHER that result is released. Collapsing the two lets a
selection conversation quietly become a publish authorization.

**Apply next time:** keep a sourcing/review approval and a production-publish approval as two separate,
explicitly asked questions — never infer the second from the first, even within the same review session.
Before publishing any batch produced from an approved selection round, ask for (or wait for) a distinct,
explicit "ship this" instruction.
