---
id: LESSON-0704
type: pattern
domain: human-gates
tags: [owner-approval, batch-approval, human-gates, delivery, re-asking]
context: the owner replies with a single "sí"/approval to a message that presented or was about several pending deliveries/items in the same run
trigger: use this when an owner's single approval reply ("sí") is about to be applied to only one of several items it was actually responding to, or when deciding whether to ask again for an item the owner already covered earlier in the same run
source: "funko-tracker .pandacorp/run/lessons.md, 2026-11-20 (owner-stated): 'un \"sí\" del owner aprueba cada entrega que responde; nunca volver a preguntar en la misma corrida' — shipped as commit 74c86e46 'feat(ingest): one owner approval covers every delivery it answers'"
provenance: owner-stated
created: 2026-11-20
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0602, LESSON-0659, LESSON-0670]
---

**Situation:** in funko-tracker's ingestion workflow, the owner's single "sí" was treated as approving
only the one delivery it was most narrowly attached to, requiring a fresh approval ask for each additional
delivery in the same run even when the owner's reply plainly covered all of them. The owner's explicit
rule, stated directly: one "sí" approves every delivery it answers; never ask again for that same
approval within the same run.

**Lesson:** this owner's approval gates are scoped to WHAT WAS ASKED, not to a fixed one-item-per-message
shape — when a message presents (or a reply naturally covers) several pending items at once, a single
affirmative reply authorizes all of them, and re-asking for an item already covered by that reply is
friction the owner has explicitly rejected. This complements rather than contradicts LESSON-0602
("selection approval is distinct from publish approval" — those are two DIFFERENT kinds of gate) and
LESSON-0659 (a parser must accept natural multi-item replies like "Sí, apruebo ambas"): the scope of one
approval is defined by what it was asked about, and once given, it is not re-litigated for the same thing
within the same run.

**Apply next time:** when designing or operating an approval step for this owner (or by default, absent
evidence to the contrary), scope a single "sí"/affirmative reply to cover every item it was presented
with or plainly responding to, and never re-ask for an item already approved earlier in the same run —
but keep genuinely distinct gates (e.g. selecting a candidate vs. publishing it to production) as
separate questions, per LESSON-0602.
