---
id: LESSON-0010
type: gotcha
domain: factory-engineering
tags: [agents, tools, researcher, spec, discover, delegation]
context: instructing the researcher sub-agent to write a file directly during /spec or /discover
source: factory/memory/_inbox.md (2026-06-28)
provenance: agent-inferred
created: 2026-06-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
links: []
---

**Situation:** In `/spec` and `/discover`, the `researcher` agent only has WebSearch/WebFetch/Read/Grep/Glob
— **no Write tool**. Instructing it to "write research.md" produces no file; the agent dutifully returns
the content as chat text instead, silently doing nothing on disk.

**Lesson:** Sub-agent tool grants are not always obvious from the prompt/skill text — an instruction that
assumes a tool the agent doesn't have degrades gracefully into a no-op (text back instead of a file
written), which can look like success at a glance. `product-manager` and `architect` DO have Write and are
the ones that persist `researcher`'s findings to disk.

**Apply next time:** When writing or editing a skill that delegates to `researcher` (or any agent), have it
**return findings as structured output** and have the Write-capable orchestrator/downstream agent
(`product-manager`, `architect`) persist them — never instruct a Read-only agent to "write file X".
Before assuming a sub-agent completed a file-write step, check the agent's tool grant in its `.md`
frontmatter.
