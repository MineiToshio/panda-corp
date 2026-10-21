---
id: LESSON-0451
type: pattern
domain: skill-design
tags: [skill-eval, owner-instruction, automation-scope, worktrees]
context: a skill/rule engine that auto-applies an action it judges "safe" (e.g. auto-delete, auto-merge) across a batch of candidate items
trigger: use this when designing or evaluating a skill that auto-applies a "safe" class of action to multiple items in one run, and the owner's own request already named a narrower, explicit scope
source: "plugin/skills/worktrees/evals/evals.json (prompt: \"...la rama codex/old-experiment descartala...lo demas no lo toques sin preguntarme\") — DR-135 worktrees skill eval, factory/memory/_inbox.md 2026-10-20 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-135]
---

**Situation:** an eval for the `worktrees` skill gives the owner's request as "descarta la rama
codex/old-experiment, ya lo decidi; lo demás no lo toques sin preguntarme" (discard this ONE named branch;
everything else needs my confirmation) alongside other items that would otherwise qualify as "provably
safe to auto-remove" under the skill's own default rule. A reference/baseline behavior respected the
explicit scope; an early version of the skill under test did not — it kept applying its general "auto-
remove what's provably safe" rule to items beyond the one the owner named, until corrected.

**Lesson:** a general automation rule ("auto-apply X to everything that qualifies") is a DEFAULT, not an
override of an explicit, narrower instruction given in the SAME request. When the owner names a specific
scope ("just this one", "lo demás no lo toques"), that instruction constrains the rule's blast radius for
THAT request — even for other items that would independently satisfy the "safe to auto-apply" criteria.

**Apply next time:** before letting a "safe-to-auto-apply" rule fire across a batch, check the request text
for an explicit scope-limiting instruction; if present, apply automation ONLY within that scope and route
everything else through the normal confirm-first path, regardless of whether those other items would also
qualify as safe.
