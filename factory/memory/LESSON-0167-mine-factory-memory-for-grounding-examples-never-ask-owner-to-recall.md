---
id: LESSON-0167
type: pattern
domain: skill-authoring
tags: [grounding, distillation, memory-retrieval, owner-interaction]
context: authoring a new skill/prompt/rubric that needs concrete real-world examples to distill from ("grounding material")
trigger: use this when a skill-authoring or prompt-distillation task needs real example cases and the natural instinct is to ask the owner to recall or supply them
source: "panda-corp 2026-07-11 — owner redirect during authoring of a personal skill (outside plugin/): owner did not recall specific cases and pointed the agent at factory/memory + factory/backlog + decision logs instead, which supplied working examples (the Party audit, discover v2, and the restart-vs-resume decision all served as grounding)"
provenance: owner-stated
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an agent asked the owner to supply 3 real examples ("grounding material") to distill a
new skill from. The owner redirected: he doesn't keep specific past cases in memory himself, and the
agent should instead mine them from the factory's own durable records. Once redirected, the agent found
strong, directly-usable examples already sitting in `factory/memory/`, `factory/backlog/` and the
per-area decision logs (a prior audit, a shipped feature's design decision, a restart-vs-resume verdict)
— each served as grounding material as well as or better than a recalled anecdote would have.

**Lesson:** the factory's own memory/backlog/decision-log store IS a source of real, already-vetted
examples for any distillation task — a future skill, rubric or prompt that needs concrete grounding
cases should be built FROM this store first, not by asking the owner to recall specifics from memory.
Blocking on the owner to remember a past case is both unnecessary (the record already exists,
committed and searchable) and unreliable (human recall of which project/incident illustrates which
point is worse than grep).

**Apply next time:** before asking the owner "can you give me 2-3 real examples of X", first search
`factory/memory/`, `factory/backlog/` and the relevant area's `decision-log.md` for cases that already
illustrate the pattern being distilled — only escalate to the owner if the store genuinely has nothing
on point.
