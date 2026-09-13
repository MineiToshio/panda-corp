---
id: LESSON-0069
type: pattern
domain: agent-verification
tags: [verification, secondary-source, pattern-matching, ground-truth, diff, computed-state]
context: an agent is about to trust a secondary source (a doc, a prior audit, a pattern-match by sight, its own memory of a review, or a same-runtime self-check) instead of directly inspecting the live artifact
trigger: use this when about to base a diagnosis, a claim to the owner, or a "done"/"verified" declaration on a doc, a past finding, a recognized failure pattern, or a self-review — rather than on a fresh, direct read of the live artifact
source: "synthesized from LESSON-0027 (stale audit claim), LESSON-0047 (preview-tool false-signal modes), LESSON-0057 (component-inventory doc drift), LESSON-0058 (grid-collapse pattern-match without precondition check), LESSON-0067 (same-runtime review blind spots), LESSON-0068 (condensed-doc memory vs diff) — panda-corp + personal-page-v2, 2026-06-30..2026-07-04. Corroborated a SEVENTH time (2026-07-28, panda-corp review-launch scheduled sweep, project personal-page-v2): `status.yaml` read `phase: release` since 2026-07-01, and review-launch nearly reported the launch's real-world metrics as if the current build were live — but the production domain still served the pre-rebuild 2021 site (`/en/projects` 404s, `/en/blog` shows the old post). The `phase: release` flag certifies the internal build/hardening gate closed clean, NOT that the external deploy+DNS-cutover step actually ran — same causal shape as the other six (a recorded flag/doc/self-check stood in for a direct check of the live artifact, here the actual production HTTP response). See BL-0087 for the actionable fix (review-launch must curl/route-check the live domain before trusting the phase flag).
EIGHTH corroboration (personal-page-v2, LinkedIn-rewrite session, 2026-09-10, agent-inferred): two research
subagents disagreed about the same primary source's content (a LinkedIn Help page's exact wording) — the
fix was neither subagent's report but one direct WebFetch of the primary page. A subagent disagreement is
itself a signal to go straight to the live artifact, not to pick whichever agent's answer sounds more
confident. NINTH corroboration (personal-page-v2, 2026-09-12, agent-inferred): a code comment asserting
'this seed/rule comes from DESIGN.md' read as authoritative and was trusted without checking —
`imagePrompt.ts`'s cover-image `VISUAL_SEED` claimed to encode 'the DESIGN.md frozen visual identity', but
DESIGN.md only prescribes that geometric-monoline style for the brand WORDMARK, saying nothing about blog
cover illustrations; the generalization was invented by whoever built the feature and never reviewed by the
owner for that specific use. A `grep` for the claimed keywords in the target doc would have caught the gap
immediately."
provenance: agent-inferred
created: 2026-07-04
status: active
promotion: approved   # 2026-09-03 promoted via /pandacorp:learn (proposal 33 §12.4 sitting) → factory/standards/conventions.md#CONV-13
confidence: medium
times_applied: 1
applied_in: [personal-page-v2]
links: [LESSON-0027, LESSON-0047, LESSON-0057, LESSON-0058, LESSON-0067, LESSON-0068, LESSON-0140, LESSON-0183, CONV-13, factory/standards/conventions.md#CONV-13]
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
for ground truth, always. An eighth, corroborating shape: when two subagents disagree about the same
primary source, neither report is ground truth — go verify the source directly rather than arbitrating
between the two accounts. A ninth: a code comment that cites a canonical doc as its authority ("per
DESIGN.md", "per the PRD") should be spot-checked against that doc's actual text before it is trusted or
extended further — it reads authoritative, but it may be an invented generalization nobody ever verified
against the source it claims to follow.
