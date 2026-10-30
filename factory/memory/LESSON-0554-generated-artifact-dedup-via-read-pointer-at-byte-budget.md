---
id: LESSON-0554
type: pattern
domain: build-engine
tags: [artifact-budget, codegen, dedup, read-pointer, single-source-of-truth]
context: a generated engine/workflow artifact is held to a hard byte-size budget by its own test, and a new feature needs headroom that trimming prose alone cannot recover
trigger: use this when a generated-code artifact is near its size budget and a new change needs to fit — before trimming prose, look for inlined content that duplicates an already-authored file
source: "mission-control/panda-corp build 2026-10-29 (agent-inferred): the build engine artifact (`pandacorp-build.js`) sat 77 bytes under its 480 KB budget (per the already-open BL-0255); the drift-finder's 5.6 KB inlined method body was a verbatim duplicate of `plugin/agents/drift-finder.md` and was converted to a Read pointer (the agent reads the authored file at runtime instead of the engine carrying a second copy), freeing enough headroom for the DR-142 Codex-worker feature to fit."
provenance: agent-inferred
created: 2026-10-29
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [BL-0255, DR-142]
---

**Situation:** a generated build-engine artifact is capped by a test at a hard byte budget (480 KB, with a
headroom floor below the runtime's own hard limit). The budget had shrunk to single-digit-bytes of
headroom (BL-0255), and a new feature needed to land. Instead of trimming prose text, the fix identified
that one inlined prompt fragment (the drift-finder's method body, ~5.6 KB) was a byte-for-byte duplicate of
an already-authored, separately-read file (`plugin/agents/drift-finder.md`) — carrying the SAME content
twice for no reason other than historical inlining.

**Lesson:** when a generated artifact is squeezed against a hard size budget, the highest-leverage recovery
is not line-editing prose but finding INLINED content that duplicates an already-authored file elsewhere in
the repo, and replacing the inline copy with a reference/pointer the runtime resolves at execution time (a
"Read pointer") instead of a second embedded copy. This is the same single-source-of-truth discipline
(DR-115 — one writer per fact) applied to a size-budget problem, not just a correctness one: a duplicate
copy is both a drift risk AND a budget cost.

**Apply next time:** before trimming prose to fit a generated artifact under a byte budget, grep the
artifact's own source for content that duplicates an authored file elsewhere (agent prompts, templates,
shared fragments) and convert the duplicate to a reference the consumer reads at runtime. Treat this as the
FIRST lever, not the last resort — it recovers more headroom than wording cuts and removes a drift risk at
the same time. Note: this is a temporary relief, not a structural fix — the budget will be squeezed again by
the next feature (see BL-0255's own fix plan for the systemic answer: move deterministic logic to mech
scripts).
