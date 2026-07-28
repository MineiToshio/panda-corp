---
id: LESSON-0178
type: gotcha
domain: factory-engineering
tags: [derived-files, generated-projection, documentation-consistency, dr-116]
context: a file that used to be hand-edited is converted into a generated/derived projection of a new source file
trigger: use this when converting a previously hand-edited file into a generated/derived projection (a manifest, a mirror, a compiled artifact) with a new single source of truth
source: "panda-corp factory/memory/_inbox.md 2026-07-18, corroborating DR-116 — CLAUDE.md's plugin-version bump ritual kept instructing a hand-edit of plugin/.claude-plugin/plugin.json after it became a generated projection of plugin/runtime/plugin-metadata.json; following the doc verbatim tripped the derived-drift Stop gate (2026-07-15, fixed commit af47d7ef)"
provenance: agent-inferred
created: 2026-07-21
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [standards/document-consistency.md, LESSON-0184]
---

**Situation:** when the plugin manifests became GENERATED projections of `plugin-metadata.json`,
`CLAUDE.md`'s bump ritual still instructed a hand-edit of the now-derived `plugin.json`. Following the
doc verbatim tripped the derived-drift Stop gate — the doc itself, not just code, still asserted the old
contract.

**Lesson:** converting a file to a generated/derived copy is a two-surface change, and it's easy to sweep
only the CODE readers (the generator script, the validators) while missing the INSTRUCTION docs that
still tell a human/agent to hand-edit the now-derived file. The instruction doc is itself a "reader" of
the old contract and drifts exactly like code would.

**Apply next time:** when a file becomes a generated/derived projection of a new source, grep every
instruction/procedure doc (CLAUDE.md, AGENTS.md, skill SOPs, README rituals) that names the now-derived
file's old edit path, and update them in the SAME change — not just the generator and its validator.
