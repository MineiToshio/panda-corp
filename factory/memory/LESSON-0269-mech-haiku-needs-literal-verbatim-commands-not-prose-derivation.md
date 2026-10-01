---
id: LESSON-0269
type: gotcha
domain: build-orchestration
tags: [mech-tier, haiku, prompt-design, subagent, dispatch]
context: dispatching a MECH-tier (haiku) subagent whose prompt describes a path/value via prose derivation (e.g. "let TOP = the repo root") instead of giving it literally, or whose steps must run in a specific order
trigger: use this when authoring or debugging a prompt for a MECH/haiku-tier subagent that needs to operate on a specific path/value or run several steps in a specific order
source: "mission-control .pandacorp/run/lessons.md 2026-09-26 (agent-inferred) — a MECH (haiku) agent ignored a prose instruction of the form \"let TOP = …\" and re-derived paths from its own cwd instead, producing wrong results; giving it literal commands to execute verbatim, and placing the final commit step at the END of the prompt (it follows textual/prompt order), fixed it"
provenance: agent-inferred
created: 2026-10-01
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0147, LESSON-0219]
---

**Situation:** a MECH-tier (haiku) subagent's dispatch prompt defined a value via prose ("let TOP = the
repo root, then operate under TOP/...") rather than giving a literal path/command, and separately listed
steps in an order that didn't match the order they needed to actually execute in. The agent re-derived the
path from its own working directory instead of honoring the prose definition, and appeared to follow the
prompt's textual/paragraph order rather than any logical dependency order implied by the prose.

**Lesson:** a mechanical, low-judgment (MECH/haiku) agent is not reliably doing the symbolic
substitution a prose variable definition implies ("let X = ...", "where TOP is ...") — it is far more
likely to pattern-match on its own immediate context (cwd, nearby text) than to carry a defined value
through several sentences of prose. It also tends to execute in the TEXTUAL order the prompt presents
steps, not a logically inferred order — a late "oh and also commit" aside does not reliably happen last if
it is written early in the prompt.

**Apply next time:** when dispatching a MECH-tier agent, give it the LITERAL command/path/value to use
verbatim rather than a prose definition it must resolve itself; and sequence the prompt's own steps in the
EXACT order they must execute (the final/closing action — e.g. a commit — goes at the end of the prompt
text, not earlier as an aside), rather than relying on the agent to infer dependency order from prose. For
anything requiring symbolic derivation or judgment about execution order, escalate to a higher tier
(sonnet/opus) instead.
