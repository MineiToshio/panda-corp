---
id: LESSON-0634
type: gotcha
domain: factory-engineering
tags: [memory, self-learning, citation-counter, prune, measurement]
context: interpreting times_applied/applied_in (maintained only by count-lesson-citations.sh grepping durable artifacts for a literal LESSON-NNNN string) when deciding whether a lesson is actually unused
trigger: "use this when a `review`/prune pass, or any audit of factory/memory/, is tempted to treat a times_applied value of 0 as evidence a lesson is unused — especially once the prune freeze lifts (3+ distinct projects in applied_in) and the 'never retrieved' criterion becomes live"
source: "factory/memory/_inbox.md note, 2026-11-06 review pass (agent-inferred) — sampled 151 active lessons in factory/memory/, found 73 at times_applied: 0 including several high-confidence/cross-corroborated ones already carrying promotion: approved or promotion: proposed (LESSON-0102, LESSON-0103, LESSON-0109, LESSON-0059); actionable half (nudge build prompts to cite ids explicitly) split to BL-0305"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0305, LESSON-0001]
---

**Situation:** A 2026-11-06 review pass over `factory/memory/` sampled 151 `active` lessons and found 73
sitting at `times_applied: 0` — the field `count-lesson-citations.sh` is the sole, deterministic owner of
(per this store's own lifecycle rule: never hand-edited, never agent-asserted). Several of the 73 were not
obscure or low-value: they were high-confidence lessons already carrying `promotion: approved` or
`promotion: proposed`, i.e. lessons the factory's own review process had already judged rule-worthy and
recurring. `count-lesson-citations.sh` works by grepping durable artifacts (blueprints, ADRs, reviews,
Status Notes) for a literal `LESSON-NNNN` string — it has no other way to detect that a lesson shaped a
decision.

**Lesson:** In this store, `times_applied: 0` is a much weaker "unused" signal than it looks, independent
of the prune-freeze distinct-project gate (which already protects against reading it as "useless" before
3 projects are measured). Even past that gate, a zero count plausibly means "a builder read `INDEX.md`,
the lesson's trigger matched, it shaped the decision — but the artifact produced never spelled out the
literal id," not "this lesson was never retrieved or never mattered." A literal-string grep over free-form
prose is a precise-but-low-recall proxy for retrieval; it undercounts far more than it overcounts. Treating
a bare zero as proof of non-use would let a prune pass deprecate lessons that are quietly doing their job
every time they are read, purely because nobody typed their id back into the output.

**Apply next time:** When auditing/pruning the memory store (the `memory` skill's `review` mode, or any
ad-hoc audit), weigh `times_applied: 0` alongside corroborating signals before proposing a deprecation —
confidence, whether the lesson already carries `promotion: approved`/`proposed`, how recently it was
added/updated, and whether its `trigger` clearly matches recurring work in the portfolio — rather than
reading the raw count in isolation. A zero count is grounds to ask "is this citation count trustworthy
yet?", not grounds to deprecate on its own. The structural fix (make the count less likely to
false-negative by nudging build prompts to cite `LESSON-NNNN` explicitly when a lesson is applied) is
tracked as `BL-0305`; this lesson is the retrieval-time caution to apply until — and even after — that
ships, since the undercounting bias will never fully disappear for a free-text grep.
