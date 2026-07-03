---
id: LESSON-0029
type: pattern
domain: documentation
tags: [claude-md, context-budget, rules, conciseness]
context: growing a project's always-loaded rules layer (docs/rules/ via @import + guide.md) as new conventions get added
trigger: use this when adding a new rule to a project's always-loaded CLAUDE.md/docs/rules/ layer and it is approaching or exceeding roughly 300 lines
source: "panda-corp 2026-07-02 — always-loaded layer measured at ~450 lines; docs/proposals/24; Anthropic/HumanLayer guidance on bloated CLAUDE.md files"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a product project's always-loaded rules layer (`docs/rules/` pulled in via `@import` +
`guide.md`) grew to ~450 lines, well past the ~300-line budget the factory recommends — bloated
always-loaded context is documented (Anthropic/HumanLayer) to make an agent start ignoring its actual
instructions.

**Lesson:** the always-loaded layer is a scarce, cumulative budget, not a place to append prose freely.
Two concrete levers keep it lean: (1) a short good/bad example is more information-dense than a
paragraph of explanation — prefer it; (2) if a rule is already mechanically enforced by a linter/type
checker (Biome, tsc), don't restate the rule in prose — point at the config instead of describing it.

**Apply next time:** before adding a new always-loaded rule, check whether it can be a short
example instead of a paragraph, and whether it's already enforced by tooling (in which case link the
config, don't duplicate it in prose); if the layer is already near/over ~300 lines, that is itself a
signal to prune/consolidate before adding more.
