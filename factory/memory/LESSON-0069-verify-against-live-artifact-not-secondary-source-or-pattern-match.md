---
id: LESSON-0069
type: pattern
domain: agent-verification
tags: [verification, secondary-source, pattern-matching, ground-truth, diff, computed-state]
context: an agent is about to trust a secondary source (a doc, a prior audit, a pattern-match by sight, its own memory of a review, or a same-runtime self-check) instead of directly inspecting the live artifact
trigger: use this when about to base a diagnosis, a claim to the owner, or a "done"/"verified" declaration on a doc, a past finding, a recognized failure pattern, or a self-review — rather than on a fresh, direct read of the live artifact
source: "synthesized from LESSON-0027 (stale audit claim), LESSON-0047 (preview-tool false-signal modes), LESSON-0057 (component-inventory doc drift), LESSON-0058 (grid-collapse pattern-match without precondition check), LESSON-0067 (same-runtime review blind spots), LESSON-0068 (condensed-doc memory vs diff) — panda-corp + personal-page-v2, 2026-06-30..2026-07-04"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0027, LESSON-0047, LESSON-0057, LESSON-0058, LESSON-0067, LESSON-0068]
---

**Situation:** across six independent incidents (two projects, different domains — audit claims, preview
tooling, CSS diagnosis, doc condensation, cross-runtime integration review), an agent's failure traced
back to trusting a STAND-IN for the live artifact instead of inspecting the artifact itself: a stale audit
finding repeated as current fact (LESSON-0027), an unexpected screenshot-tool result taken at face value
instead of ruled against known tooling failure modes (LESSON-0047), a hand-maintained component-inventory
doc's factual claim about a CSS mechanism (LESSON-0057), a visual pattern-match to a known CSS bug assumed
to hold without checking its precondition (LESSON-0058), a builder's own confident re-read declaring a
doc-condensation lossless (LESSON-0068), and a same-runtime self-review of a cross-runtime integration
(LESSON-0067).

**Lesson:** each of these is the same causal shape wearing a different costume: a secondary
representation of reality (a doc, a memory, a pattern recognized by sight, a past report, a self-check)
is treated as equivalent to the live artifact it describes, when it can silently diverge from it — through
staleness (0027), unmodeled tooling behavior (0047), doc drift (0057), an unchecked precondition (0058),
the summarizer's own blind spots (0068), or the reviewer sharing the builder's assumptions (0067). The
common failure is epistemic, not domain-specific: confidence in a stand-in substitutes for a direct,
tool-mediated check of the actual current state (computed style, live code, an independent runtime, a
fact-by-fact diff) — and the substitution is invisible until someone (usually the owner) checks the real
thing and finds it disagrees.

**Apply next time:** before asserting a state, diagnosing a failure, or declaring something done based on
a doc, a past finding, a recognized pattern, or your own recollection/self-review — insert one direct,
tool-mediated check of the live artifact first: re-read the current code/frontmatter/state (not the audit
that described it), check `getComputedStyle`/the actual computed value (not the doc's claim about it or
the pattern's usual precondition), rule out known tool-specific false-signal modes before blaming the
underlying system (not the raw unexpected result), do a literal fact-by-fact diff (not a confident
holistic re-read), and get a genuine check from the actual consuming system/runtime (not the same one that
built it). Treat any of these six symptoms as one instance of a single rule: ground truth beats a stand-in
for ground truth, always.
