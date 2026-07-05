---
id: LESSON-0076
type: gotcha
domain: model-selection
tags: [subagent, inventory, cheap-tier, haiku, verification]
context: a cheap-tier subagent (haiku-class) asked to report an inventory fact (an id, a count, a catalog listing) before it is used to plan or number new work
trigger: use this when a cheap-tier subagent's output includes an ID, a count, or "next free number" fact that a later step will build on
source: "panda-corp — an inventory subagent reported next proposal number = 25 when proposals 25-28 already existed"
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0032, LESSON-0069]
---

**Situation:** a cheap-tier subagent tasked with reporting an inventory fact (the next free proposal
number) returned a STALE answer — it said the next number was 25 when proposals 25 through 28 already
existed on disk. The number was then almost used to file a new proposal that would have collided.

**Lesson:** a cheap-tier subagent's inventory/catalog reporting is not reliable ground truth for anything
numeric that will be BUILT ON (an id allocation, a count feeding a decision, a "next free slot"). This is
the same failure class the factory already guards against with `validate-backlog.sh`/`validate-memory.sh`
as authoritative id allocators — but it generalizes past ids to any catalog fact a cheap tier is asked to
summarize.

**Apply next time:** before building on any ID/number/count a subagent reports from an inventory scan,
re-verify it directly with a fresh `ls`/`grep`/`find` yourself (or the authoritative validator script if
one exists) rather than trusting the subagent's summary — cheap tiers are fine for gathering candidates,
not for being the final source of truth on a number.
